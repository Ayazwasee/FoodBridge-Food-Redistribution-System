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

const claimSchema = new mongoose.Schema(
  {
    listingId: { type: String, required: true, trim: true },
    ngoName: { type: String, required: true, trim: true },
    ngoContact: { type: String, required: true, trim: true },
    pickupPerson: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Claimed", "Collected", "Cancelled"],
      default: "Claimed"
    },
    claimedAt: { type: Date, default: Date.now },
    collectedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

const Claim = mongoose.model("Claim", claimSchema);

function listingBaseUrl() {
  return process.env.LISTING_SERVICE_URL || "http://localhost:5004";
}

async function fetchListing(listingId) {
  const response = await fetch(`${listingBaseUrl()}/api/listings/${listingId}`);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function updateListingStatus(listingId, status) {
  const response = await fetch(`${listingBaseUrl()}/api/listings/${listingId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

app.post("/api/claims", async (req, res) => {
  try {
    const { listingId, ngoName, ngoContact, pickupPerson } = req.body;

    if (!listingId || !ngoName || !ngoContact) {
      return res.status(400).json({
        success: false,
        message: "listingId, ngoName and ngoContact are required"
      });
    }

    const { response: listingRes, data: listingData } = await fetchListing(listingId);

    if (!listingRes.ok) {
      return res.status(404).json({ success: false, message: "Food listing not found" });
    }

    const listing = listingData.data;
    const expired = new Date(listing.expiryAt).getTime() < Date.now();

    if (expired || listing.status === "Expired") {
      return res.status(400).json({
        success: false,
        message: "Cannot claim an expired listing"
      });
    }

    if (listing.status !== "Available") {
      return res.status(400).json({
        success: false,
        message: "Food listing is not available"
      });
    }

    const claim = await Claim.create({
      listingId,
      ngoName,
      ngoContact,
      pickupPerson: pickupPerson || "",
      status: "Claimed",
      claimedAt: new Date(),
      collectedAt: null
    });

    const { response: reserveRes, data: reserveData } = await updateListingStatus(listingId, "Reserved");
    if (!reserveRes.ok) {
      await Claim.findByIdAndDelete(claim._id);
      return res.status(500).json({
        success: false,
        message: reserveData.message || "Could not reserve the food listing"
      });
    }

    res.status(201).json({
      success: true,
      message: "Food claimed successfully",
      data: claim
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/claims", async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/claims/:id", async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }
    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/claims/listing/:listingId", async (req, res) => {
  try {
    const claims = await Claim.find({ listingId: req.params.listingId }).sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.patch("/api/claims/:id/collect", async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    if (claim.status === "Collected") {
      return res.status(400).json({ success: false, message: "Claim is already collected" });
    }

    const { response: listingRes } = await fetchListing(claim.listingId);
    if (!listingRes.ok) {
      return res.status(404).json({ success: false, message: "Related food listing not found" });
    }

    const { response: updateRes, data: updateData } = await updateListingStatus(claim.listingId, "Collected");
    if (!updateRes.ok) {
      return res.status(500).json({
        success: false,
        message: updateData.message || "Could not update listing status"
      });
    }

    claim.status = "Collected";
    claim.collectedAt = new Date();
    await claim.save();

    res.json({
      success: true,
      message: "Claim marked as collected",
      data: claim
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.patch("/api/claims/:id/cancel", async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    if (claim.status === "Collected") {
      return res.status(400).json({ success: false, message: "Collected claim cannot be cancelled" });
    }

    const { response: listingRes } = await fetchListing(claim.listingId);
    if (listingRes.ok) {
      await updateListingStatus(claim.listingId, "Available");
    }

    claim.status = "Cancelled";
    await claim.save();

    res.json({
      success: true,
      message: "Claim cancelled",
      data: claim
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

async function start() {
  try {
    await connectDB(process.env.CLAIM_MONGO_URI);

    const PORT = process.env.CLAIM_PORT || 5003;

    app.get("/health", (req, res) => {
      res.json({ success: true, service: "claim-service" });
    });
    
    app.get("/api/claims", async (req, res) => {
      try {
        const claims = await Claim.find();
        res.json(claims);
      } catch (error) {
        res.status(500).json({ message:error.message });
      }
    });
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Claim service running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Claim service failed to start:", error.message);
    process.exit(1);
  }
}

start();
