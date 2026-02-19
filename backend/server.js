require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const XLSX = require("xlsx");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

// Use Environment Variables for Email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Set this in Render Dashboard
    pass: process.env.EMAIL_PASS  // Set this in Render Dashboard
  }
});


app.use(cors());
app.use(bodyParser.json());

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, "../frontend")));

const FILE_PATH = path.join(__dirname, "data", "formData.xlsx");

// Ensure folder & file exist
fs.ensureDirSync(path.join(__dirname, "data"));
fs.ensureFileSync(FILE_PATH);

// Create Excel with headers if empty
if (fs.statSync(FILE_PATH).size === 0) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { Name: "", Email: "", Phone: "", City: "", Time: "" }
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Submissions");
  XLSX.writeFile(wb, FILE_PATH);
}

// API Endpoint
app.post("/submit", async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;

    const userId = "RW" + Math.floor(1000 + Math.random() * 9000);

    const workbook = XLSX.readFile(FILE_PATH);
    const sheet = workbook.Sheets["Submissions"];
    const data = XLSX.utils.sheet_to_json(sheet);

    data.push({
      Name: name,
      Email: email,
      Phone: phone,
      City: city,
      UserID: userId,
      Time: new Date().toLocaleString()
    });

    const newSheet = XLSX.utils.json_to_sheet(data);
    workbook.Sheets["Submissions"] = newSheet;
    XLSX.writeFile(workbook, FILE_PATH);

    // Send Email to User (Non-blocking)
    try {
      await transporter.sendMail({
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
      });

      console.log(`Email sent successfully to ${email}`);
    } catch (mailErr) {
      console.error("Email sending failed:", mailErr.message);
    }

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
