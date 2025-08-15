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
if (!process.env.NEON_CONNECTION_STRING) {
    console.warn("⚠ NEON_CONNECTION_STRING not set in .env");
}
const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});

// ====== ROUTES ======

// Create Profile (Sign Up)
app.post('/api/profile', async (req, res) => {
    const { name, email, joined, profilePic, password } = req.body;

    // Validate request body
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        // Save to Neon DB
        await pool.query(
            `INSERT INTO users (name, email, joined, profile_pic, password)
             VALUES ($1, $2, $3, $4, $5)`,
            [name, email, joined || new Date().toLocaleDateString(), profilePic, password]
        );

        // Send Email via SendGrid
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

        delete user.password; // Remove password before sending back
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




