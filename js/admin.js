// admin.js

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadDashboardStats();
    loadUsers();

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout from Admin?')) {
            localStorage.removeItem('currentUser'); // Or session
            window.location.href = 'index.html';
        }
    });

    // Auto-check connection
    if (localStorage.getItem('apiUrl')) {
        // defined later, but DOMContentLoaded runs after parsing
        setTimeout(() => {
            if (window.testConnection) window.testConnection(true);
        }, 500);
    }

    // Banner Live Preview Listeners
    const dbInput = document.getElementById('dashboardBannerUrl');
    if (dbInput) {
        dbInput.addEventListener('input', (e) => updateBannerPreview(e.target.value, 'dashboardBannerPreview'));
    }
    const heroInput = document.getElementById('heroBannerUrl');
    if (heroInput) {
        heroInput.addEventListener('input', (e) => updateBannerPreview(e.target.value, 'heroBannerPreview'));
    }
});

// 1. Auth Check & Seeding
// 1. Auth Check & Seeding
function checkAdminAuth() {
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    const adminExists = users.find(u => u.username === 'admin');

    if (!adminExists) {
        users.push({
            username: 'admin',
            password: 'admin123',
            name: 'Super Admin',
            role: 'admin',
            company: 'System',
            status: 'active'
        });
        localStorage.setItem('users', JSON.stringify(users));
        console.log("Admin account created: admin / admin123");
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'admin') {
        alert("Access Denied. Admins only.");
        window.location.href = 'index.html';
        return;
    }

    // Load UI data
    document.getElementById('adminName').textContent = currentUser.name;

    // Load Settings into Inputs
    const savedApiUrl = localStorage.getItem('apiUrl');
    const savedPhone = localStorage.getItem('adminPhone');

    if (document.getElementById('sheetId')) document.getElementById('sheetId').value = savedApiUrl || '';
    if (document.getElementById('adminPhone')) document.getElementById('adminPhone').value = savedPhone || '';

    loadBanners(); // Load banners on init
}

// 2. Navigation
window.switchTab = function (tabId, navItem) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');

    document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
    navItem.classList.add('active');
}

// 3. User Management
async function loadUsers() {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading users...</td></tr>';

    const users = await API.getUsers();

    // Sort: Pending first
    users.sort((a, b) => (a.status === 'pending' ? -1 : 1));

    tbody.innerHTML = users.filter(u => u.role !== 'admin').map(user => `
        <tr>
            <td>
                <div style="font-weight: 600;">${user.name || user.username}</div>
                <div style="font-size: 0.8rem; color: #aaa;">${user.username}</div>
            </td>
            <td>${user.company}</td>
            <td><span class="status-badge status-${user.status || 'pending'}">${(user.status || 'pending').toUpperCase()}</span></td>
            <td>
                ${user.status !== 'active' ?
            `<button class="action-btn btn-approve" onclick="approveUser('${user.username}')" title="Approve"><i class="fa-solid fa-check"></i></button>` : ''
        }
                <button class="action-btn btn-lock" onclick="toggleLock('${user.username}', '${user.status}')" title="Lock/Unlock">
                    <i class="fa-solid ${user.status === 'locked' ? 'fa-lock-open' : 'fa-lock'}"></i>
                </button>
                <button class="action-btn btn-edit" onclick="resetPassword('${user.username}')" title="Reset Password"><i class="fa-solid fa-key"></i></button>
            </td>
        </tr>
    `).join('');

    if (users.filter(u => u.role !== 'admin').length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">No users found.</td></tr>`;
    }
}

window.approveUser = async function (username) {
    // Optimistic update or wait? Let's wait
    const res = await API.updateUserStatus(username, 'active');
    if (res.status === 'success') {
        loadUsers();
        loadDashboardStats();

        // Find user to get phone
        // We know we just loaded them, so we can find in local list if we had it, or just use what we assume
        // Better: loadUsers refreshes the list, so we might lose the 'pending' one if we filter. 
        // Actually loadUsers re-fetches.

        // Let's assume we want to message the user we just approved.
        // We need their phone number. Since we don't have the user object here easily without re-fetching or passing it,
        // let's grab it from the table before it refreshes? Or rely on API. 
        // Simplest: The user list is already in memory if we used a global variable, or we can just fetch again.

        // For now, let's just use a generic link if phone missing, or try to find it.
        // But since we just called API.updateUserStatus, we don't have the phone back.

        // Hack: The user row is still there until loadUsers finishes. But loadUsers is async.
        // Let's just alert success for now, or improve this later. Use generic link.

        // User request: "not confirmation message that you account is approve".
        // Improved:
        const users = await API.getUsers();
        const user = users.find(u => u.username === username);
        let waLink = `https://wa.me/?text=`;
        if (user && user.phone) {
            waLink = `https://wa.me/${user.phone}?text=`;
        }

        const msg = `Hi ${username}, Your account for IMS Cloud has been approved! You can login now.`;
        window.open(waLink + encodeURIComponent(msg), '_blank');

    } else {
        alert(res.message);
    }
};

window.toggleLock = async function (username, currentStatus) {
    const newStatus = (currentStatus === 'locked') ? 'active' : 'locked';
    const res = await API.updateUserStatus(username, newStatus);
    if (res.status === 'success') {
        loadUsers();
    } else {
        alert(res.message);
    }
};

window.resetPassword = function (username) {
    const newPass = prompt("Enter new password for " + username + ":");
    if (newPass) {
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        let user = users.find(u => u.username === username);
        if (user) {
            user.password = newPass;
            localStorage.setItem('users', JSON.stringify(users));
            alert("Password updated.");
        }
    }
};

// 4. Dashboard Stats
function loadDashboardStats() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const total = users.filter(u => u.role !== 'admin').length;
    const active = users.filter(u => u.role !== 'admin' && u.status === 'active').length;
    const pending = users.filter(u => u.role !== 'admin' && u.status === 'pending').length;

    document.getElementById('countTotalUsers').innerText = total;
    document.getElementById('countActiveUsers').innerText = active;
    document.getElementById('countPendingUsers').innerText = pending;
}

// 5. Banner Management
// 5. Banner Management
let currentBanners = []; // Local state to hold all banners (main, dashboard, hero)

async function loadBanners() {
    const grid = document.getElementById('bannerGrid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading...</div>';

    currentBanners = await API.getBanners(); // Fetch all types

    // Separate types
    const mainBanners = currentBanners.filter(b => b.type === 'main' || !b.type);
    const dashboardBanner = currentBanners.find(b => b.type === 'dashboard');
    const heroBanner = currentBanners.find(b => b.type === 'hero');

    // 1. Render Main Banners
    grid.innerHTML = mainBanners.length ? mainBanners.map((banner, index) => `
        <div class="banner-card">
            <img src="${banner.url}" class="banner-img" alt="${banner.title}">
            <div class="banner-actions">
                <span>${banner.title}</span>
                <button class="action-btn btn-lock" onclick="deleteBanner(${index})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') : '<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 2rem;">No slider banners added.</div>';

    // 2. Render Dashboard Banner
    const dbUrl = dashboardBanner ? dashboardBanner.url : '';
    document.getElementById('dashboardBannerUrl').value = dbUrl;
    updateBannerPreview(dbUrl, 'dashboardBannerPreview');

    // 3. Render Hero Banner
    const heroUrl = heroBanner ? heroBanner.url : '';
    document.getElementById('heroBannerUrl').value = heroUrl;
    updateBannerPreview(heroUrl, 'heroBannerPreview');
}

// Helper to sync all changes to Backend
async function syncBanners() {
    // Collect specific banner inputs if they are being edited, 
    // BUT since we modify 'currentBanners' array in add/delete, we just need to update the specific types from the inputs before saving.

    const dbUrl = document.getElementById('dashboardBannerUrl').value;
    const heroUrl = document.getElementById('heroBannerUrl').value;

    // Update or Add Dashboard Banner in the list
    const dbIndex = currentBanners.findIndex(b => b.type === 'dashboard');
    if (dbIndex >= 0) {
        if (dbUrl) currentBanners[dbIndex].url = dbUrl;
        else currentBanners.splice(dbIndex, 1); // Remove if empty
    } else if (dbUrl) {
        currentBanners.push({ title: 'Dashboard Banner', url: dbUrl, type: 'dashboard' });
    }

    // Update or Add Hero Banner in the list
    const heroIndex = currentBanners.findIndex(b => b.type === 'hero');
    if (heroIndex >= 0) {
        if (heroUrl) currentBanners[heroIndex].url = heroUrl;
        else currentBanners.splice(heroIndex, 1);
    } else if (heroUrl) {
        currentBanners.push({ title: 'Hero Banner', url: heroUrl, type: 'hero' });
    }

    const res = await API.saveBanners(currentBanners);
    if (res.status !== 'success') {
        alert("Error saving banners: " + res.message);
    }
    // No need to alert success on every internal sync, maybe just for manual saves
}

window.saveDashboardBanner = async function () {
    const btn = event.target; // Simple trick to get button
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    await syncBanners();

    if (btn) btn.innerHTML = 'Save';
    alert('Dashboard Banner Updated!');
};

window.saveHeroBanner = async function () {
    const btn = event.target;
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    await syncBanners();

    if (btn) btn.innerHTML = 'Save';
    alert('Hero Banner Updated!');
};

function updateBannerPreview(url, elementId = 'dashboardBannerPreview') {
    const preview = document.getElementById(elementId);
    if (!preview) return;
    if (url) {
        preview.innerHTML = `<img src="${url}" style="max-width: 100%; height: auto; max-height: 120px;" alt="Preview">`;
    } else {
        preview.innerHTML = '<span style="color: #666;">No banner set</span>';
    }
}

window.addBanner = async function () {
    const title = prompt("Enter Banner Title (e.g., Summer Sale):");
    if (!title) return;
    let url = prompt("Enter Image URL:");
    if (!url) url = "https://via.placeholder.com/300x140?text=" + encodeURIComponent(title);

    currentBanners.push({ title, url, type: 'main' });

    await syncBanners();
    loadBanners(); // Refresh grid
};

window.deleteBanner = async function (visualIndex) {
    if (!confirm("Delete this banner?")) return;

    // The visual index corresponds to the 'mainBanners' list, not necessarily 'currentBanners' index
    // We need to find the item in currentBanners
    const mainBanners = currentBanners.filter(b => b.type === 'main' || !b.type);
    const targetBanner = mainBanners[visualIndex];

    // Remove from main list
    const indexInMain = currentBanners.indexOf(targetBanner);
    if (indexInMain > -1) {
        currentBanners.splice(indexInMain, 1);
        await syncBanners();
        loadBanners();
    }
};

// 6. System Settings
window.saveSystemSettings = function () {
    // const id = document.getElementById('sheetId').value; // Legacy
    const apiUrl = document.getElementById('sheetId').value; // Reusing field for Web App URL
    const phone = document.getElementById('adminPhone').value;

    // localStorage.setItem('sheetId', id);
    localStorage.setItem('apiUrl', apiUrl); // Set API URL
    localStorage.setItem('adminPhone', phone);
    localStorage.setItem('adminPhone', phone);
    alert('System settings saved! If URL is valid, refreshing will switch to Real Data mode.');
};

// Auto-check connection moved to DOMContentLoaded

window.testConnection = async function (silent = false) {
    const btn = document.getElementById('btnTestConnection');
    const statusText = document.getElementById('connectionStatus');
    const apiUrl = document.getElementById('sheetId').value;

    if (!apiUrl) {
        if (!silent && btn) alert("Please enter a URL first.");
        return;
    }

    // Temporarily save to test
    localStorage.setItem('apiUrl', apiUrl);

    if (!silent) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
        btn.disabled = true;
    }

    const res = await API.testConnection();

    if (!silent) btn.disabled = false;

    if (res.status === 'success') {
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Connected';
            btn.style.background = '#22c55e'; // Green
        }
        if (statusText) {
            statusText.style.display = 'block';
            statusText.style.color = '#22c55e';
            statusText.textContent = 'Connection Successful!';
        }
    } else {
        if (!silent) {
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Failed';
            btn.style.background = '#ef4444'; // Red
            statusText.style.display = 'block';
            statusText.style.color = '#ef4444';
            statusText.textContent = 'Connection Failed: ' + (res.message || 'Unknown Error');

            // Revert
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-plug"></i> Test';
                btn.style.background = '#64748b';
            }, 3000);
        }
    }
};
