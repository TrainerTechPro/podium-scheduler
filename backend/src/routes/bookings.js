const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get all bookings for a parent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view bookings' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        child:children(first_name, last_name),
        slot:schedule_slots(
          start_time,
          end_time,
          session_type:session_types(name, duration_minutes)
        )
      `)
      .eq('parent_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Create a new booking
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { slot_id, child_id } = req.body;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can make bookings' });
    }

    // Verify the child belongs to this parent
    const { data: child } = await supabase
      .from('children')
      .select('id')
      .eq('id', child_id)
      .eq('parent_id', req.user.id)
      .single();

    if (!child) {
      return res.status(400).json({ error: 'Invalid child selection' });
    }

    // Check if slot exists and get session info
    const { data: slot } = await supabase
      .from('schedule_slots')
      .select(`
        *,
        session_type:session_types(*)
      `)
      .eq('id', slot_id)
      .single();

    if (!slot) {
      return res.status(400).json({ error: 'Session not found' });
    }

    // Check if session is in the future
    if (new Date(slot.start_time) <= new Date()) {
      return res.status(400).json({ error: 'Cannot book past sessions' });
    }

    // Check for existing booking
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('slot_id', slot_id)
      .eq('child_id', child_id)
      .neq('status', 'cancelled')
      .single();

    if (existingBooking) {
      return res.status(400).json({ error: 'Already booked for this session' });
    }

    // Check capacity
    const { data: currentBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('slot_id', slot_id)
      .neq('status', 'cancelled');

    if (currentBookings.length >= slot.session_type.max_participants) {
      return res.status(400).json({ error: 'Session is full' });
    }

    // Create the booking
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        slot_id,
        child_id,
        parent_id: req.user.id,
        status: 'confirmed',
        payment_method: 'credits'
      })
      .select(`
        *,
        child:children(first_name, last_name),
        slot:schedule_slots(
          start_time,
          end_time,
          session_type:session_types(name, duration_minutes)
        )
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Cancel a booking
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can cancel bookings' });
    }

    // Verify booking belongs to this parent
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        slot:schedule_slots(start_time)
      `)
      .eq('id', id)
      .eq('parent_id', req.user.id)
      .single();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if cancellation is allowed (24 hours before)
    const sessionTime = new Date(booking.slot.start_time);
    const now = new Date();
    const hoursUntilSession = (sessionTime - now) / (1000 * 60 * 60);

    if (hoursUntilSession < 24) {
      return res.status(400).json({ 
        error: 'Cannot cancel within 24 hours of session time' 
      });
    }

    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
