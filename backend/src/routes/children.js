const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get all children for a parent
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view children' });
    }

    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', req.user.id)
      .eq('is_active', true)
      .order('first_name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// Add a new child
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, date_of_birth, notes } = req.body;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can add children' });
    }

    const { data, error } = await supabase
      .from('children')
      .insert({
        parent_id: req.user.id,
        first_name,
        last_name,
        date_of_birth,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error adding child:', error);
    res.status(500).json({ error: 'Failed to add child' });
  }
});

// Update a child
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, date_of_birth, notes } = req.body;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can update children' });
    }

    // Verify the child belongs to this parent
    const { data: existingChild } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', id)
      .single();

    if (!existingChild || existingChild.parent_id !== req.user.id) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const { data, error } = await supabase
      .from('children')
      .update({
        first_name,
        last_name,
        date_of_birth,
        notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).json({ error: 'Failed to update child' });
  }
});

// Soft delete a child
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can delete children' });
    }

    // Verify the child belongs to this parent
    const { data: existingChild } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', id)
      .single();

    if (!existingChild || existingChild.parent_id !== req.user.id) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const { error } = await supabase
      .from('children')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Child removed successfully' });
  } catch (error) {
    console.error('Error removing child:', error);
    res.status(500).json({ error: 'Failed to remove child' });
  }
});

module.exports = router;
