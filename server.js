// server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const sgMail = require('@sendgrid/mail');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== MIDDLEWARE ======
app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://crossroadsapparel.netlify.app"
    ],
    credentials: true
}));
app.use(bodyParser.json());

// ====== CONFIGURE SENDGRID ======
if (!process.env.SENDGRID_API_KEY) {
    console.warn("⚠ SENDGRID_API_KEY not set in .env");
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

// ====== CONFIGURE NEON DB ======
// Support both NEON_CONNECTION_STRING and DATABASE_URL
const connectionString = process.env.NEON_CONNECTION_STRING || process.env.DATABASE_URL;
if (!connectionString) {
    console.error("❌ No database connection string found! Please set NEON_CONNECTION_STRING or DATABASE_URL in .env");
    process.exit(1);
}
const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// ====== HEALTH CHECK ROUTE ======
app.get('/api/status', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: 'ok', message: 'Backend and database connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ====== ROUTES ======

// Create Profile (Sign Up)
app.post('/api/profile', async (req, res) => {
    const { name, email, joined, profilePic, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        await pool.query(
            `INSERT INTO users (name, email, joined, profile_pic, password)
             VALUES ($1, $2, $3, $4, $5)`,
            [name, email, joined || new Date().toLocaleDateString(), profilePic, password]
        );

        if (process.env.SENDGRID_API_KEY && process.env.FROM_EMAIL) {
            const msg = {
                to: email,
                from: process.env.FROM_EMAIL,
                subject: 'Welcome to Crossroads!',
                text: `Hello ${name}, welcome to Crossroads! Your profile has been created successfully.`,
                html: `<h1>Welcome, ${name}!</h1><p>Your profile is now active.</p>`
            };
            await sgMail.send(msg);
        } else {
            console.warn("⚠ Skipping email sending — SendGrid config missing");
        }

        res.status(201).json({ message: 'Profile created successfully!' });
    } catch (error) {
        console.error("❌ Error in /api/profile:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            'SELECT name, email, joined, profile_pic, password FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        if (user.password !== password) { // ⚠ Plaintext password for now
            return res.status(401).json({ error: 'Invalid password' });
        }

        delete user.password;
        res.json(user);
    } catch (error) {
        console.error("❌ Error in /api/login:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ====== START SERVER ======
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});






