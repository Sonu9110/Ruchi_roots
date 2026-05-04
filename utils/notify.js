// utils/notify.js
const nodemailer = require('nodemailer');

// Try to load Twilio, but don't crash if not installed
let twilio;
try {
    twilio = require('twilio');
} catch (err) {
    console.log('⚠️ Twilio not installed – WhatsApp notifications disabled.');
}

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
}

let twilioClient = null;
if (twilio && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendEmailNotification(orderDetails) {
    if (!transporter) return;
    const html = `<h2>New Order #${orderDetails.id}</h2>
        <p><strong>Customer:</strong> ${orderDetails.customer_name}</p>
        <p><strong>Mobile:</strong> ${orderDetails.customer_mobile}</p>
        <p><strong>Address:</strong> ${orderDetails.address}</p>
        <p><strong>Total:</strong> ₹${orderDetails.total_amount}</p>
        <p><strong>Items:</strong> ${orderDetails.items_summary}</p>`;
    try {
        await transporter.sendMail({
            from: `"Ruchiroots" <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `New Order #${orderDetails.id}`,
            html
        });
        console.log(`📧 Email sent for order #${orderDetails.id}`);
    } catch (err) {
        console.error('Email error:', err.message);
    }
}

async function sendWhatsAppNotification(orderDetails) {
    if (!twilioClient) {
        console.log(`📱 WhatsApp would be sent for order #${orderDetails.id} (Twilio not configured)`);
        return;
    }
    const message = `🛍️ New Order #${orderDetails.id}\n👤 ${orderDetails.customer_name}\n📞 ${orderDetails.customer_mobile}\n📍 ${orderDetails.address}\n💰 ₹${orderDetails.total_amount}\n📦 ${orderDetails.items_summary}`;
    try {
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_WHATSAPP_FROM,
            to: process.env.ADMIN_WHATSAPP
        });
        console.log(`✅ WhatsApp sent for order #${orderDetails.id}`);
    } catch (err) {
        console.error('WhatsApp error:', err.message);
    }
}

async function sendOrderNotifications(orderDetails) {
    await sendEmailNotification(orderDetails);
    await sendWhatsAppNotification(orderDetails);
}

module.exports = { sendOrderNotifications };