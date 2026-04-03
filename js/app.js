// app.js - Optimized & Fixed Logic

let userCustomHeaders = null; // Global variable to store custom headers

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return; // Stop if not authenticated

    await loadCustomHeaders(); // Wait for headers before rendering

    // Setup global layout interactions
    setupMobileSidebar();
    loadBroadcasts();
    loadBanners();
    checkDeploymentVersion();

    // Dynamically load data based on the current page to prevent missing DOM element errors
    const path = window.location.pathname.toLowerCase();

    if (path.includes('dashboard.html') || path.endsWith('/')) {
        loadDashboardData();
    } else if (path.includes('inventory.html')) {
        loadInventory();
        // Need user categories for the edit modal
        loadUserCategories();
        setupPurchaseCalculations();
    } else if (path.includes('purchase.html')) {
        loadUserCategories();
        setupPurchaseCalculations();
        if (typeof loadRecentPurchases === 'function') loadRecentPurchases();
    } else if (path.includes('sales.html')) {
        setupSalesForm();
        if (typeof loadRecentSales === 'function') loadRecentSales();
    } else if (path.includes('expenses.html')) {
        setupExpensesForm();
        if (typeof loadRecentExpenses === 'function') loadRecentExpenses();
    }
});

// 0. LOAD CUSTOM HEADERS
async function loadCustomHeaders() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || user.role === 'admin') return; // Admins see everything, or mock logic based on requirement

        const headersData = await API.getInventoryHeaders();
        const userHeaders = headersData.find(h =>
            String(h.username).toLowerCase() === String(user.username).toLowerCase()
        );

        // In Google Sheets, column headers might arrive as 'headers', 'Headers', or 'HEADERS' due to `getSheetData` casing rules
        const rawHeadersString = userHeaders ? (userHeaders.headers || userHeaders.Headers || userHeaders.HEADERS) : null;

        if (rawHeadersString) {
            let parsedHeaders = [];
            try {
                if (typeof rawHeadersString === 'string') {
                    // Strip any accidental leading/trailing quotes around the bracket
                    let cleanStr = rawHeadersString.trim();
                    if (cleanStr.startsWith('"[')) cleanStr = cleanStr.substring(1, cleanStr.length - 1);
                    // Fix escaped quotes
                    cleanStr = cleanStr.replace(/\\"/g, '"');
                    // Replace single quotes with double quotes for valid JSON
                    cleanStr = cleanStr.replace(/'/g, '"');
                    parsedHeaders = JSON.parse(cleanStr);
                } else if (Array.isArray(rawHeadersString)) {
                    parsedHeaders = rawHeadersString;
                }
            } catch (e) {
                console.error("Failed to parse user headers in app.js", e);
                parsedHeaders = [];
            }

            if (parsedHeaders && parsedHeaders.length > 0) {
                window.userCustomHeaders = parsedHeaders;
                applyCustomHeadersToUI();
            }
        }
    } catch (e) {
        console.error("Failed to load custom headers", e);
    }
}

function applyCustomHeadersToUI() {
    if (!window.userCustomHeaders) return;

    // 1. Update Purchase Form UI: Hide standard, show dynamic
    const standardGroups = document.querySelectorAll('#purchaseForm .form-group:not(.group-standard, #dynamicPurchaseFields)');
    // We will handle hiding more precisely inside setupPurchaseCalculations or via CSS if needed.
    // Cleanest way: hide all category/brand/model things in the purchase form.
    const purCat = document.getElementById('purCategorySelect');
    if (purCat) purCat.closest('.form-group').style.display = 'none';

    const purVendor = document.getElementById('purVendor');
    if (purVendor) purVendor.closest('.form-group').style.display = 'none';

    const purItem = document.getElementById('purItem');
    if (purItem) purItem.closest('.form-group').style.display = 'none';

    const purBrand = document.getElementById('purBrand');
    if (purBrand) purBrand.closest('.form-group').style.display = 'none';

    // Also hide laptop/chromebook/charger standard groups just in case
    const specializedGroups = document.querySelectorAll('.group-laptop, .group-chromebook, .group-kbmouse, .group-charger');
    specializedGroups.forEach(g => g.style.display = 'none');

    // Hide Unit Price and Quantity for custom header form to let the total be typed or calculated based on headers?
    // Actually, user standard flow typically might still use Price/Qty, but instructions were to "replace general data".
    // Let's replace ONLY item specifics and KEEP Financials (Row 3, Row 4).

    // Render dynamic fields
    const dynamicContainer = document.getElementById('dynamicPurchaseFields');
    if (dynamicContainer) {
        dynamicContainer.innerHTML = window.userCustomHeaders.map((header, index) => `
            <div class="form-group custom-purchase-field">
                <label style="font-size: 0.8rem; margin-bottom: 0.2rem;">${header}</label>
                <input type="text" class="form-input custom-input-val" data-header="${header}" placeholder="Enter ${header}" style="padding: 0.25rem; font-size: 0.85rem;" required>
            </div>
        `).join('');
    }
}

// 1. MOBILE SIDEBAR NAVIGATION
function setupMobileSidebar() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        });

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });
        }
    }
}

// 2. EXCEL UPLOAD LOGIC (Cleaned & Consolidated)
async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            let allJsonData = [];

            const batchName = file.name.replace(/\.[^/.]+$/, "");
            if (!batchName) return; // Cancel import if no batch name provided

            // Iterate over all sheets in the Excel file
            workbook.SheetNames.forEach(sheetName => {
                const rawSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

                const normalizedSheetData = rawSheetData.map(row => {
                    // Start with the exact data the user uploaded
                    const normalizedRow = { ...row };

                    // Inject the user's manual batch name
                    normalizedRow['batch'] = batchName;

                    return normalizedRow;
                });

                allJsonData = allJsonData.concat(normalizedSheetData);
            });

            console.log("Total Final JSON payload for Bulk Save:", allJsonData); // DEBUG

            if (allJsonData.length === 0) {
                alert("Excel file is empty!");
                return;
            }

            if (confirm(`Import ${allJsonData.length} items from ${workbook.SheetNames.length} sheet(s) to Google Sheets?`)) {
                // Ensure we use the correct backend action endpoint for importing
                // Attach the user so they own their imported rows
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const response = await fetch(API.getUrl() || window.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'bulkSaveInventory', // Match Code.gs action name
                        username: user.username,
                        data: allJsonData
                    })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    alert("Import Successful!");
                    location.reload();
                } else {
                    alert("Error: " + result.message);
                }
            }
        } catch (error) {
            console.error("Excel Error:", error);
            alert("Failed to process Excel file.");
        }
    };
    reader.readAsArrayBuffer(file);
}

// 3. RENDER INVENTORY (Dynamic JSON based)
async function loadInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    const headerRow = document.getElementById('inventoryHeaderRow');
    if (!tbody || !headerRow) return;

    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;">Loading Inventory Data...</td></tr>';

    try {
        const inventory = await API.getInventory();

        // Ensure headers are loaded
        if (!window.userCustomHeaders || window.userCustomHeaders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;">No custom headers found for your account. Please set them up in Admin.</td></tr>';
            return;
        }

        // 1. Render Headers
        headerRow.innerHTML = window.userCustomHeaders.map(h => 
            `<th style="padding: 1rem 1.5rem; white-space: nowrap; text-align: center;">${h}</th>`
        ).join('') + `<th style="padding: 1rem 1.5rem; white-space: nowrap; text-align: center;">Action</th>`;

        // Extract unique batch IDs and populate dropdown
        const batchSelect = document.getElementById('batchFilterSelect');
        if (batchSelect) {
            const uniqueBatches = [...new Set(inventory.map(item => item.batch || item.batchid || 'Manual'))];
            batchSelect.innerHTML = `<option value="All">All Batches</option>` + uniqueBatches.map(b => `<option value="${b}">${b}</option>`).join('');
        }

        // 2. Render Rows
        if (inventory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${window.userCustomHeaders.length + 1}" style="text-align:center;">No items found.</td></tr>`;
            return;
        }

        tbody.innerHTML = inventory.map((item, index) => {
            // Data is primarily in the root of the parsed JSON from Code.gs
            // If the item had a "data" string, it's already mapped, but let's check customData or just root properties
            let rowData = item;
            try {
                // If it's stored in a "data" JSON string in 'customdata' or root level, try to extract it
                if (typeof item.data === 'string') rowData = JSON.parse(item.data);
                else if (typeof item.customData === 'string') rowData = JSON.parse(item.customData);
                else if (typeof item.customdata === 'string') rowData = JSON.parse(item.customdata);
            } catch(e) {}

            const rowCells = window.userCustomHeaders.map(header => {
                const searchKey = header.toLowerCase().trim();
                let cellValue = '-';
                
                // Flexible property search (case-insensitive)
                for (let prop in rowData) {
                    if (prop.toLowerCase().trim() === searchKey) {
                        cellValue = rowData[prop];
                        break;
                    }
                }
                
                return `<td style="padding: 1rem 1.5rem; white-space: nowrap; text-align: center;">${cellValue}</td>`;
            }).join('');

            const editId = item.id || item.batchid || (index + 1);
            const batchIdAttr = item.batch || item.batchid || 'Manual';

            return `<tr style="color: white;" data-id="${editId}" data-batch="${batchIdAttr}">
                        ${rowCells}
                        <td style="padding: 1rem 1.5rem; white-space: nowrap; text-align: center;">
                            <button class="btn btn-sm" style="background: #3b82f6; border-radius: 4px; padding: 0.4rem 0.8rem;" onclick="document.getElementById('searchEditId').value='${editId}'; searchInventoryForEdit();">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>
                        </td>
                    </tr>`;
        }).join('');

    } catch (e) {
        console.error("Inventory Render Error:", e);
        tbody.innerHTML = '<tr><td colspan="15" style="color:red;">Error loading inventory.</td></tr>';
    }
}

// 3.5 EDIT INVENTORY LOGIC (Dynamic Form Generation)
async function searchInventoryForEdit() {
    const searchId = document.getElementById('searchEditId').value.trim();
    if (!searchId) return alert("Please enter an Inventory ID to search.");

    try {
        const inventory = await API.getInventory();
        let item = inventory.find(i => String(i.id) === searchId || String(i.batchid) === searchId);
        if (!item) {
            const idx = parseInt(searchId);
            if (!isNaN(idx) && idx > 0 && idx <= inventory.length) {
                item = inventory[idx - 1];
            }
        }

        if (!item) return alert("Item not found!");

        const form = document.getElementById('editInventoryForm');
        const container = document.getElementById('editDynamicFieldsContainer');
        form.classList.remove('hidden');
        form.dataset.editId = item.id || searchId;
        form.dataset.batchId = item.batchid || ''; 

        if (!window.userCustomHeaders) return alert("No custom headers loaded.");

        let rowData = item;
        try {
            if (typeof item.data === 'string') rowData = JSON.parse(item.data);
            else if (typeof item.customData === 'string') rowData = JSON.parse(item.customData);
            else if (typeof item.customdata === 'string') rowData = JSON.parse(item.customdata);
        } catch(e) {}

        const escapeHTML = (str) => { if (str == null) return ''; return String(str).replace(/"/g, '&quot;'); };

        container.innerHTML = window.userCustomHeaders.map(header => {
            const searchKey = header.toLowerCase().trim();
            let cellValue = '';
            
            for (let prop in rowData) {
                if (prop.toLowerCase().trim() === searchKey) {
                    cellValue = rowData[prop];
                    break;
                }
            }

            return `
            <div class="form-group custom-edit-field">
                <label style="font-size: 0.8rem; margin-bottom: 0.2rem;">${header}</label>
                <input type="text" class="form-input custom-edit-val" data-header="${header}" value="${escapeHTML(cellValue)}" style="padding: 0.25rem; font-size: 0.85rem;" required>
            </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Search failed:", e);
        alert("Error searching inventory.");
    }
}

async function submitEditInventory() {
    const form = document.getElementById('editInventoryForm');
    const editId = form.dataset.editId;
    if (!editId) return;

    const updateData = { id: editId };
    if (form.dataset.batchId) updateData.batchid = form.dataset.batchId;

    if (window.userCustomHeaders && window.userCustomHeaders.length > 0) {
        let customDataObj = {};
        document.querySelectorAll('.custom-edit-val').forEach(input => {
            const headerName = input.getAttribute('data-header').toLowerCase().trim();
            customDataObj[headerName] = input.value;
        });
        updateData.customData = JSON.stringify(customDataObj);
    } else {
        alert("Error: Custom headers not loaded, cannot save data securely.");
        return;
    }

    const btn = document.getElementById('btnUpdateInventory');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
    btn.disabled = true;

    try {
        const result = await API.updateInventory(updateData);
        if (result.status === 'success') {
            alert('Inventory Updated Successfully!');
            form.classList.add('hidden');
            loadInventory(); // refresh table
            if (typeof refreshDashboard === 'function') refreshDashboard(); 
        } else {
            alert('Update failed: ' + result.message);
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred during update.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Global function to trigger edit (placeholder for future implementation)
window.editInventoryItem = function (itemId) {
    console.log("Edit requested for InventoryItem ID/Index:", itemId);
    alert("Edit functionality for Inventory Item " + itemId + " will be implemented here. It could open the Purchase modal pre-filled with this item's data.");
};

// 4. DASHBOARD REFRESH (Fixed Box Logic & Modern Bars)
async function refreshDashboard() {
    try {
        const inventory = await API.getInventory();
        const sales = await API.getSales();

        // Stats Calculation
        let totalValue = 0;
        inventory.forEach(item => totalValue += (parseFloat(item.total) || 0));

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentYearMonth = todayStr.substring(0, 7); // e.g., "2026-02"

        let salesToday = 0;
        let salesMonth = 0; // SOP (Month)

        sales.forEach(s => {
            const sTotal = parseFloat(s.total) || 0;
            if (s.date && s.date.includes(todayStr)) salesToday += sTotal;
            if (s.date && s.date.startsWith(currentYearMonth)) salesMonth += sTotal;
        });

        // Update UI Text
        const valEl = document.getElementById('dTotalValue');
        const prodEl = document.getElementById('dTotalProducts');
        const saleEl = document.getElementById('dSalesToday');
        const sopEl = document.getElementById('dSoPMonth');

        if (valEl) valEl.innerText = 'Rs. ' + totalValue.toLocaleString();
        if (prodEl) prodEl.innerText = inventory.length;
        if (saleEl) saleEl.innerText = 'Rs. ' + salesToday.toLocaleString();
        if (sopEl) sopEl.innerText = 'Rs. ' + salesMonth.toLocaleString();

        // Animate Progress Bars (Relative visual indicators)
        // Set some arbitrary "targets" to make the bars look dynamic and attractive
        const valMax = totalValue > 0 ? (totalValue * 1.5) : 500000;
        const prodMax = inventory.length > 0 ? (inventory.length * 1.2) : 1000;
        const todayMax = salesToday > 0 ? (salesToday * 2) : 50000;
        const monthMax = salesMonth > 0 ? (salesMonth * 1.5) : 250000;

        const valPct = Math.min((totalValue / valMax) * 100, 100) || 10; // At least 10% for visual
        const prodPct = Math.min((inventory.length / prodMax) * 100, 100) || 10;
        const todayPct = Math.min((salesToday / todayMax) * 100, 100) || 10;
        const monthPct = Math.min((salesMonth / monthMax) * 100, 100) || 10;

        setTimeout(() => {
            const barVal = document.getElementById('dTotalValueBar');
            const barProd = document.getElementById('dTotalProductsBar');
            const barToday = document.getElementById('dSalesTodayBar');
            const barSop = document.getElementById('dSoPMonthBar');

            if (barVal) barVal.style.width = valPct + '%';
            if (barProd) barProd.style.width = prodPct + '%';
            if (barToday) barToday.style.width = todayPct + '%';
            if (barSop) barSop.style.width = monthPct + '%';
        }, 100);

        // Initialize Phara UI Charts
        initPharaCharts();

    } catch (e) {
        console.warn("Dashboard stats failed to load.", e);
    }
}

let pharaSalesChartInstance = null;
let pharaInvChartInstance = null;
let pharaUsersChartInstance = null;

function initPharaCharts() {
    // Total Sale (Bar Chart)
    const salesCtx = document.getElementById('pharaSalesChart');
    if (salesCtx) {
        if (pharaSalesChartInstance) pharaSalesChartInstance.destroy();

        const isMobile = window.innerWidth <= 768;
        const labels = isMobile ? ['Today'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const data = isMobile ? [18] : [8, 16, 8, 10, 3, 14, 18];
        const bgColors = isMobile ? ['#3b82f6'] : [
            '#3b82f6', '#3b82f6', '#3b82f6',
            '#0f172a', // The dark highlighted bar
            '#3b82f6', '#3b82f6', '#3b82f6'
        ];

        pharaSalesChartInstance = new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sales',
                    data: data, // Mock data to match visual
                    backgroundColor: bgColors,
                    borderRadius: 6,
                    barThickness: 24
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#94a3b8', font: { size: 10 },
                            callback: function (value) { return 'Rs ' + (value) + 'K'; }
                        },
                        beginAtZero: true,
                        max: 20
                    }
                }
            }
        });
    }

    // Credit / Udhaar Tracking (Bar Chart)
    const creditCtx = document.getElementById('pharaCreditChart');
    if (creditCtx) {
        if (pharaUsersChartInstance) pharaUsersChartInstance.destroy();
        pharaUsersChartInstance = new Chart(creditCtx, {
            type: 'bar',
            data: {
                labels: ['Total Credit'],
                datasets: [{
                    label: 'Credit (Rs)',
                    data: [150000], // Mock total credit
                    backgroundColor: ['#8b5cf6'],
                    borderRadius: 6,
                    barThickness: 24
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            callback: function (value) { return 'Rs ' + (value / 1000) + 'K'; }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Inventory status (Doughnut Chart)
    const invCtx = document.getElementById('pharaInventoryChart');
    if (invCtx) {
        if (pharaInvChartInstance) pharaInvChartInstance.destroy();
        pharaInvChartInstance = new Chart(invCtx, {
            type: 'doughnut',
            data: {
                labels: ['Total product', 'Out of stock', 'Return', 'Expire'],
                datasets: [{
                    data: [45, 15, 20, 20],
                    backgroundColor: ['#1e293b', '#ef4444', '#8b5cf6', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Thin ring
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#cbd5e1', usePointStyle: true, boxWidth: 8, font: { size: 11 } }
                    }
                }
            }
        });
    }
}

// 5. AUTH & LOGOUT
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '../index.html';
        return false;
    }
    const nameDisplay = document.getElementById('userNameDisplay');
    if (nameDisplay) {
        nameDisplay.textContent = user.name || user.username;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('user');
            localStorage.removeItem('currentUser');
            window.location.href = '../index.html';
        });
    }

    return true;
}

window.openChangePassword = function () {
    document.getElementById('cpOld').value = '';
    document.getElementById('cpNew').value = '';
    document.getElementById('cpConfirm').value = '';
    document.getElementById('changePasswordModal').classList.remove('hidden');
};

window.submitChangePassword = async function () {
    const oldPass = document.getElementById('cpOld').value;
    const newPass = document.getElementById('cpNew').value;
    const confirmPass = document.getElementById('cpConfirm').value;

    if (newPass !== confirmPass) {
        alert("New passwords do not match!");
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.username) return;

    try {
        const res = await API.changePassword(user.username, oldPass, newPass);
        if (res.status === 'success') {
            alert("Password updated successfully. Please login again.");
            localStorage.removeItem('user');
            window.location.href = '../index.html';
        } else {
            alert(res.message || "Failed to update password.");
        }
    } catch (e) {
        console.error(e);
        alert("An error occurred while updating the password.");
    }
};

// --- MOCK / HELPER FUNCTIONS TO PREVENT ERRORS ---
function loadDashboardData() { refreshDashboard(); }
async function loadUserCategories() {
    const select = document.getElementById("purCategorySelect");
    if (!select) return;

    try {
        // Clear current and show loading
        select.innerHTML = '<option value="">Loading Categories...</option>';

        const res = await API.getCategories();

        // Handle different response formats from Google Sheets
        let categories = [];
        if (Array.isArray(res)) {
            categories = res;
        } else if (res && res.categories) {
            categories = res.categories;
        }

        select.innerHTML = '<option value="">Select Category</option>';

        if (categories.length === 0) {
            const opt = document.createElement("option");
            opt.textContent = "No Categories Found";
            opt.disabled = true;
            select.appendChild(opt);
        } else {
            categories.forEach(cat => {
                const option = document.createElement("option");
                // Check if category is an object {name: '...'} or just a string
                const catName = typeof cat === 'object' ? cat.name : cat;
                option.value = catName;
                option.textContent = catName;
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error("Error loading categories:", e);
        select.innerHTML = '<option value="">Error Loading</option>';
    }
}
function setupPurchaseCalculations() {
    const qty = document.getElementById('purQty');
    const price = document.getElementById('purPrice');
    const total = document.getElementById('purTotal');
    const paid = document.getElementById('purPaid');
    const balance = document.getElementById('purBalance');

    function calc() {
        if (!qty || !price || !total || !paid || !balance) return;
        const q = parseFloat(qty.value) || 0;
        const p = parseFloat(price.value) || 0;
        const t = q * p;
        total.value = t;
        const pd = parseFloat(paid.value) || 0;
        balance.value = t - pd;
    }

    if (qty) qty.addEventListener('input', calc);
    if (price) price.addEventListener('input', calc);
    if (paid) paid.addEventListener('input', calc);

    // Set default date
    const dDate = document.getElementById('purDate');
    if (dDate) dDate.value = new Date().toISOString().split('T')[0];

    const form = document.getElementById('purchaseForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const ogText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            try {
                let payload = {};

                // Shared fields
                payload.date = document.getElementById('purDate').value;
                payload.qty = document.getElementById('purQty').value || 1;
                payload.price = document.getElementById('purPrice').value || 0;
                payload.total = document.getElementById('purTotal').value || 0;
                payload.paid = document.getElementById('purPaid').value || 0;
                payload.balance = document.getElementById('purBalance').value || 0;
                payload.mode = document.getElementById('purMode').value || 'Cash';

                if (window.userCustomHeaders && window.userCustomHeaders.length > 0) {
                    // Custom Data Mode
                    let customDataObj = {};
                    document.querySelectorAll('.custom-input-val').forEach(inp => {
                        customDataObj[inp.getAttribute('data-header')] = inp.value;
                    });

                    // Fallback visual identifiers for the backend/table mixing
                    payload.item = customDataObj[window.userCustomHeaders[0]] || 'Custom Item';
                    payload.category = 'Custom';
                    payload.vendor = 'Custom';
                    payload.customData = JSON.stringify(customDataObj);
                } else {
                    // Standard Form Mode
                    payload.category = document.getElementById('purCategorySelect').value;
                    payload.vendor = document.getElementById('purVendor').value;
                    payload.item = document.getElementById('purItem').value;
                    payload.brand = document.getElementById('purBrand').value || '';
                    payload.model = document.getElementById('purModel').value || '';
                    // Depending on category, you'd collect the specialized fields here.
                    // Simplified for brevity, standard payload:
                }

                const res = await API.saveInventory(payload);
                if (res.status === 'success') {
                    alert('Purchase saved successfully!');
                    form.reset();
                    if (dDate) dDate.value = new Date().toISOString().split('T')[0];
                    refreshDashboard();
                    loadInventory();
                    loadRecentPurchases();
                } else {
                    alert('Failed to save: ' + res.message);
                }
            } catch (err) {
                console.error(err);
                alert("An error occurred while saving.");
            } finally {
                btn.innerHTML = ogText;
                btn.disabled = false;
            }
        });
    }
}

async function loadRecentPurchases() {
    const tbody = document.getElementById('recentPurchasesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Loading recent purchases...</td></tr>';

    try {
        const inventory = await API.getInventory();
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        // Filter last 7 days and sort newest to oldest
        const recent = inventory.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            return itemDate >= sevenDaysAgo;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No purchases in the last 7 days.</td></tr>';
            return;
        }

        // Map to: Date, Product / Item Name, Vendor Name, Quantity, Paid Amount, Balance
        tbody.innerHTML = recent.map(item => {
            const dateStr = item.date ? new Date(item.date).toLocaleDateString() : '-';
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${item.item || '-'}</td>
                    <td>${item.vendor || '-'}</td>
                    <td>${item.qty || '0'}</td>
                    <td>Rs. ${(parseFloat(item.paid) || 0).toLocaleString()}</td>
                    <td style="color: ${parseFloat(item.balance) > 0 ? '#ef4444' : '#22c55e'}">
                        Rs. ${(parseFloat(item.balance) || 0).toLocaleString()}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Error loading recent purchases:", e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load data.</td></tr>';
    }
}

async function loadRecentSales() {
    const tbody = document.getElementById('recentSalesTableBody');
    if (!tbody) return;
    try {
        const sales = await API.getSales();
        if (!sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #666;">No sales found.</td></tr>';
            return;
        }
        tbody.innerHTML = sales.slice(-10).reverse().map(sale => `
            <tr>
                <td>${sale.date ? new Date(sale.date).toLocaleDateString() : '-'}</td>
                <td>${sale.customer || '-'}</td>
                <td>${sale.item || '-'}</td>
                <td>Rs. ${(parseFloat(sale.price) || 0).toLocaleString()}</td>
                <td>${sale.qty || '0'}</td>
                <td>Rs. ${(parseFloat(sale.total) || 0).toLocaleString()}</td>
                <td>Rs. ${(parseFloat(sale.paid) || 0).toLocaleString()}</td>
                <td>${sale.mode || '-'}</td>
                <td style="color: ${parseFloat(sale.balance) > 0 ? '#ef4444' : '#22c55e'}">Rs. ${(parseFloat(sale.balance) || 0).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #ef4444;">Error loading sales.</td></tr>';
    }
}

function setupSalesForm() {
    const qty = document.getElementById('saleQty');
    const price = document.getElementById('salePrice');
    const total = document.getElementById('saleTotal');
    const paid = document.getElementById('salePaid');
    const balance = document.getElementById('saleBalance');
    const itemSelect = document.getElementById('saleItem');
    const sDate = document.getElementById('saleDate');
    const form = document.getElementById('salesForm');

    function calc() {
        if (!qty || !price || !total || !paid || !balance) return;
        const q = parseFloat(qty.value) || 0;
        const p = parseFloat(price.value) || 0;
        const t = q * p;
        total.value = t;
        const pd = parseFloat(paid.value) || 0;
        balance.value = t - pd;
    }

    if (qty) qty.addEventListener('input', calc);
    if (price) price.addEventListener('input', calc);
    if (paid) paid.addEventListener('input', calc);
    if (sDate) sDate.value = new Date().toISOString().split('T')[0];

    async function loadSaleItems() {
        if (!itemSelect) return;
        try {
            const inventory = await API.getInventory();
            itemSelect.innerHTML = '<option value="">Select Item</option>';
            inventory.forEach(item => {
                const qtyVal = parseInt(item.qty) || 0;
                if (qtyVal > 0 || item.qty === undefined || item.qty === null || item.qty === '') {
                    const option = document.createElement('option');
                    option.value = item.item;
                    option.textContent = `${item.item || 'Unknown Item'} (${qtyVal} in stock) - Rs.${item.price || 0}`;
                    option.dataset.price = item.price || 0;
                    itemSelect.appendChild(option);
                }
            });
            itemSelect.addEventListener('change', (e) => {
                const selected = itemSelect.options[itemSelect.selectedIndex];
                if (selected && selected.dataset.price) {
                    price.value = selected.dataset.price;
                    calc();
                }
            });
        } catch (e) {
            console.error(e);
        }
    }
    loadSaleItems();
    loadRecentSales();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const ogText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            try {
                const sale = {
                    date: sDate.value,
                    customer: document.getElementById('saleCustomer').value,
                    item: itemSelect.value,
                    qty: qty.value,
                    price: price.value,
                    total: total.value,
                    paid: paid.value,
                    mode: document.getElementById('saleMode').value,
                    balance: balance.value
                };

                const res = await API.saveSale(sale);
                if (res.status === 'success') {
                    alert('Sale recorded successfully!');
                    form.reset();
                    if (sDate) sDate.value = new Date().toISOString().split('T')[0];
                    if (window.refreshDashboard) window.refreshDashboard();
                    loadRecentSales();
                    loadSaleItems();
                } else {
                    alert('Error: ' + res.message);
                }
            } catch (err) {
                console.error(err);
                alert("An error occurred while saving the sale.");
            } finally {
                btn.innerHTML = ogText;
                btn.disabled = false;
            }
        });
    }
}

async function loadRecentExpenses() {
    const tbody = document.getElementById('recentExpensesTableBody');
    if (!tbody) return;
    try {
        const expenses = await API.getExpenses();
        if (!expenses || expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">No expenses found.</td></tr>';
            return;
        }
        tbody.innerHTML = expenses.slice(-10).reverse().map(exp => `
            <tr>
                <td>${exp.date ? new Date(exp.date).toLocaleDateString() : '-'}</td>
                <td>${exp.title || '-'}</td>
                <td>Rs. ${(parseFloat(exp.amount) || 0).toLocaleString()}</td>
                <td>${exp.mode || '-'}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #ef4444;">Error loading expenses.</td></tr>';
    }
}

function setupExpensesForm() {
    const eDate = document.getElementById('expDate');
    const form = document.getElementById('expenseForm');

    if (eDate) eDate.value = new Date().toISOString().split('T')[0];
    loadRecentExpenses();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const ogText = btn.innerHTML;
            btn.innerHTML = 'Saving...';
            btn.disabled = true;

            try {
                const exp = {
                    date: eDate.value,
                    title: document.getElementById('expTitle').value,
                    desc: document.getElementById('expDesc').value,
                    amount: document.getElementById('expAmount').value,
                    mode: document.getElementById('expMode').value
                };

                const res = await API.saveExpense(exp);
                if (res.status === 'success') {
                    alert('Expense recorded successfully!');
                    form.reset();
                    if (eDate) eDate.value = new Date().toISOString().split('T')[0];
                    loadRecentExpenses();
                } else {
                    alert('Error: ' + res.message);
                }
            } catch (err) {
                console.error(err);
                alert("An error occurred while saving the expense.");
            } finally {
                btn.innerHTML = ogText;
                btn.disabled = false;
            }
        });
    }
}
async function loadBroadcasts() {
    try {
        const broadcasts = await API.getBroadcasts();
        const container = document.getElementById('broadcastContainer');
        const textElement = document.getElementById('broadcastText');

        if (broadcasts && broadcasts.length > 0) {
            // Join all active broadcast messages
            const messages = broadcasts.map(b => `<strong style="color: #f59e0b;">${b.userName}:</strong> <span style="color: #ffffff;">${b.message}</span>`).join(' &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp; ');
            if (textElement) textElement.innerHTML = messages;
            if (container) container.classList.remove('hidden');
        } else {
            if (container) container.classList.add('hidden');
        }
    } catch (e) {
        console.error("Failed to load broadcasts", e);
    }
}

async function loadBanners() {
    try {
        const banners = await API.getBanners();
        const dashboardBanner = banners.find(b => b.type === 'dashboard');

        const container = document.getElementById('dashboardBannerContainer');
        if (container && dashboardBanner && dashboardBanner.url) {
            container.innerHTML = `<img src="${dashboardBanner.url}" alt="Dashboard Banner" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
        }
    } catch (e) {
        console.error("Failed to load banners", e);
    }
}

// ==========================================
// EXCEL IMPORT FUNCTIONALITY (Phase 3)
// ==========================================
async function handleInventoryImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input so the same file can be selected again if needed
    event.target.value = '';

    // Automatically use the Excel file's actual name (stripped of extension) as the batch name
    const batchName = file.name.replace(/\.[^/.]+$/, "");
    if (!batchName) {
        alert("Import canceled: Could not determine file name.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Assume the first sheet is the one we want
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (rawJson.length === 0) {
                return alert("The Excel sheet is empty!");
            }

            // Map keys
            const payloadArray = [];
            const isCustom = window.userCustomHeaders && window.userCustomHeaders.length > 0;

            for (let i = 0; i < rawJson.length; i++) {
                const rawRow = rawJson[i];
                const row = {};
                // Normalize keys to lowercase and trim spaces for robust matching
                for (let k in rawRow) {
                    row[k.trim().toLowerCase()] = rawRow[k];
                }

                const itemPayload = {};

                // Always try to map standard fields so dashboard math still works!
                itemPayload.date = row['date'] || new Date().toISOString().split('T')[0];
                itemPayload.category = row['category'] || '';
                itemPayload.vendor = row['vendor'] || row['vendor name'] || '';
                itemPayload.item = row['item name'] || row['item'] || '';
                itemPayload.brand = row['brand'] || '';
                itemPayload.model = row['model'] || '';
                itemPayload.serialnumber = row['serialnumber'] || row['serial number'] || '';
                itemPayload.qty = parseInt(row['quantity'] || row['qty']) || 0;
                itemPayload.price = parseFloat(row['unit price'] || row['price']) || 0;
                itemPayload.total = parseFloat(row['total']) || (itemPayload.qty * itemPayload.price);
                itemPayload.paid = parseFloat(row['paid'] || row['paid amount']) || 0;
                itemPayload.mode = row['mode'] || row['payment mode'] || '';
                itemPayload.balance = parseFloat(row['balance']) || (itemPayload.total - itemPayload.paid);

                // Build explicit custom data payload avoiding nested stringification bugs
                let explicitCustomData = {};

                // 1. If the imported row already had a "customdata" column (e.g. from an export),
                // parse it and merge it first so we don't nest strings inside strings.
                if (row['customdata']) {
                    try {
                        let parsedOld = JSON.parse(row['customdata']);
                        if (typeof parsedOld === 'string') {
                            parsedOld = JSON.parse(parsedOld); // Handle double stringified legacy data just in case
                        }
                        Object.assign(explicitCustomData, parsedOld);
                    } catch (e) { }
                }

                // 2. Identify standard fields (using lowercase comparison)
                const standardKeys = ['id', 'date', 'category', 'vendor', 'vendor name', 'item name', 'item', 'brand', 'model', 'serialnumber', 'serial number', 'quantity', 'qty', 'unit price', 'price', 'total', 'paid amount', 'paid', 'balance', 'payment mode', 'mode', 'notes', 'customdata'];

                // 3. Map any remaining actual Excel outer columns uniquely into our payload
                for (let k in rawRow) {
                    const lowerKey = k.trim().toLowerCase();
                    if (!standardKeys.includes(lowerKey)) {
                        // Preserve original casing from Excel so backend maps it perfectly
                        explicitCustomData[k] = rawRow[k];
                    }
                }

                explicitCustomData['File Name'] = batchName.trim();
                explicitCustomData.batch = batchName.trim(); // For legacy backend deletion
                // Send the flat merged JSON
                itemPayload.customData = JSON.stringify(explicitCustomData);

                payloadArray.push(itemPayload);
            }

            // Add visual cue
            const btn = document.querySelector(`button[onclick="document.getElementById('importExcelInput').click()"]`);
            const ogHtml = btn ? btn.innerHTML : 'Importing...';
            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
                btn.disabled = true;
            }
            btn.disabled = true;

            try {
                // We will create a bulk save API function next
                const response = await API.bulkSaveInventory(payloadArray);
                if (response.status === 'success') {
                    alert(`Successfully imported ${payloadArray.length} items!`);
                    if (typeof loadCustomHeaders === 'function') await loadCustomHeaders();
                    if (typeof loadInventory === 'function') loadInventory(); // Refresh view
                } else {
                    alert("Import failed: " + response.message);
                }
            } catch (apiErr) {
                console.error("Bulk upload err:", apiErr);
                alert("An error occurred during network transfer.");
            } finally {
                if (btn) {
                    btn.innerHTML = ogHtml;
                    btn.disabled = false;
                }
            }

        } catch (err) {
            console.error(err);
            alert("Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv");
        }
    };
    reader.readAsArrayBuffer(file);
}

async function deleteCurrentBatch() {
    const batchFilter = document.getElementById('inventoryBatchFilter');
    const batchName = batchFilter ? batchFilter.value : '';
    if (!batchName) {
        alert("Please select a batch to delete.");
        return;
    }
    if (!confirm(`Are you sure you want to delete all inventory items in batch: "${batchName}"?`)) {
        return;
    }

    const btn = document.getElementById('deleteBatchBtn');
    const originalText = btn ? btn.innerHTML : 'Delete Batch';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
        btn.disabled = true;
    }

    try {
        const result = await API.deleteBatch(batchName);
        if (result.status === 'success') {
            alert(`Batch "${batchName}" deleted successfully!`);
            if (batchFilter) batchFilter.value = '';
            loadInventory();
            if (window.refreshDashboard) window.refreshDashboard();
        } else {
            alert('Delete failed: ' + result.message);
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred during deletion.');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// -------------------------------------------------------------
// USER PROFILE EDITING LOGIC
// -------------------------------------------------------------

function openUserProfile() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return alert("User session not found. Please log in again.");

    document.getElementById('profileName').value = user.name || "";
    document.getElementById('profileCompany').value = user.company || "";
    document.getElementById('profileMobile').value = user.mobile || "";
    document.getElementById('profileWhatsapp').value = user.whatsapp || "";
    document.getElementById('profileEmail').value = user.email || "";
    document.getElementById('profileAddress').value = user.address || "";

    document.getElementById('userProfileModal').style.display = 'flex';
}

function closeUserProfile() {
    document.getElementById('userProfileModal').style.display = 'none';
}

async function saveUserProfile() {
    const btn = document.getElementById('btnSaveProfile');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));

        const payload = {
            username: currentUser.username,
            name: document.getElementById('profileName').value,
            company: document.getElementById('profileCompany').value,
            mobile: document.getElementById('profileMobile').value,
            whatsapp: document.getElementById('profileWhatsapp').value,
            email: document.getElementById('profileEmail').value,
            address: document.getElementById('profileAddress').value
        };

        const res = await API.updateUserProfile(payload);

        if (res.status === 'success') {
            // Update local storage with new info
            const updatedUser = { ...currentUser, ...res.user };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));

            // Update Dashboard UI Header Name
            const headerNameEl = document.getElementById('currentUserDisplay');
            if (headerNameEl) headerNameEl.textContent = updatedUser.name;

            alert('Profile updated successfully!');
            closeUserProfile();
        } else {
            alert('Failed to update profile: ' + res.message);
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('An error occurred while saving profile data.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ===== Sidebar Active Page Highlight =====
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    if(item.getAttribute('href') === currentPage) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
});

async function checkDeploymentVersion() { /* Your existing version check */ }