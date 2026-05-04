// routes/products.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_available', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Supabase error in /api/products:', error);
            return res.status(500).json({ error: error.message });
        }

        // Ensure we always return an array
        if (!data) {
            return res.json([]);
        }
        res.json(data);
    } catch (err) {
        console.error('❌ Server error in /api/products:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;