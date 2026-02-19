require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

// --- MongoDB Configuration ---
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("❌ ERROR: MONGODB_URI is missing in your .env file!");
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  city: String,
  userId: String,
  time: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
// ------------------------------

// Use Environment Variables for Email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(bodyParser.json());

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, "../frontend")));

// Registration Endpoint
app.post("/submit", async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;
    const userId = "RW" + Math.floor(1000 + Math.random() * 9000);

    // Save to MongoDB
    const newUser = new User({
      name,
      email,
      phone,
      city,
      userId
    });
    await newUser.save();
    console.log(`✅ User ${name} registered`);

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
      console.log(`📧 Email sent to ${email}`);
    }).catch((mailErr) => {
      console.error("❌ Email failed:", mailErr.message);
    });

    res.json({
      success: true,
      name,
      userId
    });

  } catch (err) {
    console.error("❌ Submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin API: Get all users
app.get("/api/admin/data", async (req, res) => {
  try {
    const users = await User.find().sort({ time: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin API: Download Excel
app.get("/api/admin/download", async (req, res) => {
  try {
    const users = await User.find().lean();

    const excelData = users.map(u => ({
      Name: u.name,
      Email: u.email,
      Phone: u.phone,
      City: u.city,
      UserID: u.userId,
      Registration_Time: u.time.toLocaleString()
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, "Members");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=RichWay_Members.xlsx");
    res.send(buffer);
  } catch (err) {
    res.status(500).send("Export failed: " + err.message);
  }
});

// Serve Admin Page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/admin.html"));
});

// Serve frontend for any other non-API route
app.get("*", (req, res, next) => {
  if (req.url.startsWith("/api")) return next(); // Don't serve HTML for broken API calls
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
