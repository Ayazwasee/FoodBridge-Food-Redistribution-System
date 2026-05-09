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

const listingSchema = new mongoose.Schema(
  {
    restaurantName: { type: String, required: true, trim: true },
    foodType: { type: String, required: true, trim: true },
    quantity: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    contactPhone: { type: String, default: "", trim: true },
    expiryAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Available", "Reserved", "Collected", "Expired"],
      default: "Available"
    },
    notes: { type: String, default: "", trim: true }
  },
  { timestamps: true, versionKey: false }
);

const Listing = mongoose.model("Listing", listingSchema);

function isExpired(listing) {
  return new Date(listing.expiryAt).getTime() < Date.now();
}

function serializeListing(listing) {
  const obj = listing.toObject();
  obj.isExpired = isExpired(listing);
  if (obj.isExpired && obj.status === "Available") {
    obj.status = "Expired";
  }
  return obj;
}

app.post("/api/listings", async (req, res) => {
  try {
    const { restaurantName, foodType, quantity, location, contactPhone, expiryHours, notes } = req.body;

    if (!restaurantName || !foodType || !quantity || !location) {
      return res.status(400).json({
        success: false,
        message: "restaurantName, foodType, quantity and location are required"
      });
    }

    const hours = expiryHours === undefined || expiryHours === null || expiryHours === "" ? 4 : Number(expiryHours);

    if (Number.isNaN(hours) || hours <= 0) {
      return res.status(400).json({
        success: false,
        message: "expiryHours must be a positive number"
      });
    }

    const expiryAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const listing = await Listing.create({
      restaurantName,
      foodType,
      quantity,
      location,
      contactPhone: contactPhone || "",
      expiryAt,
      notes: notes || ""
    });

    res.status(201).json({
      success: true,
      message: "Food listing created successfully",
      data: serializeListing(listing)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/listings", async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const listings = await Listing.find(query).sort({ createdAt: -1 });
    const data = listings.map(serializeListing);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/listings/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    res.json({ success: true, data: serializeListing(listing) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/listings/:id", async (req, res) => {
  try {
    const updates = {};
    ["restaurantName", "foodType", "quantity", "location", "contactPhone", "notes"].forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.expiryHours !== undefined) {
      const hours = Number(req.body.expiryHours);
      if (Number.isNaN(hours) || hours <= 0) {
        return res.status(400).json({
          success: false,
          message: "expiryHours must be a positive number"
        });
      }
      updates.expiryAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const listing = await Listing.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    res.json({
      success: true,
      message: "Listing updated",
      data: serializeListing(listing)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/listings/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Available", "Reserved", "Collected", "Expired"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    listing.status = status;
    await listing.save();

    res.json({
      success: true,
      message: "Listing status updated",
      data: serializeListing(listing)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/listings/:id", async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    res.json({ success: true, message: "Listing deleted", data: serializeListing(listing) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function start() {
  try {
    await connectDB(process.env.LISTING_MONGO_URI);

    const PORT = process.env.LISTING_PORT || 5004;
    
    app.get("/health", (req, res) => {
      res.json({ success: true, service: "listing-service" });
    });
    
    app.get("/api/listings", async (req, res) => {
      try {
        const listings = await Listing.find();
        res.json(listings);
      } catch (error) {
        res.status(500).json({ message:error.message });
      }
      });
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Listing service running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Listing service failed to start:", error.message);
    process.exit(1);
  }
}

start();
