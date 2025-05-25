const express = require('express');
const router = express.Router();

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

module.exports = router;
