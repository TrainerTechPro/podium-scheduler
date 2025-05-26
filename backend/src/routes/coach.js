const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get coach profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can access coach profile' });
    }

    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    res.json(data || {});
  } catch (error) {
    console.error('Error fetching coach profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update coach profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can update coach profile' });
    }

    const profileData = {
      user_id: req.user.id,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('coach_profiles')
      .upsert(profileData)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating coach profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
