// routes/admin.js
const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../db'); // separate clients
const { authenticateAdmin } = require('../middleware/auth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Memory storage (no disk writes)
const upload = multer({ storage: multer.memoryStorage() });

// Helper: upload file buffer to Supabase Storage using admin client (bypasses RLS)
async function uploadToSupabase(file, folder = 'products') {
    if (!file) return null;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabaseAdmin.storage
        .from('product-images')
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: false
        });
    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return publicUrl;
}

// ---------- Products ----------
router.get('/products', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/products', authenticateAdmin, upload.single('image'), async (req, res) => {
    try {
        let image_url = null;
        if (req.file) {
            image_url = await uploadToSupabase(req.file);
        }
        const { name, description, price, has_variants, variant_prices } = req.body;
        let variantJson = null;
        if (has_variants === 'true' && variant_prices) {
            variantJson = JSON.parse(variant_prices);
        }
        const { data, error } = await supabase.from('products').insert({
            name,
            description: description || '',
            price: parseFloat(price) || 0,
            has_variants: has_variants === 'true',
            variant_prices: variantJson,
            image_url,
            is_available: true
        }).select().single();
        if (error) throw error;
        res.json({ success: true, id: data.id });
    } catch (err) {
        console.error('Add product error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/products/:id', authenticateAdmin, upload.single('image'), async (req, res) => {
    try {
        let updateData = {
            name: req.body.name,
            description: req.body.description || '',
            price: parseFloat(req.body.price) || 0,
            has_variants: req.body.has_variants === 'true',
            variant_prices: req.body.has_variants === 'true' ? JSON.parse(req.body.variant_prices) : null
        };
        if (req.file) {
            updateData.image_url = await uploadToSupabase(req.file);
        }
        if (req.body.is_available !== undefined) {
            updateData.is_available = req.body.is_available === 'true';
        }
        const { error } = await supabase.from('products').update(updateData).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const { error } = await supabase.from('products').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Orders ----------
router.get('/orders', authenticateAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const { status, delivery_date_time } = req.body;
        const { error } = await supabase.from('orders').update({ status, delivery_date_time }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/orders/:id', authenticateAdmin, async (req, res) => {
    try {
        const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        const { data: total } = await supabase.from('orders').select('id', { count: 'exact', head: true });
        const { data: pending } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        const { data: revenue } = await supabase.from('orders').select('total_amount');
        const total_revenue = revenue?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        res.json({
            total_orders: total?.count || 0,
            pending_orders: pending?.count || 0,
            total_revenue
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;