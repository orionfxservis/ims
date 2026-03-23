// inventory.js - Inventory Section Logic (FINAL REWRITE)

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    loadInventory();

    const searchInput = document.getElementById('inventorySearch');
    if (searchInput) {
        searchInput.addEventListener('input', () =>
            filterInventory(searchInput.value.toLowerCase())
        );
    }

    const exportBtn = document.getElementById('exportInventoryCsv');
    if (exportBtn) exportBtn.addEventListener('click', exportInventoryCSV);

    const importInput = document.getElementById('importExcelInput');
    if (importInput) importInput.addEventListener('change', handleInventoryImport);
});

// -------------------- 1. Load Inventory --------------------
async function loadInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    const headerRow = document.getElementById('inventoryHeaderRow');
    if (!tbody || !headerRow) return;

    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Loading Inventory...</td></tr>`;

    try {
        const inventory = await API.getInventory();
        if (!inventory || inventory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No inventory found.</td></tr>`;
            return;
        }

        // Fetch dynamic headers from window or sample
        let headers = window.userCustomHeaders || [];
        if (headers.length === 0) {
            let sample = inventory[0];
            if (typeof sample.data === 'string') sample = JSON.parse(sample.data);
            else if (typeof sample.customData === 'string') sample = JSON.parse(sample.customData);
            headers = Object.keys(sample);
        }

        // Render table headers
        headerRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('') + `<th>Actions</th>`;

        // Render table rows
        tbody.innerHTML = inventory.map((item, index) => {
            let rowData = {};
            try {
                rowData = typeof item.data === 'string' ? JSON.parse(item.data)
                    : (item.customdata && typeof item.customdata === 'string') ? { ...item, ...JSON.parse(item.customdata) }
                        : (item.customData && typeof item.customData === 'string') ? { ...item, ...JSON.parse(item.customData) }
                            : item;
            } catch (e) {
                console.warn('Parse error:', e);
            }

            const cells = headers.map(h => {
                const key = Object.keys(rowData).find(k => k.toLowerCase().trim() === h.toLowerCase().trim());
                return `<td>${key ? rowData[key] ?? '-' : '-'}</td>`;
            }).join('');

            const editId = item.id || item.batchid || (index + 1);

            return `
                <tr data-id="${editId}">
                    ${cells}
                    <td>
                        <button class="btn btn-sm" onclick="editInventoryItem('${editId}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteInventoryItem('${editId}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Error loading inventory:", e);
        tbody.innerHTML = `<tr><td colspan="10" style="color:red; text-align:center;">Failed to load inventory.</td></tr>`;
    }
}

// -------------------- 2. Filter Inventory --------------------
function filterInventory(query) {
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

// -------------------- 3. Delete Item --------------------
async function deleteInventoryItem(id) {
    if (!confirm('Delete this item?')) return;

    try {
        const res = await API.deleteInventory({ id });
        if (res?.status === 'success') {
            alert('Deleted successfully!');
            loadInventory();
        } else {
            alert('Delete failed');
        }
    } catch (e) {
        console.error(e);
        alert('Error deleting item');
    }
}

// -------------------- 4. Export Inventory --------------------
async function exportInventoryCSV() {
    try {
        const inventory = await API.getInventory();
        if (!inventory.length) return alert('No data');

        let headers = window.userCustomHeaders || [];
        if (headers.length === 0) {
            let sample = inventory[0];
            if (typeof sample.data === 'string') sample = JSON.parse(sample.data);
            headers = Object.keys(sample);
        }

        const rows = inventory.map(item => {
            let rowData = typeof item.data === 'string' ? JSON.parse(item.data) : item;
            return headers.map(h => `"${rowData[h] ?? ''}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'inventory.csv';
        a.click();
    } catch (e) {
        console.error(e);
        alert('Export failed');
    }
}

// -------------------- 5. Edit Item --------------------
window.editInventoryItem = function (id) {
    document.getElementById('searchEditId').value = id;
    searchInventoryForEdit();
}

// -------------------- 6. Search & Edit Form --------------------
async function searchInventoryForEdit() {
    const id = document.getElementById('searchEditId').value.trim();
    if (!id) return alert('Enter ID');

    const inventory = await API.getInventory();
    const item = inventory.find(i => i.id == id || i.batchid == id);
    if (!item) return alert('Not found');

    const rowData = typeof item.data === 'string' ? JSON.parse(item.data) : item;
    const headers = window.userCustomHeaders || Object.keys(rowData);
    const container = document.getElementById('editDynamicFieldsContainer');
    container.innerHTML = '';

    headers.forEach(h => {
        container.innerHTML += `
            <div class="form-group">
                <label>${h}</label>
                <input type="text" name="${h}" value="${rowData[h] || ''}" class="form-input">
            </div>
        `;
    });

    const form = document.getElementById('editInventoryForm');
    form.dataset.editId = id;
    form.classList.remove('hidden');
}

// -------------------- 7. Submit Edit --------------------
function submitEditInventory() {
    const form = document.getElementById('editInventoryForm');
    const id = form.dataset.editId;
    const inputs = form.querySelectorAll('input[name]');
    const data = {};

    inputs.forEach(i => data[i.name] = i.value);

    API.updateInventory({ id, data })
        .then(res => {
            if (res.status === 'success') {
                alert('Updated!');
                loadInventory();
                form.reset();
                form.classList.add('hidden');
            } else {
                alert('Update failed');
            }
        });
}

// -------------------- GLOBAL --------------------
window.deleteInventoryItem = deleteInventoryItem;