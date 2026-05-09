const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const { connectDB } = require("../../shared/db");

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ["Restaurant", "NGO", "Admin"]
    },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true }
  },
  { timestamps: true, versionKey: false }
);

const User = mongoose.model("User", userSchema);

app.post("/api/users/register", async (req, res) => {
  try {
    const { name, email, role, phone, address } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "name, email and role are required"
      });
    }

    const allowedRoles = ["Restaurant", "NGO", "Admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "role must be Restaurant, NGO, or Admin"
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email"
      });
    }

    const user = await User.create({
      name,
      email,
      role,
      phone: phone || "",
      address: address || ""
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/users/:id", async (req, res) => {
  try {
    const updates = {};
    ["name", "phone", "address"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User updated", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User deleted", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function start() {
  try {
    await connectDB(process.env.MONGO_URI);

    const PORT = process.env.PORT || 5001;

    app.get("/health", (req, res) => {
  res.json({ success: true, service: "user-service" });
});
    
    app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message:error.message });
  }
});
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`User service running on port ${PORT}`);
    });

  } catch (error) {
    console.error("User service failed to start:", error.message);
    process.exit(1);
  }
}

start();
