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

// Get schedule slots
router.get('/slots', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
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
    const { session_type_id, start_date, start_time, duration_minutes, recurring, weeks_to_repeat } = req.body;
    const supabase = req.app.locals.supabase;
    
    // Verify user is trainer
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can create sessions' });
    }

    const slots = [];
    const baseDate = new Date(start_date);
    const [hours, minutes] = start_time.split(':');
    
    // Generate slots based on recurring pattern
    const weeksToCreate = recurring === 'weekly' ? (weeks_to_repeat || 12) : 1;
    
    for (let week = 0; week < weeksToCreate; week++) {
      const slotDate = new Date(baseDate);
      slotDate.setDate(slotDate.getDate() + (week * 7));
      
      const startDateTime = new Date(slotDate);
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + duration_minutes);
      
      slots.push({
        session_type_id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        recurring_pattern: recurring
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
