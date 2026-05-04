const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { authenticateUser } = require('../middleware/auth');
const { sendOrderNotifications } = require('../utils/notify');

router.post('/', authenticateUser, async (req, res) => {
    const { customer_name, customer_mobile, address, district, taluk, items, total_amount } = req.body;
    if (!customer_name || !customer_mobile || !address || !items || !total_amount) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    try {
        const { data, error } = await supabase
            .from('orders')
            .insert({
                user_id: req.user.id,
                customer_name,
                customer_mobile,
                address,
                district: district || 'Raichur',
                taluk: taluk || 'Sirwar',
                items,
                total_amount
            })
            .select()
            .single();
        if (error) throw error;
        const itemsSummary = items.map(i => `${i.name} x${i.quantity}`).join(', ');
        const itemsList = items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));
        sendOrderNotifications({ id: data.id, customer_name, customer_mobile, address, district, taluk, total_amount, items_summary: itemsSummary, items_list: itemsList });
        res.json({ success: true, order_id: data.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/my-orders', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;