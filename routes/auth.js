const express = require('express');
const router = express.Router();
const supabase = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
    const { name, mobile } = req.body;
    if (!name || !mobile) return res.status(400).json({ error: 'Name and mobile required' });

    const cleanMobile = mobile.toString().replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) return res.status(400).json({ error: 'Invalid mobile number' });

    try {
        // Check if user exists
        let { data: user, error } = await supabase
            .from('users')
            .select('id, name, mobile')
            .eq('mobile', cleanMobile)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (user) {
            // Update name if changed
            if (user.name !== name) {
                await supabase.from('users').update({ name }).eq('id', user.id);
                user.name = name;
            }
            const token = jwt.sign({ id: user.id, mobile: user.mobile, name, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
            return res.json({ success: true, token, user });
        } else {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({ mobile: cleanMobile, name })
                .select()
                .single();
            if (insertError) throw insertError;
            const token = jwt.sign({ id: newUser.id, mobile: cleanMobile, name, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
            res.json({ success: true, token, user: { id: newUser.id, name, mobile: cleanMobile } });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ id: 0, role: 'admin', name: 'Admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.get('/profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') {
            return res.json({ name: 'Admin', mobile: 'admin', role: 'admin' });
        }
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, mobile')
            .eq('id', decoded.id)
            .single();
        if (error || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;