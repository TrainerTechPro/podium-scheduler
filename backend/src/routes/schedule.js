const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get all session types
router.get('/session-types', async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    const { data, error } = await supabase
      .from('session_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching session types:', error);
    res.status(500).json({ error: 'Failed to fetch session types' });
  }
});

// Create new session type
router.post('/session-types', authenticateToken, async (req, res) => {
  try {
    const { name, duration_minutes, credits_required, one_off_price_cents, max_participants, description } = req.body;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can create session types' });
    }

    const { data, error } = await supabase
      .from('session_types')
      .insert({
        name,
        duration_minutes,
        credits_required: credits_required || 1,
        one_off_price_cents: one_off_price_cents || null,
        max_participants,
        description
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error creating session type:', error);
    res.status(500).json({ error: 'Failed to create session type' });
  }
});

// Update session type
router.put('/session-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, duration_minutes, credits_required, one_off_price_cents, max_participants, description } = req.body;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can update session types' });
    }

    const { data, error } = await supabase
      .from('session_types')
      .update({
        name,
        duration_minutes,
        credits_required,
        one_off_price_cents,
        max_participants,
        description
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating session type:', error);
    res.status(500).json({ error: 'Failed to update session type' });
  }
});

// Delete session type (soft delete)
router.delete('/session-types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can delete session types' });
    }

    const { error } = await supabase
      .from('session_types')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Session type deleted successfully' });
  } catch (error) {
    console.error('Error deleting session type:', error);
    res.status(500).json({ error: 'Failed to delete session type' });
  }
});

// Get schedule slots with filters
router.get('/slots', async (req, res) => {
  try {
    const { start_date, end_date, session_type_id } = req.query;
    const supabase = req.app.locals.supabase;

    let query = supabase
      .from('schedule_slots')
      .select(`
        *,
        session_type:session_types(*)
      `)
      .order('start_time');

    if (start_date) {
      query = query.gte('start_time', start_date);
    }
    if (end_date) {
      query = query.lte('start_time', end_date);
    }
    if (session_type_id) {
      query = query.eq('session_type_id', session_type_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Create schedule slots (with recurring)
router.post('/slots', authenticateToken, async (req, res) => {
  try {
    const { session_type_id, start_date, start_time, recurring, weeks_to_repeat, selected_days } = req.body;
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can create sessions' });
    }

    // Get session type details
    const { data: sessionType } = await supabase
      .from('session_types')
      .select('*')
      .eq('id', session_type_id)
      .single();

    if (!sessionType) {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    const slots = [];
    const baseDate = new Date(start_date);
    const [hours, minutes] = start_time.split(':');
    
    if (recurring === 'weekly' && selected_days && selected_days.length > 0) {
      // Create sessions for selected days of the week
      const weeksToCreate = weeks_to_repeat || 12;
      
      for (let week = 0; week < weeksToCreate; week++) {
        for (const dayOfWeek of selected_days) {
          const slotDate = new Date(baseDate);
          slotDate.setDate(slotDate.getDate() + (week * 7));
          
          // Adjust to the correct day of the week
          const currentDay = slotDate.getDay();
          const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
          if (week === 0 && daysToAdd === 0 && slotDate < baseDate) {
            continue; // Skip if it's before the start date
          }
          slotDate.setDate(slotDate.getDate() + daysToAdd);
          
          const startDateTime = new Date(slotDate);
          startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          const endDateTime = new Date(startDateTime);
          endDateTime.setMinutes(endDateTime.getMinutes() + sessionType.duration_minutes);
          
          slots.push({
            session_type_id,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            recurring_pattern: recurring
          });
        }
      }
    } else {
      // Single session
      const startDateTime = new Date(baseDate);
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + sessionType.duration_minutes);
      
      slots.push({
        session_type_id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        recurring_pattern: null
      });
    }

    const { data, error } = await supabase
      .from('schedule_slots')
      .insert(slots)
      .select();

    if (error) throw error;
    res.json({ message: `Created ${slots.length} sessions`, data });
  } catch (error) {
    console.error('Error creating schedule slots:', error);
    res.status(500).json({ error: 'Failed to create schedule slots' });
  }
});

// Delete a schedule slot
router.delete('/slots/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can delete sessions' });
    }

    const { error } = await supabase
      .from('schedule_slots')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

module.exports = router;
