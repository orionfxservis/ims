// app.js - Main Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    loadDashboardData();
});

// 1. Authentication Check
function checkAuth() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userStr);
    document.getElementById('userNameDisplay').textContent = user.name;

    // Show Admin Tab if role is admin
    if (user.role === 'admin') {
        document.getElementById('adminTab').classList.remove('hidden');
    }

    // Logout Handler
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('user');
            window.location.href = '../index.html';
        }
    });
}

// 2. Navigation Handling
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const sections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));
            // Hide all sections
            sections.forEach(sec => sec.classList.add('hidden'));

            // Activate clicked
            item.classList.add('active');
            const tabName = item.getAttribute('data-tab');
            document.getElementById(tabName).classList.remove('hidden');

            // Update Title
            pageTitle.textContent = item.textContent.trim();

            // Load data if needed based on tab
            if (tabName === 'admin') loadAdminData();
            if (tabName === 'inventory') loadInventory();
        });
    });
}

// 3. Mock Data Loading for Dashboard
function loadDashboardData() {
    // In real app, fetch from google.script.run
    // Animate numbers
    animateValue(document.querySelector('#dashboard .stat-card:nth-child(1) .stat-value'), 0, 150000, 2000, 'Rs. ');
    animateValue(document.querySelector('#dashboard .stat-card:nth-child(2) .stat-value'), 0, 45000, 2000, 'Rs. ');
    animateValue(document.querySelector('#dashboard .stat-card:nth-child(3) .stat-value'), 0, 80000, 2000, 'Rs. ');

    // Load Dashboard Banner
    loadDashboardBanner();
}

async function loadDashboardBanner() {
    try {
        const banners = await API.getBanners();
        const dbBanner = banners.find(b => b.type === 'dashboard');
        const bannerContainer = document.getElementById('dashboardBannerContainer');

        if (dbBanner && dbBanner.url && bannerContainer) {
            bannerContainer.innerHTML = `<img src="${dbBanner.url}" alt="Dashboard Banner" style="max-width: 720px; width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        }
    } catch (e) {
        console.error("Failed to load dashboard banner", e);
    }
}

function animateValue(obj, start, end, duration, prefix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = prefix + Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// 4. Load Inventory (Mock)
function loadInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    if (tbody.children.length > 0) return; // Already loaded

    const mockItems = [
        { date: "2023-01-15", category: "Electronics", itemname: "MacBook Pro", brand: "Apple", model: "M1", qty: 5 },
        { date: "2023-01-20", category: "Electronics", itemname: "Monitor", brand: "Dell", model: "24-inch", qty: 12 },
        { date: "2023-02-01", category: "Furniture", itemname: "Office Chair", brand: "Ergo", model: "Pro", qty: 8 },
    ];

    tbody.innerHTML = mockItems.map(item => `
        <tr>
            <td>${item.date || ''}</td>
            <td>${item.category || ''}</td>
            <td>${item.itemname || ''}</td>
            <td>${item.brand || ''}</td>
            <td>${item.model || ''}</td>
            <td>${item.qty || 0}</td>
            <td>
                <button class="btn" style="padding: 0.25rem 0.5rem; width: auto; font-size: 0.8rem;">Edit</button>
            </td>
        </tr>
    `).join('');
}

// 5. Load Admin Data (Mock)
function loadAdminData() {
    const container = document.getElementById('pendingUsersList');
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div>
                <strong>New User: JohnDoe</strong><br>
                <small style="color:#aaa;">Company: ABC Corp</small>
            </div>
            <div>
                <button class="btn" style="width:auto; background: var(--success);" onclick="alert('Approved!')">Approve</button>
                <button class="btn" style="width:auto; background: var(--error); margin-left: 0.5rem;" onclick="alert('Rejected!')">Reject</button>
            </div>
        </div>
        <div style="padding: 1rem; text-align: center; color: #aaa;">No more pending requests</div>
    `;
}

// Helper: Modal Logic
window.openModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');

        // Specific init for Add Item
        if (id === 'addItemModal') {
            // Auto-fill Date
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('invDate').value = today;

            // Reset other fields
            document.getElementById('addItemForm').reset();
            document.getElementById('invDate').value = today; // Re-set after reset
        }
    }
}

window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

// Calculations for Inventory Modal
window.calculateInvTotal = function () {
    const qty = parseFloat(document.getElementById('invQty').value) || 0;
    const price = parseFloat(document.getElementById('invPrice').value) || 0;
    const total = qty * price;

    document.getElementById('invTotal').value = total;
    calculateInvBalance(); // Recalc balance as total changed
}

window.calculateInvBalance = function () {
    const total = parseFloat(document.getElementById('invTotal').value) || 0;
    const paid = parseFloat(document.getElementById('invPaid').value) || 0;
    const balance = total - paid;

    document.getElementById('invBalance').value = balance;
}

// Handling Add Item Submit (Mock)
document.getElementById('addItemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const item = {
        date: document.getElementById('invDate').value,
        vendor: document.getElementById('invVendor').value,
        item: document.getElementById('invItemName').value,
        qty: document.getElementById('invQty').value,
        total: document.getElementById('invTotal').value
    };

    alert(`Item "${item.item}" added to inventory! (Saved to sheet mock)`);
    closeModal('addItemModal');
    // Here we would call API.saveInventory(item)
});
