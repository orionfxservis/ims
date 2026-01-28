// app.js - Main Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    loadDashboardData();
    loadDashboardData();
    loadUserCategories();
    setupPurchaseCalculations(); // Init Purchase Logic
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

// --- Dashboard Logic ---
async function refreshDashboard() {
    console.log("Refreshing Dashboard Stats...");

    // Check if elements exist (only on dashboard page)
    if (!document.getElementById('dTotalValue')) return;

    try {
        const inventory = await API.getInventory();
        const sales = await API.getSales(); // Now available

        // 1. Calculate Total Value & Product Count
        let totalValue = 0;
        let lowStockCount = 0;
        let lowStockItems = [];

        inventory.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            totalValue += qty * price;

            // Low Stock Check (threshold 5)
            if (qty <= 5) {
                lowStockCount++;
                lowStockItems.push(item);
            }
        });

        // 2. Sales Today
        const today = new Date().toISOString().split('T')[0];
        let salesToday = 0;
        let salesMap = {}; // item -> qty

        sales.forEach(s => {
            // Normalize date check
            let sDate = s.date;
            if (s.date && s.date.includes('T')) sDate = s.date.split('T')[0];

            if (sDate === today) {
                salesToday += parseFloat(s.total) || 0;
            }

            // Top Selling Logic
            const itemName = s['Item Name'] || s.itemName || 'Unknown';
            salesMap[itemName] = (salesMap[itemName] || 0) + (parseFloat(s.quantity) || 0);
        });

        // 3. Update UI - Main Cards
        animateValue(document.getElementById('dTotalValue'), 0, totalValue, 1000, 'Rs. ');
        animateValue(document.getElementById('dTotalProducts'), 0, inventory.length, 1000, '');
        document.getElementById('dLowStock').textContent = lowStockCount;
        animateValue(document.getElementById('dSalesToday'), 0, salesToday, 1000, 'Rs. ');

        // 4. Update Low Stock Table
        const lowStockBody = document.getElementById('lowStockTableBody');
        if (lowStockItems.length > 0) {
            lowStockBody.innerHTML = lowStockItems.slice(0, 5).map(item => `
                <tr>
                    <td>${item['Item Name'] || item.itemName}</td>
                    <td style="color: #f59e0b; font-weight: bold;">${item.quantity}</td>
                    <td><span class="status-badge status-pending" style="font-size: 0.7rem; padding: 2px 6px;">Low</span></td>
                </tr>
            `).join('');
        } else {
            lowStockBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #22c55e;">All stock levels healthy</td></tr>';
        }

        // 5. Update Top Selling
        const sortedSales = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topSellingList = document.getElementById('topSellingList');
        if (sortedSales.length > 0) {
            topSellingList.innerHTML = sortedSales.map(([name, qty]) => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.2rem;">
                    <span>${name}</span>
                    <span style="color: #22c55e; font-weight: bold;">${qty} Sold</span>
                </div>
            `).join('');
        } else {
            topSellingList.innerHTML = '<p style="color: #aaa;">No sales data available</p>';
        }

    } catch (e) {
        console.error("Dashboard Refresh Error", e);
    }

    // Load Dashboard Banner
    loadDashboardBanner();
}

// 3. Mock Data Loading for Dashboard
function loadDashboardData() {
    // In real app, fetch from google.script.run
    // Animate numbers
    // animateValue(document.querySelector('#dashboard .stat-card:nth-child(1) .stat-value'), 0, 150000, 2000, 'Rs. ');
    // animateValue(document.querySelector('#dashboard .stat-card:nth-child(2) .stat-value'), 0, 45000, 2000, 'Rs. ');
    // animateValue(document.querySelector('#dashboard .stat-card:nth-child(3) .stat-value'), 0, 80000, 2000, 'Rs. ');

    // Load Dashboard Banner
    // loadDashboardBanner();
    refreshDashboard();
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

// 6. User Category Loading
async function loadUserCategories() {
    const select = document.getElementById("purCategorySelect");
    if (!select) return;

    try {
        console.log("Fetching categories from API...");
        const res = await API.getCategories();
        console.log("Categories API Response:", res);

        let categories = [];

        if (res && res.categories) {
            categories = res.categories;
        } else if (Array.isArray(res)) {
            categories = res;
        }

        console.log("Parsed Categories:", categories);

        select.innerHTML = '<option value="">Select Category</option>';

        categories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.name;
            option.textContent = cat.name;
            select.appendChild(option);
        });

        // Populate Inventory Modal Datalist (if exists)
        const dataList = document.getElementById("categoryList");
        if (dataList) {
            dataList.innerHTML = '';
            categories.forEach(cat => {
                const option = document.createElement("option");
                option.value = cat.name;
                dataList.appendChild(option);
            });
        }

    } catch (e) {
        console.error("Error loading categories", e);
        alert("Error: " + e.message);
    }
}



// Calculations for Purchase Form
// Calculations for Purchase Form (Event Listeners)
function setupPurchaseCalculations() {
    const qtyInput = document.getElementById('purQty');
    const priceInput = document.getElementById('purPrice');
    const paidInput = document.getElementById('purPaid');

    if (qtyInput && priceInput) {
        const calcTotal = () => {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const total = qty * price;
            document.getElementById('purTotal').value = total;
            calcBalance();
        };
        qtyInput.addEventListener('input', calcTotal);
        priceInput.addEventListener('input', calcTotal);
    }

    if (paidInput) {
        paidInput.addEventListener('input', calcBalance);
    }
}

function calcBalance() {
    const total = parseFloat(document.getElementById('purTotal').value) || 0;
    const paid = parseFloat(document.getElementById('purPaid').value) || 0;
    const balance = total - paid;
    document.getElementById('purBalance').value = balance;
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

// Handling Purchase Form Submit
const purchaseForm = document.getElementById('purchaseForm');
if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = purchaseForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        const purchaseData = {
            date: new Date().toISOString().split('T')[0], // Auto date
            category: document.getElementById('purCategorySelect').value,
            vendor: document.getElementById('purVendor').value,
            item: document.getElementById('purItem').value,
            brand: document.getElementById('purBrand').value,
            qty: document.getElementById('purQty').value,
            price: document.getElementById('purPrice').value,
            total: document.getElementById('purTotal').value,
            paid: document.getElementById('purPaid').value,
            mode: document.getElementById('purMode').value,
            balance: document.getElementById('purBalance').value
        };

        try {
            // Using saveInventory for now, or creating a new endpoint?
            // User said "User profile in purchase section... add purchase inventory".
            // It seems this acts as adding to inventory but with cost details.
            // Let's use API.saveInventory but we might need to update backend to accept these fields.
            const res = await API.saveInventory(purchaseData);

            if (res.status === 'success' || res.success) {
                alert('Purchase recorded successfully!');
                purchaseForm.reset();
                // Refresh dashboard stats if needed
                refreshDashboard();
            } else {
                alert('Error recording purchase: ' + (res.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error connecting to server.');
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}
