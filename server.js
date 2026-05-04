const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { supabase } = require('./db'); // ✅ destructure supabase client

const app = express();

// Ensure uploads folder exists (for any local fallback)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Razorpay endpoints
app.post('/api/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }
        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1,
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, id: order.id, amount: order.amount, currency: order.currency });
    } catch (error) {
        console.error('Razorpay order error:', error);
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});

app.post('/api/verify-payment', (req, res) => {
    try {
        const { order_id, payment_id, signature } = req.body;
        const body = order_id + '|' + payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
        if (expectedSignature === signature) {
            res.json({ success: true, message: 'Payment verified' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

// Insert sample products if none
(async () => {
    const { data: existing, error } = await supabase.from('products').select('id').limit(1);
    if (error) console.error('Error checking products:', error);
    if (!existing || existing.length === 0) {
        const sample = [
            { name: 'Spicy Murukku', description: 'Crispy traditional snack', price: 50, is_available: true },
            { name: 'Mixture', description: 'Spicy and tangy mixture', price: 60, is_available: true },
            { name: 'Nippattu', description: 'Crunchy rice crackers', price: 40, is_available: true }
        ];
        await supabase.from('products').insert(sample);
        console.log('✅ Sample products added.');
    }
})();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});