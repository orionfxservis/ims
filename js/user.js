
document.addEventListener('DOMContentLoaded', () => {
    Auth.checkAuth();
    setupSidebar();


    // Load dashboard stats if on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        loadStats();
        Dashboard.init();
    }

    // Purchase Form Handler
    const purchaseForm = document.getElementById('purchaseForm');
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', handlePurchaseSubmit);
        loadPurchaseChart();
    }

    // Sales Form Handler
    const salesForm = document.getElementById('salesForm');
    if (salesForm) {
        salesForm.addEventListener('submit', handleSaleSubmit);
        loadSalesChart(); // Load chart when on sales page
    }

    // Expense Form Handler
    const expensesForm = document.getElementById('expensesForm');
    if (expensesForm) {
        expensesForm.addEventListener('submit', handleExpenseSubmit);
        loadExpenseChart(); // Load chart
        // Auto-fill date logic is now in HTML script, but we can keep failsafe here or remove
        if (document.getElementById('expenseDate')) document.getElementById('expenseDate').valueAsDate = new Date();
    }
});

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Set active link based on current page
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-item').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });

    // Set User Name
    const user = Auth.getSession();
    if (user) {
        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.name;
    }
}

async function loadStats() {
    const statPurchases = document.getElementById('statPurchase');
    const statSales = document.getElementById('statSales');
    const statExpenses = document.getElementById('statExpenses');

    // Set loading state if elements exist
    if (statPurchases) statPurchases.textContent = 'Loading...';
    if (statSales) statSales.textContent = 'Loading...';

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getStats' })
        });

        const result = await response.json();

        if (result.success) {
            if (statPurchases) statPurchases.textContent = `Rs. ${result.stats.purchases.toLocaleString()}`;
            if (statSales) statSales.textContent = `Rs. ${result.stats.sales.toLocaleString()}`;
            if (statExpenses) statExpenses.textContent = `Rs. ${result.stats.expenses.toLocaleString()}`;
        } else {
            console.error('Failed to load stats:', result.message);
        }
    } catch (e) {
        console.error('Error loading stats:', e);
    }
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const getValue = (id) => document.getElementById(id) ? document.getElementById(id).value : '';

    // Collect data (Using querySelector for inputs without IDs if needed, but we added IDs or can use name/index)
    // However, in our purchase.html we didn't add IDs to ALL inputs, just specific ones for calc.
    // Let's rely on form elements order or ensure we get values correctly. 
    // Best practice: Use FormData or add IDs. 
    // Given the HTML structure, let's use querySelector with index or specific lookups.
    // Just mapping fields from the known structure:

    // Section 1: Vendor & Date
    // Date is 1st input, VendorNo 2nd, VendorName 3rd
    const inputs = document.querySelectorAll('.form-input');

    const data = {
        action: 'savePurchase',
        date: inputs[0].value,
        vendorNo: inputs[1].value,
        vendorName: inputs[2].value,

        // Section 2: Product
        productName: inputs[3].value,
        brand: inputs[4].value,
        model: inputs[5].value,
        productDetail: inputs[6].value, // TextArea

        // Section 3: Transaction
        price: document.getElementById('price').value,
        quantity: document.getElementById('qty').value,

        // Section 4: Payment
        paymentMode: document.querySelector('select').value,
        paid: document.getElementById('paid').value
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('Purchase Saved Successfully!');
            e.target.reset();
            // Reset read-only fields manually if needed
            document.getElementById('total').value = '';
            document.getElementById('balance').value = '';
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Request failed: ' + error.toString());
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleSaleSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const data = {
        action: 'savePurchase', // CAUTION: Using same action for now, or need new one? User requested "Sales", so we should use 'saveSale' and backend support.
        // Actually, looking at the request, it's for SALES. So action should be 'saveSale'.
        // But wait, the backend doesn't have 'saveSale' yet. I need to add it to code.gs.
        action: 'saveSale',
        date: document.getElementById('saleDate').value,
        customerName: document.getElementById('customerName').value,
        mobile: document.getElementById('mobile').value,
        productName: document.getElementById('productName').value,
        price: document.getElementById('salePrice').value,
        quantity: document.getElementById('saleQty').value,
        total: document.getElementById('saleTotal').value,
        paymentMode: document.getElementById('paymentMode').value,
        paid: document.getElementById('amountPaid').value,
        balance: document.getElementById('saleBalance').value
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('Sale Invoice Saved Successfully!');
            e.target.reset();
            // Reset auto-fields
            document.getElementById('saleDate').valueAsDate = new Date();
            document.getElementById('saleTotal').value = '';
            document.getElementById('saleBalance').value = '';
            loadSalesChart(); // Refresh chart
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Request failed: ' + error.toString());
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function loadSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Destroy existing chart if any (to prevent overlap on reload)
    if (window.mySalesChart) {
        window.mySalesChart.destroy();
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getSalesData' })
        });
        const result = await response.json();

        if (result.success) {
            const labels = result.data.map(item => new Date(item.date).toLocaleDateString());
            const amounts = result.data.map(item => item.total);

            window.mySalesChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Sales Amount',
                        data: amounts,
                        backgroundColor: '#4F46E5',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    } catch (e) {
        console.error("Error loading chart:", e);
        // Show empty or error state on chart if needed
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const data = {
        action: 'saveExpense',
        // Title field removed in HTML update, using category as main identifier or description?
        // User didn't explicitly remove Title but asked for specific fields. 
        // In the HTML update 'Expense Title' input was removed based on the requested replacement content.
        // Let's assume 'Expense Head' acts as title/category. 
        // We can pass empty title or category as title.
        title: document.getElementById('expenseHead').value, // Used Head as title since Title input is removed
        category: document.getElementById('expenseHead').value,
        amount: document.getElementById('expenseAmount').value,
        date: document.getElementById('expenseDate').value,
        paymentMode: document.getElementById('expensePaymentMode').value,
        description: document.querySelector('textarea').value
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert('Expense Saved Successfully!');
            e.target.reset();
            document.getElementById('expenseDate').valueAsDate = new Date();
            loadExpenseChart(); // Refresh chart
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Request failed: ' + error.toString());
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function loadExpenseChart() {
    const ctx = document.getElementById('expensesChart');
    if (!ctx) return;

    if (window.myExpenseChart) {
        window.myExpenseChart.destroy();
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getExpenseData' })
        });
        const result = await response.json();

        if (result.success) {
            // Filter valid entries and sort by Date
            const data = result.data
                .filter(item => item.date && !isNaN(new Date(item.date).getTime()))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            // Prepare Data: Label = "Date - Title", Value = Amount
            const labels = data.map(item => {
                const dateStr = new Date(item.date).toLocaleDateString();
                const title = item.title ? item.title : 'Expense';
                return `${dateStr} - ${title}`;
            });

            const amounts = data.map(item => Number(item.amount) || 0);

            window.myExpenseChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Expense Amount',
                        data: amounts,
                        backgroundColor: '#DC2626', // Red
                        borderColor: '#991B1B',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += 'Rs. ' + context.parsed.y.toLocaleString();
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error("Error loading expense chart:", e);
    }
}

async function loadPurchaseChart() {
    const ctx = document.getElementById('purchaseChart');
    if (!ctx) return;

    if (window.myPurchaseChart) {
        window.myPurchaseChart.destroy();
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getPurchaseData' })
        });
        const result = await response.json();

        if (result.success) {
            // Sort by Date
            const data = result.data
                .filter(item => item.date && !isNaN(new Date(item.date).getTime()))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            const labels = data.map(item => {
                const dateStr = new Date(item.date).toLocaleDateString();
                const vendor = item.vendor || 'Unknown';
                return `${dateStr} - ${vendor}`;
            });
            const amounts = data.map(item => item.amount);

            window.myPurchaseChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Purchase Amount',
                        data: amounts,
                        backgroundColor: '#F59E0B', // Amber/Warning color
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }, // Tooltips auto-enabled
                    scales: {
                        x: { ticks: { maxRotation: 45, minRotation: 45 } },
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    } catch (e) {
        console.error("Error loading purchase chart:", e);
    }
}

const Dashboard = {
    currentTab: 'sale', // sale, purchase, expense
    currentFilter: 'month', // day, week, month
    chartInstance: null,

    init: function () {
        if (!document.getElementById('dashboardChart')) return;
        // Bind UI events if not inline (inline used in HTML)
        this.loadDataAndRender();
    },

    switchTab: function (tab) {
        this.currentTab = tab;
        // Update UI
        document.querySelectorAll('.dash-tabs .btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');

        // Update Title
        const titles = { sale: 'Sales Overview', purchase: 'Purchase Overview', expense: 'Expense Overview' };
        document.getElementById('chartTitle').textContent = titles[tab];

        this.loadDataAndRender();
    },

    setFilter: function (filter) {
        this.currentFilter = filter;
        // Update UI
        document.querySelectorAll('.time-filters .btn').forEach(b => b.classList.remove('active'));
        // Find the button with the label and set active? 
        // Or simpler: remove all active, then find by text? 
        // Inline onclick passes 'this' typically, but here I passed string.
        // Let's rely on event.target if possible or just update all logic in render.
        // Actually, for simplicity in inline onclick: onClick="Dashboard.setFilter('day', this)" would be better.
        // But I used onClick="Dashboard.setFilter('day')".
        // I'll grab elements by text content or index.
        const btns = document.querySelectorAll('.time-filters .btn');
        btns.forEach(b => {
            b.classList.remove('active');
            if (b.textContent.toLowerCase() === filter) b.classList.add('active');
        });

        this.loadDataAndRender();
    },

    loadDataAndRender: async function () {
        const ctx = document.getElementById('dashboardChart');
        if (!ctx) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // 1. Determine Action
        let action = 'getSalesData';
        if (this.currentTab === 'purchase') action = 'getPurchaseData';
        if (this.currentTab === 'expense') action = 'getExpenseData';

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: action })
            });
            const result = await response.json();

            if (result.success) {
                const data = this.filterDataByTime(result.data);
                this.renderChart(ctx, data);
            }
        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    },

    filterDataByTime: function (data) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return data.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);

            if (this.currentFilter === 'day') {
                return itemDate >= startOfDay && itemDate < new Date(startOfDay.getTime() + 86400000);
            } else if (this.currentFilter === 'week') {
                return itemDate >= startOfWeek;
            } else { // month
                return itemDate >= startOfMonth; // Current Month or last 30 days? "Month" usually means this month.
            }
        });
    },

    renderChart: function (ctx, data) {
        // Sort
        data.sort((a, b) => new Date(a.date) - new Date(b.date));

        let labels, amounts, backgroundColor;

        // Config based on Tab
        if (this.currentTab === 'sale') backgroundColor = '#4F46E5';
        else if (this.currentTab === 'purchase') backgroundColor = '#F59E0B';
        else backgroundColor = '#DC2626';

        // Aggregation Logic
        if (this.currentFilter === 'day') {
            // Individual Items
            labels = data.map(item => {
                let label = '';
                if (this.currentTab === 'sale') label = item.customer || 'Customer';
                if (this.currentTab === 'purchase') label = item.vendor || 'Vendor';
                if (this.currentTab === 'expense') label = item.title || 'Expense';
                return label;
            });
            amounts = data.map(item => Number(item.total || item.amount) || 0);
        } else {
            // Aggregate by Date for Week/Month
            const agg = {};
            // Init dates if needed? Chart.js can skip.
            data.forEach(item => {
                const dateKey = new Date(item.date).toLocaleDateString();
                const val = Number(item.total || item.amount) || 0;
                agg[dateKey] = (agg[dateKey] || 0) + val;
            });
            labels = Object.keys(agg);
            amounts = Object.values(agg);
        }

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1) + ' Amount',
                    data: amounts,
                    backgroundColor: backgroundColor,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    x: { ticks: { maxRotation: 45, minRotation: 45 } },
                    y: { beginAtZero: true }
                }
            }
        });
    }
};

