const USER_API    = "http://18.206.100.185:5001/api/users";
const LISTING_API = "http://18.206.100.185:5004/api/listings";
const CLAIM_API   = "http://18.206.100.185:5005/api/claims";

// ── Tab navigation ──
function switchTab(name) {
  document.querySelectorAll(".tab-page").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  const page = document.getElementById(`tab-${name}`);
  const tab  = document.querySelector(`.nav-tab[data-tab="${name}"]`);
  if (page) page.classList.remove("hidden");
  if (tab)  tab.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ── API helper ──
async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ── Toast ──
function showToast(message, type = "success") {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Result banner ──
function showResult(id, message, type = "success") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `result-banner ${type}`;
  setTimeout(() => el.classList.add("hidden"), 6000);
}

// ── Stats ──
async function loadStats() {
  try {
    const [listings, claims, users] = await Promise.all([
      apiRequest(LISTING_API).catch(() => ({ data: [] })),
      apiRequest(CLAIM_API).catch(() => ({ data: [] })),
      apiRequest(USER_API).catch(() => ({ data: [] }))
    ]);
    const active = (listings.data || []).filter(l => !l.isExpired && l.status === "Available").length;
    document.querySelector("#statListings .badge-num").textContent = active;
    document.querySelector("#statClaims .badge-num").textContent   = (claims.data || []).length;
    document.querySelector("#statUsers .badge-num").textContent    = (users.data || []).length;
  } catch (_) {}
}

// ── Listing cards ──
function renderListings(data) {
  const container = document.getElementById("listingContainer");
  const listings  = Array.isArray(data) ? data : (data?.data || []);
  const available = listings.filter(l => !l.isExpired && l.status === "Available");
  container.innerHTML = "";

  if (!available.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🫙</div>
        <h3>No food available right now</h3>
        <p>Check back soon — listings appear here in real-time.</p>
      </div>`;
    return;
  }

  available.forEach(item => {
    const card = document.createElement("div");
    card.className = "listing-card";
    const exp = new Date(item.expiryAt);
    const hoursLeft = Math.max(0, Math.round((exp - Date.now()) / 3600000));
    card.innerHTML = `
      <div class="listing-card-top">
        <span class="listing-food">${esc(item.foodType)}</span>
        <span class="listing-status">Available</span>
      </div>
      <p class="listing-detail"><strong>From:</strong> ${esc(item.restaurantName)}</p>
      <p class="listing-detail"><strong>Qty:</strong> ${esc(item.quantity)}</p>
      <p class="listing-detail"><strong>📍</strong> ${esc(item.location)}</p>
      ${item.contactPhone ? `<p class="listing-detail"><strong>📞</strong> ${esc(item.contactPhone)}</p>` : ""}
      <p class="listing-detail"><strong>⏱</strong> ${hoursLeft}h left${item.notes ? ` · ${esc(item.notes)}` : ""}</p>
      <p class="listing-id">ID: ${esc(item._id)}</p>
      <button class="listing-claim-btn" data-id="${esc(item._id)}" data-food="${esc(item.foodType)}">🤝 Claim This</button>
    `;
    card.querySelector(".listing-claim-btn").addEventListener("click", e => {
      const { id, food } = e.currentTarget.dataset;
      document.getElementById("listingId").value = id;
      document.getElementById("listingIdHint").textContent = `✓ Selected: ${food}`;
      showToast(`Selected "${food}" — fill in your NGO details`, "success");
      switchTab("claim");
    });
    container.appendChild(card);
  });
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function loadListings() {
  try {
    const result = await apiRequest(`${LISTING_API}?status=Available`);
    renderListings(result);
    loadStats();
  } catch (err) {
    document.getElementById("listingContainer").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Could not connect to server</h3>
        <p>${err.message}</p>
      </div>`;
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadListings);

// ── DONATE FORM ──
document.getElementById("listingForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector(".btn-submit");
  btn.textContent = "Posting…";
  btn.disabled = true;
  try {
    const body = {
      restaurantName: document.getElementById("restaurantName").value.trim(),
      foodType:       document.getElementById("foodType").value.trim(),
      quantity:       document.getElementById("quantity").value.trim(),
      location:       document.getElementById("location").value.trim(),
      contactPhone:   document.getElementById("contactPhone").value.trim(),
      expiryHours:    document.getElementById("expiryHours").value,
      notes:          document.getElementById("notes").value.trim()
    };
    await apiRequest(LISTING_API, { method: "POST", body: JSON.stringify(body) });
    showResult("donateResult", `✅ Listing for "${body.foodType}" is now live! NGOs can see it immediately.`, "success");
    showToast(`"${body.foodType}" posted successfully!`);
    e.target.reset();
    document.getElementById("expiryHours").value = "4";
  } catch (err) {
    showResult("donateResult", `❌ ${err.message}`, "error");
    showToast(err.message, "error");
  } finally {
    btn.textContent = "📦 Post Food Listing";
    btn.disabled = false;
  }
});

// ── CLAIM FORM ──
document.getElementById("claimForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector(".btn-submit");
  btn.textContent = "Claiming…";
  btn.disabled = true;
  try {
    const body = {
      listingId:    document.getElementById("listingId").value.trim(),
      ngoName:      document.getElementById("ngoName").value.trim(),
      ngoContact:   document.getElementById("ngoContact").value.trim(),
      pickupPerson: document.getElementById("pickupPerson").value.trim()
    };
    const result = await apiRequest(CLAIM_API, { method: "POST", body: JSON.stringify(body) });
    const claimId = result?.data?._id || "";
    showResult("claimResult",
      `✅ Claimed successfully! Your Claim ID: ${claimId}\nSave this ID to mark as collected later.`,
      "success");
    showToast(`Food claimed by ${body.ngoName}!`);
    e.target.reset();
    document.getElementById("listingIdHint").textContent = "";
    loadListings();
  } catch (err) {
    showResult("claimResult", `❌ ${err.message}`, "error");
    showToast(err.message, "error");
  } finally {
    btn.textContent = "🤝 Confirm Claim";
    btn.disabled = false;
  }
});

// ── COLLECT FORM ──
document.getElementById("collectForm").addEventListener("submit", async e => {
  e.preventDefault();
  const claimId = document.getElementById("claimId").value.trim();
  const btn = e.target.querySelector(".btn-submit");
  btn.textContent = "Updating…";
  btn.disabled = true;
  try {
    await apiRequest(`${CLAIM_API}/${claimId}/collect`, { method: "PATCH" });
    showToast("✅ Marked as collected!");
    e.target.reset();
    loadListings();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.textContent = "Mark Collected";
    btn.disabled = false;
  }
});

// ── CANCEL FORM ──
document.getElementById("cancelForm").addEventListener("submit", async e => {
  e.preventDefault();
  const claimId = document.getElementById("cancelClaimId").value.trim();
  const btn = e.target.querySelector(".btn-submit");
  btn.textContent = "Cancelling…";
  btn.disabled = true;
  try {
    await apiRequest(`${CLAIM_API}/${claimId}/cancel`, { method: "PATCH" });
    showToast("Claim cancelled — food is available again", "success");
    e.target.reset();
    loadListings();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.textContent = "Cancel Claim";
    btn.disabled = false;
  }
});

// ── DATA EXPLORER ──
document.getElementById("loadClaims").addEventListener("click", async () => {
  try {
    const r = await apiRequest(CLAIM_API);
    document.getElementById("output").textContent = JSON.stringify(r, null, 2);
    showToast("Claims loaded");
  } catch (err) { showToast(err.message, "error"); }
});
document.getElementById("loadListings").addEventListener("click", async () => {
  try {
    const r = await apiRequest(LISTING_API);
    document.getElementById("output").textContent = JSON.stringify(r, null, 2);
    showToast("Listings loaded");
  } catch (err) { showToast(err.message, "error"); }
});
document.getElementById("loadUsers").addEventListener("click", async () => {
  try {
    const r = await apiRequest(USER_API);
    document.getElementById("output").textContent = JSON.stringify(r, null, 2);
    showToast("Users loaded");
  } catch (err) { showToast(err.message, "error"); }
});
document.getElementById("clearOutput").addEventListener("click", () => {
  document.getElementById("output").textContent = "// Response will appear here";
});

// ── REGISTER FORM ──
// Role selector (radio → hidden input)
document.querySelectorAll('.role-opt input[type="radio"]').forEach(radio => {
  radio.addEventListener("change", () => {
    document.getElementById("role").value = radio.value;
  });
});

document.getElementById("registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const role = document.getElementById("role").value;
  if (!role) { showToast("Please select a role", "error"); return; }
  const btn = e.target.querySelector(".btn-submit");
  btn.textContent = "Creating account…";
  btn.disabled = true;
  try {
    const body = {
      name:    document.getElementById("name").value.trim(),
      email:   document.getElementById("email").value.trim(),
      role,
      phone:   document.getElementById("phone").value.trim(),
      address: document.getElementById("address").value.trim()
    };
    await apiRequest(`${USER_API}/register`, { method: "POST", body: JSON.stringify(body) });
    showResult("registerResult", `✅ Account created for ${body.name}! You can now list or claim food.`, "success");
    showToast(`Welcome, ${body.name}! 🎉`);
    e.target.reset();
    document.getElementById("role").value = "";
    loadStats();
  } catch (err) {
    showResult("registerResult", `❌ ${err.message}`, "error");
    showToast(err.message, "error");
  } finally {
    btn.textContent = "Create Account →";
    btn.disabled = false;
  }
});

// ── Hour picker helper ──
function changeHours(delta) {
  const el = document.getElementById("expiryHours");
  const val = Math.max(1, Math.min(48, parseInt(el.value || 4) + delta));
  el.value = val;
}

// ── Init ──
loadListings();
setInterval(loadListings, 5000);
