// reports.js - Handling Reports Logic

window.downloadPDF = function () {
    const element = document.querySelector('.glass-card', '#reports'); // Select the card container
    // Better selection: The relevant parts are title, summary, table. 
    // But selecting the parent card is easiest. 
    // Let's create a temporary container to clone the content for cleaner PDF if needed, 
    // or just pass the element.

    // Check if report is generated
    if (document.querySelector('#reportTbody').children.length === 0) {
        alert("Please generate a report first.");
        return;
    }

    const type = document.getElementById('reportType').value;
    const freq = document.getElementById('reportFreq').value;
    const dateVal = document.getElementById('reportDate').value || 'AllTime';

    const opt = {
        margin: 0.5,
        filename: `Report_${type}_${freq}_${dateVal}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    // Choose the container to print - The report card content
    // We might want to exclude the controls (filters) from PDF?
    // Let's print the whole card but maybe hide controls via CSS for print media, 
    // but for PDF generation via JS, we might need to clone and remove controls.

    // Clone and clean
    const original = document.querySelector('#reports .glass-card');
    const clone = original.cloneNode(true);

    // Remove filters button row from clone
    const controls = clone.querySelector('div[style*="justify-content: space-between"]');
    if (controls) controls.remove();

    // Add title back if it was inside the removed controls?
    // In our HTML, Title is separate: <h3 id="reportTitleDisplay">...</h3>. It's safe.
    // The removed part is the top bar with Filters and Buttons.

    // Add a simple header for PDF context
    const header = document.createElement('div');
    header.innerHTML = `<h2>Inventory System Report</h2><p>Generated on ${new Date().toLocaleString()}</p><hr>`;
    header.style.marginBottom = '20px';
    header.style.textAlign = 'center';
    clone.insertBefore(header, clone.firstChild);

    html2pdf().set(opt).from(clone).save();
};

document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    const dateInput = document.getElementById('reportDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Listener for Report Type Change
    const typeSelect = document.getElementById('reportType');
    if (typeSelect) {
        typeSelect.addEventListener('change', handleReportTypeChange);
    }

    // Init report if tab is active (unlikely on load, but good practice)
    if (!document.getElementById('reports').classList.contains('hidden')) {
        // window.generateReport(); 
    }
});

async function handleReportTypeChange() {
    const type = document.getElementById('reportType').value;
    const freqSelect = document.getElementById('reportFreq');

    // Reset Dropdown to default
    freqSelect.innerHTML = `
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly" selected>Monthly</option>
    `;

    // If Vendor Report, fetch vendors and append
    if (type === 'vendor') {
        try {
            // Show loading or just append
            const inventory = await API.getInventory();
            // Get unique vendors
            const vendors = [...new Set(inventory.map(i => i['Vendor'] || i.vendor).filter(v => v))];

            if (vendors.length > 0) {
                const sep = document.createElement('option');
                sep.disabled = true;
                sep.innerText = "─── Specific Vendors ───";
                freqSelect.appendChild(sep);

                vendors.sort().forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = "VAL_" + v; // Prefix to distinguish from keywords
                    opt.innerText = v;
                    freqSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Error fetching vendors for dropdown", e);
        }
    }
}

window.generateReport = async function () {
    const type = document.getElementById('reportType').value;
    const freqValue = document.getElementById('reportFreq').value;
    const dateVal = document.getElementById('reportDate').value;

    let freq = freqValue;
    let specificVendor = null;

    // Check if a specific vendor is selected (starts with VAL_)
    if (typeof freqValue === 'string' && freqValue.startsWith('VAL_')) {
        specificVendor = freqValue.substring(4); // Remove VAL_
        freq = 'monthly'; // Default time context for specific vendor view if not specified? 
        // Or maybe we treat "all time" for specific vendor?
        // Let's stick to the selected Date context (e.g. Monthly for that vendor) 
        // to keep Date picker relevant.
    }

    // UI Feedback
    const btn = event.target;
    // const originalText = btn.innerHTML;
    // btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    if (!dateVal) {
        alert("Please select a date.");
        return;
    }

    // Update Title
    const typeLabel = document.querySelector(`#reportType option[value="${type}"]`).text;
    const freqLabel = specificVendor ? specificVendor : document.querySelector(`#reportFreq option[value="${freqValue}"]`).text;

    document.getElementById('reportTitleDisplay').textContent = `${freqLabel} ${typeLabel}`;

    // Fetch Data
    let data = [];
    try {
        if (type === 'sales') data = await API.getSales();
        else if (type === 'purchase') data = await API.getInventory();
        else if (type === 'expenses') data = await API.getExpenses();
        else if (type === 'vendor') data = await API.getInventory();
        else if (type === 'item') {
            const [inv, sal] = await Promise.all([API.getInventory(), API.getSales()]);
            data = { inventory: inv, sales: sal };
        }
    } catch (e) {
        console.error("Error fetching data for report", e);
        alert("Failed to load data.");
        return;
    }

    // Process Data
    let reportData = [];
    let summary = {};
    const dateObj = new Date(dateVal);

    if (type === 'item') {
        reportData = processItemReport(data, freq, dateObj);
    } else if (type === 'vendor') {
        if (specificVendor) {
            // Detailed Report for ONE Vendor
            reportData = processSpecificVendorReport(data, specificVendor, freq, dateObj);
            // Change render type to standard purchase table for this view?
            // Yes, user wants to see what they bought from this vendor.
        } else {
            // Aggregate Report for ALL Vendors
            reportData = processVendorReport(data, freq, dateObj);
        }
    } else {
        const filtered = filterByDate(data, getUrlDateField(type), freq, dateObj);
        reportData = filtered;
    }

    // Render
    // If specific vendor, render as Purchase table (since it's purchase history)
    if (specificVendor) {
        renderSummary('purchase', reportData); // Reuse purchase summary logic
        renderTable('purchase', reportData);   // Reuse purchase table columns
    } else {
        renderSummary(type, reportData);
        renderTable(type, reportData);
    }
};

// --- Filtering Core ---

function filterByDate(data, dateKey, freq, targetDate) {
    return data.filter(item => {
        let itemDateStr = item[dateKey] || item.date || item.Date;
        if (!itemDateStr) return false;

        // Handle T separator
        if (itemDateStr.includes('T')) itemDateStr = itemDateStr.split('T')[0];

        const itemDate = new Date(itemDateStr);
        // Normalize time
        itemDate.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        if (freq === 'daily') {
            return itemDate.getTime() === target.getTime();
        } else if (freq === 'weekly') {
            const d1 = getWeekNumber(itemDate);
            const d2 = getWeekNumber(target);
            return d1[0] === d2[0] && d1[1] === d2[1];
        } else if (freq === 'monthly') {
            return itemDate.getMonth() === target.getMonth() && itemDate.getFullYear() === target.getFullYear();
        }
    });
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
}

function getUrlDateField(type) {
    if (type === 'purchase') return 'Date';
    return 'date';
}

// --- Processors ---

function processSpecificVendorReport(data, vendorName, freq, targetDate) {
    // 1. Filter by Vendor
    let filtered = data.filter(item => (item['Vendor'] || item.vendor) === vendorName);

    // 2. Filter by Date (using the frequency logic, defaulting to Monthly context usually if specific vendor selected?)
    // If specific vendor selected, we still respect the FREQ logic passed to filterByDate?
    // In generateReport we set freq='monthly' for specific vendor if using Date Picker context.
    // Let's assume user still wants time bounds.

    return filterByDate(filtered, 'Date', freq, targetDate);
}

function processVendorReport(purchaseData, freq, targetDate) {
    // 1. Filter Purchases by date first
    const filtered = filterByDate(purchaseData, 'Date', freq, targetDate);

    // 2. Group by Vendor
    const map = {};
    filtered.forEach(p => {
        const v = p['Vendor'] || p.vendor || 'Unknown';
        if (!map[v]) map[v] = { name: v, count: 0, total: 0, paid: 0 };
        map[v].count += (parseFloat(p['Quantity'] || p.qty) || 0);
        map[v].total += (parseFloat(p['Total'] || p.total) || 0);
        map[v].paid += (parseFloat(p['Paid'] || p.paid) || 0);
    });
    return Object.values(map);
}

function processItemReport(data, freq, targetDate) {
    const filteredSales = filterByDate(data.sales, 'date', freq, targetDate);

    const map = {};
    filteredSales.forEach(s => {
        const item = s['Item Name'] || s.item || 'Unknown';
        if (!map[item]) map[item] = { name: item, qtySold: 0, revenue: 0 };
        map[item].qtySold += (parseFloat(s.quantity || s.qty) || 0);
        map[item].revenue += (parseFloat(s.total) || 0);
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}


// --- Rendering ---

function renderSummary(type, data) {
    const container = document.getElementById('reportSummary');
    container.innerHTML = '';

    let stats = [];

    if (type === 'sales') {
        const total = data.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
        const count = data.length; // Transcations
        const cashObj = data.filter(d => (d.mode || '').toLowerCase() === 'cash');
        const cashTotal = cashObj.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);

        stats = [
            { label: 'Total Sales', value: formatCurrency(total), color: 'blue' },
            { label: 'Transactions', value: count, color: 'orange' },
            { label: 'Cash Sales', value: formatCurrency(cashTotal), color: 'green' },
        ];
    }
    else if (type === 'purchase') {
        const total = data.reduce((acc, curr) => acc + (parseFloat(curr['Total'] || curr.total) || 0), 0);
        const balance = data.reduce((acc, curr) => acc + (parseFloat(curr['Balance'] || curr.balance) || 0), 0);

        stats = [
            { label: 'Total Purchases', value: formatCurrency(total), color: 'blue' },
            { label: 'Items Purchased', value: data.length, color: 'orange' }, // or sum quantities
            { label: 'Unpaid Balance', value: formatCurrency(balance), color: 'red' },
        ];
    }
    else if (type === 'expenses') {
        const total = data.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        stats = [
            { label: 'Total Expenses', value: formatCurrency(total), color: 'red' },
            { label: 'Count', value: data.length, color: 'orange' },
        ];
    }
    else if (type === 'vendor') {
        const total = data.reduce((acc, curr) => acc + curr.total, 0);
        stats = [
            { label: 'Total Purchased', value: formatCurrency(total), color: 'blue' },
            { label: 'Active Vendors', value: data.length, color: 'green' },
        ];
    }
    else if (type === 'item') {
        const rev = data.reduce((acc, curr) => acc + curr.revenue, 0);
        const qty = data.reduce((acc, curr) => acc + curr.qtySold, 0);
        stats = [
            { label: 'Total Revenue', value: formatCurrency(rev), color: 'blue' },
            { label: 'Units Sold', value: qty, color: 'orange' },
        ];
    }

    // Generate HTML
    container.innerHTML = stats.map(s => `
        <div class="stat-card ${s.color}">
             <div class="stat-content" style="padding:0;">
                <div class="stat-label">${s.label}</div>
                <div class="stat-value" style="font-size: 1.2rem;">${s.value}</div>
            </div>
        </div>
    `).join('');
}

function renderTable(type, data) {
    const thead = document.getElementById('reportThead');
    const tbody = document.getElementById('reportTbody');

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 2rem;">No Records Found</td></tr>';
        return;
    }

    let headers = [];
    let rows = '';

    if (type === 'sales') {
        headers = ['Date', 'Customer', 'Item', 'Qty', 'Price', 'Total', 'Mode'];
        rows = data.map(d => `
            <tr>
                <td>${formatDate(d.date)}</td>
                <td>${d.customer || '-'}</td>
                <td>${d['Item Name'] || d.item}</td>
                <td>${d.quantity || d.qty}</td>
                <td>${d.price}</td>
                <td>${d.total}</td>
                <td>${d.mode || '-'}</td>
            </tr>
        `).join('');
    }
    else if (type === 'purchase') {
        headers = ['Date', 'Vendor', 'Item', 'Qty', 'Total', 'Balance'];
        rows = data.map(d => `
            <tr>
                <td>${formatDate(d['Date'] || d.date)}</td>
                <td>${d['Vendor'] || d.vendor}</td>
                <td>${d['Item Name'] || d.item}</td>
                <td>${d['Quantity'] || d.qty}</td>
                <td>${d['Total'] || d.total}</td>
                <td style="color:${(d['Balance'] || d.balance) > 0 ? 'red' : 'green'}">${d['Balance'] || d.balance}</td>
            </tr>
        `).join('');
    }
    else if (type === 'expenses') {
        headers = ['Date', 'Title', 'Desc', 'Amount', 'Mode'];
        rows = data.map(d => `
            <tr>
                <td>${formatDate(d.date)}</td>
                <td>${d.title || d.category || '-'}</td>
                <td>${d.description || d.desc || '-'}</td>
                <td>${d.amount}</td>
                <td>${d.mode || '-'}</td>
            </tr>
        `).join('');
    }
    else if (type === 'vendor') {
        headers = ['Vendor Name', 'Items Qty', 'Total Amount', 'Amount Paid'];
        rows = data.map(d => `
             <tr>
                <td>${d.name}</td>
                <td>${d.count}</td>
                <td>${formatCurrency(d.total)}</td>
                <td>${formatCurrency(d.paid)}</td>
            </tr>
        `).join('');
    }
    else if (type === 'item') {
        headers = ['Item Name', 'Qty Sold', 'Revenue Generated'];
        rows = data.map(d => `
             <tr>
                <td>${d.name}</td>
                <td>${d.qtySold}</td>
                <td>${formatCurrency(d.revenue)}</td>
            </tr>
        `).join('');
    }

    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows;
}

// --- Utils ---
function formatCurrency(val) {
    return 'Rs. ' + (parseFloat(val) || 0).toLocaleString();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
    return dateStr;
}
