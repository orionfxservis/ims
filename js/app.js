// app.js - Main Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    loadDashboardData();
    loadDashboardData();
    loadUserCategories();
    setupPurchaseCalculations(); // Init Purchase Logic
    setupSalesForm(); // Init Sales Logic
    setupExpensesForm(); // Init Expenses Logic
    loadBroadcasts(); // New: Load Broadcasts

    // Verify Deployment Version
    // Verify Deployment Version
    checkDeploymentVersion();

    // Mobile Sidebar Toggle Logic
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');

            // Handle Overlay
            let overlay = document.querySelector('.sidebar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                document.body.appendChild(overlay);
                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                });
            }
            overlay.classList.toggle('active');
        });

        // Auto-close on nav click
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('active');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (overlay) overlay.classList.remove('active');
                }
            });
        });
    }
});

// Global Chart Instance
let salesChartInstance = null;

// User Profile Logic
window.openUserProfile = async function () {
    // Switch to profile view
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('profile').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'User Profile';

    // Get current user
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    // Fill Info
    document.getElementById('pName').innerText = user.name || user.username;
    document.getElementById('pCompany').innerText = user.company || 'Unknown Company';
    document.getElementById('pRole').innerText = (user.role || 'User').toUpperCase();

    // Avatar
    const pAvatar = document.getElementById('pAvatar');
    if (user.profileImage) {
        let imgPath = user.profileImage;
        if (imgPath.startsWith('assets/') && !imgPath.startsWith('../')) imgPath = '../' + imgPath;
        pAvatar.innerHTML = `<img src="${imgPath}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        pAvatar.style.border = '3px solid var(--primary)';
    } else {
        pAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
    }

    // Load Chart
    await loadUserSalesChart(user.username);
}

async function loadUserSalesChart(username) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Destroy existing if any
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    // Fetch Sales
    const sales = await API.getSales();

    // Filter by User
    const userSales = sales.filter(s => (s.user || '').toLowerCase() === username.toLowerCase());

    // Process Data (Group by Month)
    const monthlyData = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize current year months
    const currentYear = new Date().getFullYear();
    months.forEach(m => monthlyData[`${m} ${currentYear}`] = 0);

    userSales.forEach(s => {
        let dateObj = new Date(s.date);
        if (isNaN(dateObj)) dateObj = new Date(); // Fallback

        const monthYear = `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        const total = parseFloat(s.total) || 0;

        // Accumulate
        if (monthlyData[monthYear] !== undefined) {
            monthlyData[monthYear] += total;
        } else {
            // Handle past/future years if needed, or just add
            monthlyData[monthYear] = (monthlyData[monthYear] || 0) + total;
        }
    });

    // Sort Keys (Chronological) - Simple approach for chart labels
    // For simplicity, we just take the keys we initialized + any others
    // But let's just stick to the current year or last 12 months logic if complex.
    // For now: Just use the keys we have with data

    const labels = Object.keys(monthlyData);
    const dataPoints = Object.values(monthlyData);

    // Create Chart
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Sales (Rs.)',
                data: dataPoints,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#aaa' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#aaa' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

async function checkDeploymentVersion() {
    if (!API.isLive()) return;

    try {
        const res = await API.get('getVersion');
        console.log("Deployment Version:", res);

        if (!res || res.version !== '1.3 - Broadcasts Enabled') {
            // If version mismatch or error (likely 'Invalid Action' if old code)
            const msg = "SYSTEM UPDATE REQUIRED: Your Google Apps Script deployment is outdated. Please Redeploy > New Version.";
            alert(msg);
            const banner = document.getElementById('dashboardBannerContainer');
            if (banner) {
                banner.innerHTML = `<div style="background:red; color:white; padding:15px; text-align:center; font-weight:bold;">${msg}</div>` + banner.innerHTML;
            }
        } else {
            console.log("System Version 1.3 Verified.");
        }
    } catch (e) {
        console.warn("Could not verify version. Likely old deployment.", e);
    }
}

// 1. Authentication Check
function checkAuth() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userStr);
    if (document.getElementById('userNameDisplay')) {
        document.getElementById('userNameDisplay').textContent = user.name || user.username;
    }

    // Check connection mode
    const badge = document.getElementById('modeBadge');
    if (badge) {
        if (!API.isLive()) {
            badge.style.display = 'inline-block';
            badge.title = "Data is saved locally. Configure API URL in Settings to sync with Google Sheets.";
        } else {
            badge.style.display = 'none';
        }
    }

    // Show Admin Tab if role is admin
    if (user.role === 'admin') {
        document.getElementById('adminTab').classList.remove('hidden');
    }

    // Profile Image Rendering
    if (user.profileImage) {
        let imgPath = user.profileImage;
        // Fix path for pages/ directory if needed
        if (imgPath.startsWith('assets/') && !imgPath.startsWith('../')) {
            imgPath = '../' + imgPath;
        }

        const profileIcon = document.querySelector('.user-profile div');
        if (profileIcon) {
            profileIcon.innerHTML = `<img src="${imgPath}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            profileIcon.style.background = 'none'; // Remove background color
            profileIcon.style.border = '2px solid rgba(255,255,255,0.2)';
        }
    }

    // Trial Mode Indicator
    if (user.role === 'trial') {
        const profile = document.querySelector('.user-profile');
        const badge = document.createElement('span');
        badge.className = 'status-badge status-pending'; // Reusing existing class for yellow/orange look
        badge.style.marginRight = '1rem';
        badge.innerHTML = '<i class="fa-solid fa-flask"></i> Trial Mode';
        profile.insertBefore(badge, profile.firstChild);
    }

    // Logout Handler
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('user');
            window.location.href = '../index.html';
        }
    });

    // Trial Mode Restriction
    if (user.role === 'trial') {
        const restrictSet = [
            'purchaseForm', 'salesForm', 'expenseForm', 'addItemForm'
        ];

        restrictSet.forEach(id => {
            const form = document.getElementById(id);
            if (form) {
                const btn = form.querySelector('button[type="submit"]');
                if (btn) {
                    btn.disabled = true;
                    btn.title = "Action disabled in Trial Mode";
                    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Read Only';
                    btn.style.background = '#64748b';
                    btn.style.cursor = 'not-allowed';
                }
            }
        });

        // Also disable quick action buttons on dashboard
        document.querySelectorAll('.action-btn').forEach(btn => {
            // We can't disable div onClick easily without removing listener, 
            // but we can add a visual cue or intercept. 
            // Since they just navigate, we let them navigate. 
            // But the forms inside are now disabled. 
        });
    }
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
            if (tabName === 'expenses') loadRecentExpenses();
            if (tabName === 'sales') {
                loadRecentSales();
                if (typeof loadSaleItems === 'function') loadSaleItems();
            }
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
        let totalProductsQty = 0;
        let lowStockCount = 0;
        let lowStockItems = [];

        inventory.forEach(item => {
            const val = parseFloat(item.total) || 0;
            totalValue += val;

            const qty = parseFloat(item.quantity) || 0;
            totalProductsQty += qty;

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
        animateValue(document.getElementById('dTotalProducts'), 0, totalProductsQty, 1000, '');
        const elLowStock = document.getElementById('dLowStock');
        if (elLowStock) elLowStock.textContent = lowStockCount;
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

// 7. Load Recent Purchases
async function loadRecentPurchases() {
    const tbody = document.getElementById('recentPurchasesTableBody');
    const tableHeadRow = document.querySelector('#purchase .data-table thead tr'); // Target the header row
    const catSelect = document.getElementById('purCategorySelect');

    if (!tbody || !tableHeadRow) return;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading...</td></tr>';

    try {
        const inventory = await API.getInventory();
        // Check current category context
        const cat = catSelect ? catSelect.value : '';
        const isCharger = cat === 'Charger' || cat === 'Laptop Chargers';
        const isKbMouse = cat === 'Keyboard & Mouse';
        const isLaptop = cat === 'Laptop';

        // Filter inventory by the current category
        const filteredInventory = inventory.filter(item => {
            const itemCat = item['Category'] || item.category || '';
            // Match exact category
            return itemCat === cat;
        });

        // Get last 5 items from the FILTERED list
        const recent = filteredInventory.slice(-5).reverse();
        if (isCharger) {
            tableHeadRow.innerHTML = `
                <th>Vendor</th>
                <th>Brand</th>
                <th>Volt</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Mode</th>
                <th>Balance</th>
            `;
        } else if (isKbMouse) {
            tableHeadRow.innerHTML = `
                <th>Date</th>
                <th>Vendor</th>
                <th>Brand</th>
                <th>Item Type</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Mode</th>
                <th>Balance</th>
            `;
        } else if (isLaptop) {
            tableHeadRow.innerHTML = `
                <th>Date</th>
                <th>Vendor</th>
                <th>Model</th>
                <th>Gen</th>
                <th>RAM</th>
                <th>HDD</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
            `;
        } else {
            // Default Standard Headers
            tableHeadRow.innerHTML = `
                <th>Item</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
            `;
        }

        if (recent.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #666;">No entries yet</td></tr>`;
            return;
        }

        // 2. Render Rows matching headers
        tbody.innerHTML = recent.map(item => {
            // Helper to safe get property (Sheet Header or Keys)
            // Sheet has: 'Date', 'Vendor', 'Item Name', 'Brand', 'Quantity', 'Unit Price', 'Total', 'Paid', 'Mode', 'Balance', 'Generation', 'Model', 'Ram', 'HDD'
            const get = (key, alt) => item[key] !== undefined ? item[key] : (item[alt] !== undefined ? item[alt] : '-');
            const getNum = (key, alt) => item[key] !== undefined ? item[key] : (item[alt] !== undefined ? item[alt] : 0);

            // Format Date
            let d = get('Date', 'date');
            if (typeof d === 'string' && d.includes('T')) d = d.split('T')[0];

            if (isCharger) {
                return `
                    <tr>
                        <td>${get('Vendor', 'vendor')}</td>
                        <td>${get('Brand', 'brand')}</td>
                        <td>${get('Volt', 'volt')}</td>
                        <td>${getNum('Unit Price', 'price')}</td>
                        <td>${getNum('Quantity', 'qty')}</td>
                        <td>${getNum('Total', 'total')}</td>
                        <td>${getNum('Paid', 'paid')}</td>
                        <td>${get('Mode', 'mode')}</td>
                        <td>${getNum('Balance', 'balance')}</td>
                    </tr>
                `;
            } else if (isKbMouse) {
                return `
                    <tr>
                        <td>${d}</td>
                        <td>${get('Vendor', 'vendor')}</td>
                        <td>${get('Brand', 'brand')}</td>
                        <td>${get('Item Name', 'item')}</td>
                        <td>${getNum('Unit Price', 'price')}</td>
                        <td>${getNum('Quantity', 'qty')}</td>
                        <td>${getNum('Total', 'total')}</td>
                        <td>${getNum('Paid', 'paid')}</td>
                        <td>${get('Mode', 'mode')}</td>
                        <td>${getNum('Balance', 'balance')}</td>
                    </tr>
                `;
            } else if (isLaptop) {
                return `
                    <tr>
                        <td>${d}</td>
                        <td>${get('Vendor', 'vendor')}</td>
                        <td>${get('Model', 'model')}</td>
                        <td>${get('Generation', 'generation')}</td>
                        <td>${get('Ram', 'ram')}</td>
                        <td>${get('HDD', 'hdd')}</td>
                        <td>${getNum('Quantity', 'qty')}</td>
                        <td>${getNum('Total', 'total')}</td>
                        <td>${getNum('Paid', 'paid')}</td>
                        <td>${getNum('Balance', 'balance')}</td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${get('Item Name', 'item')}</td>
                        <td>${getNum('Quantity', 'qty')}</td>
                        <td>${getNum('Total', 'total')}</td>
                        <td>${getNum('Paid', 'paid')}</td>
                        <td>${getNum('Balance', 'balance')}</td>
                    </tr>
                `;
            }
        }).join('');

    } catch (e) {
        console.error("Error loading recent purchases", e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data</td></tr>';
    }
}
// Init call
loadRecentPurchases();

// 4. Load Inventory (Mock)
// 4. Load Inventory (Real-Time Stock)
// 4. Load Inventory (Real-Time Stock)
// 4. Load Inventory (Real-Time Stock)
async function loadInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">Loading Stock...</td></tr>';

    try {
        const [inventory, sales] = await Promise.all([
            API.getInventory(),
            API.getSales()
        ]);

        // Deep copy inventory to calculate remaining stock without mutating cached data
        let stockList = JSON.parse(JSON.stringify(inventory));

        // FIFO Deduction of Sales
        sales.forEach(sale => {
            const saleItem = (sale['Item Name'] || sale.item || '').toLowerCase();
            let saleQty = parseFloat(sale.quantity) || parseFloat(sale.qty) || 0;

            if (!saleItem || saleQty <= 0) return;

            // Find matching batches (earliest first)
            const matches = stockList.filter(s => {
                const sName = (s['Item Name'] || s.item || '').toLowerCase();
                return sName === saleItem || sName.includes(saleItem) || saleItem.includes(sName);
            });

            // Subtract from batches
            for (let batch of matches) {
                if (saleQty <= 0) break;

                let batchQty = parseFloat(batch['Quantity'] || batch.qty || batch.quantity) || 0;

                if (batchQty > 0) {
                    if (batchQty >= saleQty) {
                        batchQty -= saleQty;
                        saleQty = 0;
                    } else {
                        saleQty -= batchQty;
                        batchQty = 0;
                    }
                    // Update the batch object
                    batch['Quantity'] = batchQty; // Unified key for display
                    batch.qty = batchQty;
                }
            }
        });

        // Filter out fully sold out items? User said "Available Inventory".
        // Usually yes, but user wants to "Maintain... to save & show".
        // If I hide 0 qty, I hide the record.
        // Let's hide 0 qty items to keep "Inventory" clean.
        stockList = stockList.filter(item => {
            const q = parseFloat(item['Quantity'] || item.qty || item.quantity);
            return q > 0;
        });

        if (stockList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #666;">No stock data available</td></tr>';
            return;
        }

        tbody.innerHTML = stockList.map(item => {
            // Keys: Date, Category, Vendor, Item Name, Brand, Quantity, Unit Price, Total, Paid, Mode, Balance
            const get = (k, alt) => item[k] || item[alt] || item[k.toLowerCase()] || '-';
            const getNum = (k, alt) => item[k] !== undefined ? item[k] : (item[alt] !== undefined ? item[alt] : 0);

            let d = get('Date', 'date');
            if (d.includes('T')) d = d.split('T')[0];

            return `
                <tr>
                    <td>${d}</td>
                    <td>${get('Category', 'category')}</td>
                    <td>${get('Vendor', 'vendor')}</td>
                    <td>${get('Item Name', 'item')}</td>
                    <td>${get('Brand', 'brand')}</td>
                    <td>${get('Model', 'model')}</td>
                    <td style="font-weight: bold; color: #22c55e;">${getNum('Quantity', 'qty')}</td>
                    <td>${getNum('Unit Price', 'price')}</td>
                    <td>${getNum('Total', 'total')}</td>
                    <td>${getNum('Paid', 'paid')}</td>
                    <td>${get('Mode', 'mode')}</td>
                    <td>${getNum('Balance', 'balance')}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Error loading inventory stock", e);
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: red;">Error calculating stock</td></tr>';
    }
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

        // Handle potential GS response wrapper {success: false, message: ...} that might not have categories array
        if (res && res.success === false) {
            console.warn("API returned error for categories:", res.message);
        }

        console.log("Parsed Categories:", categories);

        select.innerHTML = '<option value="">Select Category</option>';

        if (categories.length === 0) {
            // Fallback or warning
            const option = document.createElement("option");
            option.textContent = "No Categories Found";
            option.disabled = true;
            select.appendChild(option);
        } else {
            categories.forEach(cat => {
                const option = document.createElement("option");
                option.value = cat.name;
                option.textContent = cat.name;
                select.appendChild(option);
            });
        }

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
        // Do not alert constantly if init fails, but log it
        // alert("Error loading categories: " + e.message);
        select.innerHTML = '<option value="">Error Loading Categories</option>';
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

    // Dynamic Field Toggling
    setupDynamicPurchaseFields();
}

function setupDynamicPurchaseFields() {
    const catSelect = document.getElementById('purCategorySelect');
    const genSelect = document.getElementById('purGen');

    if (catSelect) {
        catSelect.addEventListener('change', () => {
            const cat = catSelect.value;
            const isLaptop = cat === 'Laptop';
            const isCharger = cat === 'Charger' || cat === 'Laptop Chargers';
            const isKbMouse = cat === 'Keyboard & Mouse';

            // 1. Reset all Standard fields to default (Visible)
            document.querySelectorAll('.group-standard').forEach(el => el.classList.remove('hidden'));

            // 2. Hide specific groups based on selection
            if (isLaptop) {
                document.querySelectorAll('.group-standard').forEach(el => el.classList.add('hidden'));
            } else if (isCharger || isKbMouse) {
                // For Charger/KbMouse: Hide Item Name (Standard), but Keep Brand (Standard)
                // We need to target the parent div of 'purItem' specifically
                const itemInput = document.getElementById('purItem');
                if (itemInput && itemInput.closest('.form-group')) {
                    itemInput.closest('.form-group').classList.add('hidden');
                }
            }

            // 3. Toggle Specialized Groups
            document.querySelectorAll('.group-laptop').forEach(el => isLaptop ? el.classList.remove('hidden') : el.classList.add('hidden'));
            document.querySelectorAll('.group-charger').forEach(el => isCharger ? el.classList.remove('hidden') : el.classList.add('hidden'));
            document.querySelectorAll('.group-kbmouse').forEach(el => isKbMouse ? el.classList.remove('hidden') : el.classList.add('hidden'));

            // 4. Toggle Required Attributes
            const purItem = document.getElementById('purItem');
            if (purItem) {
                // Item Name is required ONLY if NOT Laptop AND NOT Charger AND NOT KbMouse
                if (isLaptop || isCharger || isKbMouse) {
                    purItem.removeAttribute('required');
                } else {
                    purItem.setAttribute('required', 'true');
                }
            }

            // 5. Reset Sub-groups
            if (!isLaptop) document.querySelectorAll('.group-chromebook').forEach(el => el.classList.add('hidden'));

            // 6. Trigger Gen check if visible
            if (isLaptop && genSelect) genSelect.dispatchEvent(new Event('change'));

            // 7. Update Recent Purchases Table Layout based on category
            if (typeof loadRecentPurchases === 'function') loadRecentPurchases();
        });
    }

    if (genSelect) {
        genSelect.addEventListener('change', () => {
            const isChromebook = genSelect.value === 'Chromebook';
            document.querySelectorAll('.group-chromebook').forEach(el => isChromebook ? el.classList.remove('hidden') : el.classList.add('hidden'));
        });
    }
}

// ... calcBalance ...

// ... Helpers ...
function getItemName() {
    const cat = document.getElementById('purCategorySelect').value;
    const brand = document.getElementById('purBrand').value || '';

    if (cat === 'Laptop') {
        const model = document.getElementById('purModel').value || '';
        return `${brand} ${model}`.trim();
    } else if (cat === 'Charger' || cat === 'Laptop Chargers') {
        const volt = document.getElementById('purVolt').value || '';
        return `${brand} Charger ${volt}`.trim();
    } else if (cat === 'Keyboard & Mouse') {
        const type = document.getElementById('purKbType').value || 'Keyboard & Mouse';
        // Check if Brand is already part of type or needed
        return `${brand} ${type}`.trim();
    } else {
        return document.getElementById('purItem').value;
    }
}

function getBrandName() {
    return document.getElementById('purBrand').value;
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
            // Updated to use the consistent header names requested
            'Item Name': getItemName(),
            'Brand': getBrandName(),
            'Model': document.getElementById('purModel').value,
            'Quantity': document.getElementById('purQty').value,
            'Unit Price': document.getElementById('purPrice').value,
            'Total': document.getElementById('purTotal').value,
            'Paid': document.getElementById('purPaid').value,
            'Mode': document.getElementById('purMode').value,
            'Balance': document.getElementById('purBalance').value,

            // Allow backward compatibility or detailed fields if needed by backend (though user requested specific titles)
            // We map the main ones above to match the sheet headers directly.
            // Also sending lowercase keys just in case API checks them.
            item: getItemName(),
            brand: getBrandName(),
            qty: document.getElementById('purQty').value,
            price: document.getElementById('purPrice').value,
            total: document.getElementById('purTotal').value,
            paid: document.getElementById('purPaid').value,
            mode: document.getElementById('purMode').value,
            balance: document.getElementById('purBalance').value,

            // Extra Fields
            generation: document.getElementById('purGen').value,
            model: document.getElementById('purModel').value,
            ram: document.getElementById('purGen').value ? document.getElementById('purRam').value : '',
            hdd: document.getElementById('purGen').value ? document.getElementById('purHdd').value : '',
            display: document.getElementById('purGen').value ? document.getElementById('purDisplay').value : '',
            touch: document.getElementById('purGen').value ? document.getElementById('purTouch').value : '',
            updateDate: document.getElementById('purUpdate').value,
            volt: document.getElementById('purVolt').value
        };

        try {
            const res = await API.saveInventory(purchaseData);

            if (res.status === 'success' || res.success) {
                alert('Purchase recorded successfully!');

                // Refresh Table
                loadRecentPurchases();

                // Keep category selected for convenience? Or reset all? User often enters multiple similar items.
                // Let's reset but maybe keep category if possible. For now full reset.
                purchaseForm.reset();
                document.getElementById('purDate').value = new Date().toISOString().split('T')[0]; // Reset Date

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
// Handling Sales Form Submit
function setupSalesForm() {
    const salesForm = document.getElementById('salesForm');
    if (!salesForm) return;

    // specific fix: set date to today
    const saleDate = document.getElementById('saleDate');
    if (saleDate) saleDate.value = new Date().toISOString().split('T')[0];

    // Helper for calculations
    const calcSaleTotal = () => {
        const qty = parseFloat(document.getElementById('saleQty').value) || 0;
        const price = parseFloat(document.getElementById('salePrice').value) || 0;
        const total = qty * price;
        document.getElementById('saleTotal').value = total;
        calcSaleBalance();
    };

    const calcSaleBalance = () => {
        const total = parseFloat(document.getElementById('saleTotal').value) || 0;
        const paid = parseFloat(document.getElementById('salePaid').value) || 0;
        const balance = total - paid;
        document.getElementById('saleBalance').value = balance;
    };

    // Attach listeners
    ['saleQty', 'salePrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', calcSaleTotal);
    });

    const paidInput = document.getElementById('salePaid');
    if (paidInput) paidInput.addEventListener('input', calcSaleBalance);

    salesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = salesForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        const salesData = {
            date: document.getElementById('saleDate').value,
            item: document.getElementById('saleItem').value,
            qty: document.getElementById('saleQty').value,
            customer: document.getElementById('saleCustomer').value,
            price: document.getElementById('salePrice').value,
            total: document.getElementById('saleTotal').value,
            paid: document.getElementById('salePaid').value,
            mode: document.getElementById('saleMode').value,
            balance: document.getElementById('saleBalance').value
        };

        try {
            const res = await API.saveSale(salesData);
            if (res.status === 'success' || res.success) {
                alert('Sale recorded successfully!');
                salesForm.reset();
                if (saleDate) saleDate.value = new Date().toISOString().split('T')[0];
                loadRecentSales();
                refreshDashboard();
            } else {
                alert('Error recording sale: ' + (res.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error connecting to server.');
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    });

    // Initial Load of Sales Table
    loadRecentSales();

    // Initial Load of Items
    loadSaleItems();
}

async function loadRecentSales() {
    const tbody = document.getElementById('recentSalesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading...</td></tr>';

    try {
        const sales = await API.getSales();
        // Show recent last (or reverse?) - usually recent top.
        // Assuming API returns chronological, we reverse.
        const recent = sales.slice(-20).reverse();

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #666;">No entries yet</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(item => {
            const get = (k, alt) => item[k] || item[alt] || item[k.toLowerCase()] || '-';
            const getNum = (k, alt) => item[k] !== undefined ? item[k] : (item[alt] !== undefined ? item[alt] : 0);

            let d = get('Date', 'date');
            if (d && d.includes('T')) d = d.split('T')[0];

            // Mapping: Date, Customer, Item, Price, Qty, Total, Paid, Mode, Balance
            return `
                <tr>
                    <td>${d}</td>
                    <td>${get('Customer Name', 'customer')}</td>
                    <td>${get('Item Name', 'item')}</td>
                    <td>${getNum('Unit Price', 'price')}</td>
                    <td style="font-weight: bold; color: #22c55e;">${getNum('Quantity', 'qty')}</td>
                    <td>${getNum('Total Amount', 'total')}</td>
                    <td>${getNum('Amount Paid', 'paid')}</td>
                    <td>${get('Payment Mode', 'mode')}</td>
                    <td>${getNum('Balance', 'balance')}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Error loading sales", e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error loading data</td></tr>';
    }
}

async function loadSaleItems() {
    const itemSelect = document.getElementById('saleItem');
    if (!itemSelect) return;

    // Optional: Only load if empty? Or reload to get fresh data?
    // Let's reload to be safe, but keep 'Select Item'
    itemSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        const items = await API.getInventory();

        // Handle if API returns error wrapper
        if (items.success === false) {
            console.error("Failed to load inventory for dropdown", items.message);
            itemSelect.innerHTML = '<option value="">Error loading items</option>';
            return;
        }

        // Keys might be 'item name', 'item', 'name' depending on sheet headers and helpers
        // We know sheet header is 'Item Name', converted to 'item name' by helper
        const uniqueItems = [...new Set(items.map(i => i['item name'] || i.item || i['Item Name'] || i.name))].filter(Boolean).sort();

        itemSelect.innerHTML = '<option value="">Select Item</option>';

        if (uniqueItems.length === 0) {
            const opt = document.createElement('option');
            opt.innerText = "No items found in Inventory";
            itemSelect.appendChild(opt);
        }

        uniqueItems.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            itemSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Error loading sale items", e);
        itemSelect.innerHTML = '<option value="">Error loading items</option>';
    }
}

// Handling Expenses Form
function setupExpensesForm() {
    const expenseForm = document.getElementById('expenseForm');
    if (!expenseForm) return;

    // Load expenses on init
    loadRecentExpenses();

    // Dynamic Label/Placeholder Logic
    const expTitle = document.getElementById('expTitle');
    const expDesc = document.getElementById('expDesc');
    // Find the label associated with expDesc (it's the previous sibling element usually, or inside the parent div)
    const expDescLabel = expDesc ? expDesc.previousElementSibling : null;

    if (expTitle && expDesc && expDescLabel) {
        expTitle.addEventListener('change', () => {
            const val = expTitle.value;
            if (val === 'Salary') {
                expDescLabel.textContent = 'Person Name';
                expDesc.placeholder = 'Enter Person Name';
                expDesc.required = true;
            } else if (val === 'Daily Expense') {
                expDescLabel.textContent = 'Sub Title';
                expDesc.placeholder = 'Lunch, Tea, etc.';
                expDesc.required = false;
            } else if (val === 'Daily Wages') {
                expDescLabel.textContent = 'Worker Name/Details';
                expDesc.placeholder = 'Worker Details...';
                expDesc.required = false;
            } else {
                expDescLabel.textContent = 'Description (Optional)';
                expDesc.placeholder = 'Details...';
                expDesc.required = false;
            }
        });
    }

    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = expenseForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        const expenseData = {
            date: document.getElementById('expDate').value || new Date().toISOString().split('T')[0],
            title: document.getElementById('expTitle').value,
            description: document.getElementById('expDesc').value || '',
            amount: document.getElementById('expAmount').value,
            mode: document.getElementById('expMode').value
        };

        if (!expenseData.title) {
            alert("Please select an Expense Title");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        try {
            const res = await API.saveExpense(expenseData);
            if (res.status === 'success' || res.success) {
                alert('Expense saved successfully!');
                expenseForm.reset();
                // Set date back to today
                document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
                loadRecentExpenses();
                if (typeof refreshDashboard === 'function') refreshDashboard();
            } else {
                alert('Error saving expense: ' + (res.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error connecting to server.');
        }

        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}

async function loadRecentExpenses() {
    const tbody = document.getElementById('recentExpensesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>';

    try {
        const expenses = await API.getExpenses();
        const recent = expenses.slice(-5).reverse();

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">No entries yet</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(item => {
            // Helper to try multiple keys
            const get = (k) => item[k] || item[k.toLowerCase()] || item[k.toUpperCase()] || item[k.charAt(0).toUpperCase() + k.slice(1)] || '-';

            let d = get('Date') || get('date') || '-';
            if (typeof d === 'string' && d.includes('T')) d = d.split('T')[0];

            // Specific check for Title which might be 'Expense Title' in some versions
            const title = item.title || item.Title || item['Expense Title'] || item['expense title'] || '-';
            const amount = item.amount || item.Amount || 0;
            const mode = item.mode || item.Mode || get('Payment Mode') || '-';

            return `
                <tr>
                    <td>${d}</td>
                    <td>${title}</td>
                    <td>${amount}</td>
                    <td>${mode}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Error loading expenses", e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error loading data</td></tr>';
    }
}

// 8. Load Broadcasts
async function loadBroadcasts() {
    try {
        const res = await API.getBroadcasts();
        const container = document.getElementById('broadcastContainer');
        const textContainer = document.getElementById('broadcastText');

        if (!container || !textContainer) return;

        if (res.success && res.broadcasts && res.broadcasts.length > 0) {
            console.log("Broadcasts found:", res.broadcasts.length);
            const messages = res.broadcasts.map(b => {
                return `<span style="margin-right: 4rem;">
                  <span style="color: #eab308; font-weight: bold;">${b.userName}:</span> ${b.message}
               </span>`;
            }).join('');

            textContainer.innerHTML = messages;
            container.classList.remove('hidden');
        } else {
            console.warn("No active broadcasts found or API error", res);
            container.classList.add('hidden');
        }
    } catch (e) {
        console.error("Error loading broadcasts", e);
    }
}