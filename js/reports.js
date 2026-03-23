(() => {
    // ===============================
    // Reports Module
    // ===============================
    const Reports = {
        init: function () {
            this.bindUI();
            this.setDefaultDate();
        },

        // ------------------------------
        // UI Bindings
        // ------------------------------
        bindUI: function () {
            const typeSelect = document.getElementById('reportType');
            if (typeSelect) typeSelect.addEventListener('change', this.handleReportTypeChange);

            const generateBtn = document.getElementById('generateReportBtn');
            if (generateBtn) generateBtn.addEventListener('click', this.generateReport);

            const downloadBtn = document.getElementById('downloadReportBtn');
            if (downloadBtn) downloadBtn.addEventListener('click', this.downloadPDF);
        },

        // ------------------------------
        // Default Date
        // ------------------------------
        setDefaultDate: function () {
            const dateInput = document.getElementById('reportDate');
            if (dateInput) dateInput.valueAsDate = new Date();
        },

        // ------------------------------
        // Handle Report Type Change
        // ------------------------------
        handleReportTypeChange: async function () {
            const type = document.getElementById('reportType').value;
            const freqSelect = document.getElementById('reportFreq');

            // Reset frequency dropdown
            freqSelect.innerHTML = `
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly" selected>Monthly</option>
            `;

            // If Vendor Report, append vendor-specific options
            if (type === 'vendor') {
                try {
                    const inventory = await API.getInventory();
                    const vendors = [...new Set(inventory.map(i => i['Vendor'] || i.vendor).filter(Boolean))];

                    if (vendors.length) {
                        const sep = document.createElement('option');
                        sep.disabled = true;
                        sep.innerText = "─── Specific Vendors ───";
                        freqSelect.appendChild(sep);

                        vendors.sort().forEach(v => {
                            const opt = document.createElement('option');
                            opt.value = `VAL_${v}`;
                            opt.innerText = v;
                            freqSelect.appendChild(opt);
                        });
                    }
                } catch (err) {
                    console.error("Error fetching vendors for dropdown", err);
                }
            }
        },

        // ------------------------------
        // Generate Report
        // ------------------------------
        generateReport: async function (event) {
            const type = document.getElementById('reportType').value;
            let freqValue = document.getElementById('reportFreq').value;
            const dateVal = document.getElementById('reportDate').value;
            if (!dateVal) return alert("Please select a date.");

            let specificVendor = null;
            if (freqValue.startsWith('VAL_')) {
                specificVendor = freqValue.substring(4);
                freqValue = 'monthly';
            }

            // Update Title
            const typeLabel = document.querySelector(`#reportType option[value="${type}"]`).text;
            const freqLabel = specificVendor || document.querySelector(`#reportFreq option[value="${freqValue}"]`).text;
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
            } catch (err) {
                console.error("Error fetching data for report", err);
                return alert("Failed to load data.");
            }

            // Process Data
            let reportData = [];
            const dateObj = new Date(dateVal);

            if (type === 'item') reportData = this.processItemReport(data, freqValue, dateObj);
            else if (type === 'vendor') {
                reportData = specificVendor
                    ? this.processSpecificVendorReport(data, specificVendor, freqValue, dateObj)
                    : this.processVendorReport(data, freqValue, dateObj);
            } else {
                const dateField = this.getDateField(type);
                reportData = this.filterByDate(data, dateField, freqValue, dateObj);
            }

            // Render
            if (specificVendor) {
                this.renderSummary('purchase', reportData);
                this.renderTable('purchase', reportData);
            } else {
                this.renderSummary(type, reportData);
                this.renderTable(type, reportData);
            }
        },

        // ------------------------------
        // Download PDF
        // ------------------------------
        downloadPDF: function () {
            const tbody = document.getElementById('reportTbody');
            if (!tbody || tbody.children.length === 0) return alert("Please generate a report first.");

            const original = document.querySelector('#reports .glass-card');
            const clone = original.cloneNode(true);

            // Remove controls bar
            const controls = clone.querySelector('div[style*="justify-content: space-between"]');
            if (controls) controls.remove();

            // Add PDF header
            const header = document.createElement('div');
            header.innerHTML = `<h2>Inventory System Report</h2><p>Generated on ${new Date().toLocaleString()}</p><hr>`;
            header.style.textAlign = 'center';
            header.style.marginBottom = '20px';
            clone.insertBefore(header, clone.firstChild);

            const type = document.getElementById('reportType').value;
            const freq = document.getElementById('reportFreq').value;
            const dateVal = document.getElementById('reportDate').value || 'AllTime';

            html2pdf().set({
                margin: 0.5,
                filename: `Report_${type}_${freq}_${dateVal}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
            }).from(clone).save();
        },

        // ------------------------------
        // --- Helpers ---
        // ------------------------------
        filterByDate: function (data, dateKey, freq, targetDate) {
            return data.filter(item => {
                let dateStr = item[dateKey] || item.date || item.Date;
                if (!dateStr) return false;
                if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];

                const itemDate = new Date(dateStr);
                const target = new Date(targetDate);
                itemDate.setHours(0,0,0,0);
                target.setHours(0,0,0,0);

                if (freq === 'daily') return itemDate.getTime() === target.getTime();
                if (freq === 'weekly') return this.getWeekNumber(itemDate).join() === this.getWeekNumber(target).join();
                if (freq === 'monthly') return itemDate.getMonth() === target.getMonth() && itemDate.getFullYear() === target.getFullYear();
            });
        },

        getWeekNumber: function (d) {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return [d.getUTCFullYear(), weekNo];
        },

        getDateField: function (type) {
            return type === 'purchase' ? 'Date' : 'date';
        },

        // ------------------------------
        // Data Processors
        // ------------------------------
        processSpecificVendorReport: function (data, vendorName, freq, targetDate) {
            const filtered = data.filter(item => (item['Vendor'] || item.vendor) === vendorName);
            return this.filterByDate(filtered, 'Date', freq, targetDate);
        },

        processVendorReport: function (purchaseData, freq, targetDate) {
            const filtered = this.filterByDate(purchaseData, 'Date', freq, targetDate);
            const map = {};
            filtered.forEach(p => {
                const v = p['Vendor'] || p.vendor || 'Unknown';
                if (!map[v]) map[v] = { name: v, count: 0, total: 0, paid: 0 };
                map[v].count += parseFloat(p['Quantity'] || p.qty) || 0;
                map[v].total += parseFloat(p['Total'] || p.total) || 0;
                map[v].paid += parseFloat(p['Paid'] || p.paid) || 0;
            });
            return Object.values(map);
        },

        processItemReport: function (data, freq, targetDate) {
            const filteredSales = this.filterByDate(data.sales, 'date', freq, targetDate);
            const map = {};
            filteredSales.forEach(s => {
                const item = s['Item Name'] || s.item || 'Unknown';
                if (!map[item]) map[item] = { name: item, qtySold: 0, revenue: 0 };
                map[item].qtySold += parseFloat(s.quantity || s.qty) || 0;
                map[item].revenue += parseFloat(s.total) || 0;
            });
            return Object.values(map).sort((a,b) => b.revenue - a.revenue);
        },

        // ------------------------------
        // Rendering
        // ------------------------------
        renderSummary: function (type, data) {
            const container = document.getElementById('reportSummary');
            container.innerHTML = '';

            let stats = [];
            if (type === 'sales') {
                const total = data.reduce((a,c) => a + (parseFloat(c.total) || 0), 0);
                const cashTotal = data.filter(d => (d.mode||'').toLowerCase()==='cash').reduce((a,c) => a + (parseFloat(c.total)||0),0);
                stats = [
                    { label: 'Total Sales', value: this.formatCurrency(total), color:'blue' },
                    { label: 'Transactions', value: data.length, color:'orange' },
                    { label: 'Cash Sales', value: this.formatCurrency(cashTotal), color:'green' }
                ];
            } else if (type === 'purchase') {
                const total = data.reduce((a,c)=> a + (parseFloat(c.Total||c.total)||0),0);
                const balance = data.reduce((a,c)=> a + (parseFloat(c.Balance||c.balance)||0),0);
                stats = [
                    { label:'Total Purchases', value:this.formatCurrency(total), color:'blue' },
                    { label:'Items Purchased', value:data.length, color:'orange' },
                    { label:'Unpaid Balance', value:this.formatCurrency(balance), color:'red' }
                ];
            } else if (type === 'expenses') {
                const total = data.reduce((a,c)=> a + (parseFloat(c.amount)||0),0);
                stats = [
                    { label:'Total Expenses', value:this.formatCurrency(total), color:'red' },
                    { label:'Count', value:data.length, color:'orange' }
                ];
            } else if (type === 'vendor') {
                const total = data.reduce((a,c)=>a+c.total,0);
                stats = [
                    { label:'Total Purchased', value:this.formatCurrency(total), color:'blue' },
                    { label:'Active Vendors', value:data.length, color:'green' }
                ];
            } else if (type === 'item') {
                const rev = data.reduce((a,c)=> a+c.revenue,0);
                const qty = data.reduce((a,c)=> a+c.qtySold,0);
                stats = [
                    { label:'Total Revenue', value:this.formatCurrency(rev), color:'blue' },
                    { label:'Units Sold', value:qty, color:'orange' }
                ];
            }

            container.innerHTML = stats.map(s => `
                <div class="stat-card ${s.color}">
                    <div class="stat-content" style="padding:0;">
                        <div class="stat-label">${s.label}</div>
                        <div class="stat-value" style="font-size:1.2rem;">${s.value}</div>
                    </div>
                </div>
            `).join('');
        },

        renderTable: function (type, data) {
            const thead = document.getElementById('reportThead');
            const tbody = document.getElementById('reportTbody');

            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;">No Records Found</td></tr>';
                return;
            }

            let headers = [];
            let rows = '';

            if (type==='sales') {
                headers = ['Date','Customer','Item','Qty','Price','Total','Mode'];
                rows = data.map(d=>`
                    <tr>
                        <td>${this.formatDate(d.date)}</td>
                        <td>${d.customer||'-'}</td>
                        <td>${d['Item Name']||d.item}</td>
                        <td>${d.quantity||d.qty}</td>
                        <td>${d.price}</td>
                        <td>${d.total}</td>
                        <td>${d.mode||'-'}</td>
                    </tr>`).join('');
            } else if (type==='purchase') {
                headers = ['Date','Vendor','Item','Qty','Total','Balance'];
                rows = data.map(d=>`
                    <tr>
                        <td>${this.formatDate(d.Date||d.date)}</td>
                        <td>${d.Vendor||d.vendor}</td>
                        <td>${d['Item Name']||d.item}</td>
                        <td>${d.Quantity||d.qty}</td>
                        <td>${d.Total||d.total}</td>
                        <td style="color:${(d.Balance||d.balance)>0?'red':'green'}">${d.Balance||d.balance}</td>
                    </tr>`).join('');
            } else if (type==='expenses') {
                headers = ['Date','Title','Desc','Amount','Mode'];
                rows = data.map(d=>`
                    <tr>
                        <td>${this.formatDate(d.date)}</td>
                        <td>${d.title||d.category||'-'}</td>
                        <td>${d.description||d.desc||'-'}</td>
                        <td>${d.amount}</td>
                        <td>${d.mode||'-'}</td>
                    </tr>`).join('');
            } else if (type==='vendor') {
                headers = ['Vendor Name','Items Qty','Total Amount','Amount Paid'];
                rows = data.map(d=>`
                    <tr>
                        <td>${d.name}</td>
                        <td>${d.count}</td>
                        <td>${this.formatCurrency(d.total)}</td>
                        <td>${this.formatCurrency(d.paid)}</td>
                    </tr>`).join('');
            } else if (type==='item') {
                headers = ['Item Name','Qty Sold','Revenue Generated'];
                rows = data.map(d=>`
                    <tr>
                        <td>${d.name}</td>
                        <td>${d.qtySold}</td>
                        <td>${this.formatCurrency(d.revenue)}</td>
                    </tr>`).join('');
            }

            thead.innerHTML = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
            tbody.innerHTML = rows;
        },

        // ------------------------------
        // Utils
        // ------------------------------
        formatCurrency: function(val) {
            return 'Rs. ' + (parseFloat(val)||0).toLocaleString();
        },
        formatDate: function(dateStr) {
            if (!dateStr) return '-';
            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
            return dateStr;
        }
    };

    // ===============================
    // Initialize Reports Module
    // ===============================
    document.addEventListener('DOMContentLoaded', () => Reports.init());

    // Expose globally if needed
    window.Reports = Reports;
})();
