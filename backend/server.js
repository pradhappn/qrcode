require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

// --- Google Sheets Configuration ---
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

async function initSheet() {
  try {
    await doc.loadInfo();
    console.log(`Connected to Google Sheet: ${doc.title}`);
  } catch (err) {
    console.error("Google Sheets initialization failed:", err.message);
  }
}
initSheet();
// -----------------------------------

// Use Environment Variables for Email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.use(cors());
app.use(bodyParser.json());

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, "../frontend")));

// API Endpoint
app.post("/submit", async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;
    const userId = "RW" + Math.floor(1000 + Math.random() * 9000);

    // Save to Google Sheets
    try {
      const sheet = doc.sheetsByIndex[0]; // Assumes first sheet
      await sheet.addRow({
        Name: name,
        Email: email,
        Phone: phone,
        City: city,
        UserID: userId,
        Time: new Date().toLocaleString()
      });
      console.log("Data saved to Google Sheets");
    } catch (sheetErr) {
      console.error("Failed to save to Google Sheets:", sheetErr.message);
    }

    // Send Email to User (Non-blocking background task)
    transporter.sendMail({
      from: `RICH WAY <yourgmail@gmail.com>`,
      to: email,
      subject: "Welcome To Rich Way Family 🎉",
      html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h1 style="color: #fbbf24;">Welcome to the Family!</h1>
            <p>Hello <b>${name}</b>,</p>
            <p>Thank you for joining <b>RICH WAY</b>. Your registration was successful.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><b>Your Member ID:</b> <span style="color: #d97706; font-family: monospace;">#${userId}</span></p>
            </div>
            <p>We are excited to have you with us!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">Ref: RW-${userId}</p>
          </div>
        `
    }).then(() => {
      console.log(`Email sent successfully to ${email}`);
    }).catch((mailErr) => {
      console.error("Email sending failed:", mailErr.message);
    });

    res.json({
      success: true,
      name,
      userId
    });

  } catch (err) {
    console.error("Submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend for any other route (Express 5 compatible named wildcard)
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
