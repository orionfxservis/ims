// admin.js

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadDashboardStats();
    loadRecentActivity(); // Load activity log
    loadUsers();
    loadCategories(); // New: Load categories

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
    const activeUrl = API.getUrl() || localStorage.getItem('apiUrl'); // Prefer active, fallback to local
    const savedPhone = localStorage.getItem('adminPhone');

    if (document.getElementById('sheetId')) {
        document.getElementById('sheetId').value = activeUrl || '';
        // Visual indicator if hardcoded
        if (API.getUrl() && API.getUrl() !== localStorage.getItem('apiUrl')) {
            document.getElementById('sheetId').title = "Using Hardcoded URL from api.js";
            document.getElementById('sheetId').style.borderColor = "#22c55e"; // Green border to indicate active/valid
        }
    }
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
    const regularTbody = document.getElementById('regularUserTableBody');
    const systemTbody = document.getElementById('systemUserTableBody');

    // Safety check if elements exist (in case dashboard.html mismatch)
    if (regularTbody) regularTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';
    if (systemTbody) systemTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

    const users = await API.getUsers();

    // Sort: Pending first for regular users
    const regularUsers = users.filter(u => u.role !== 'admin' && u.role !== 'trial' && u.company !== 'System');
    regularUsers.sort((a, b) => (a.status === 'pending' ? -1 : 1));

    const systemUsers = users.filter(u => u.role === 'admin' || u.role === 'trial' || u.company === 'System');

    // 1. Regular Users Table
    if (regularTbody) {
        if (regularUsers.length > 0) {
            regularTbody.innerHTML = regularUsers.map(user => `
            <tr class="user-row status-row-${user.status || 'pending'}">
                <td>
                    <div class="profile-pic-box" onclick="triggerProfileUpload('${user.username}')" title="Click to change" 
                         style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #333; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid rgba(255,255,255,0.1);">
                        ${user.profileImage ? `<img src="${user.profileImage}" style="width: 100%; height: 100%; object-fit: cover;">` : '<i class="fa-solid fa-user" style="color: #666;"></i>'}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 600; color: white;">${user.name || user.username}</div>
                </td>
                <td>
                    <div style="font-size: 0.9rem;">${user.phone || '-'}</div>
                </td>
                <td>
                    <div style="font-size: 0.9rem; color: #aaa;">${user.address || '-'}</div> 
                </td>
                <td>${user.company || '-'}</td>
                <td>
                    <span class="status-badge status-${user.status || 'pending'}">
                        ${(user.status === 'active' ? '<i class="fa-solid fa-check-circle"></i> ' : user.status === 'locked' ? '<i class="fa-solid fa-lock"></i> ' : '<i class="fa-solid fa-clock"></i> ')} 
                        ${(user.status || 'pending').toUpperCase()}
                    </span>
                </td>
                <td>
                    ${user.status !== 'active' && user.status !== 'locked' ?
                    `<button class="action-btn btn-approve" onclick="approveUser('${user.username}')" title="Approve"><i class="fa-solid fa-check"></i></button>` : ''
                }
                    <button class="action-btn btn-lock" onclick="toggleLock('${user.username}', '${user.status}')" title="${user.status === 'locked' ? 'Unlock' : 'Lock'}">
                        <i class="fa-solid ${user.status === 'locked' ? 'fa-lock-open' : 'fa-lock'}"></i>
                    </button>
                    <button class="action-btn btn-stats" onclick="viewUserProfile('${user.username}')" title="View Stats" style="background:#3b82f6;"><i class="fa-solid fa-chart-column"></i></button>
                    <button class="action-btn btn-edit" onclick="resetPassword('${user.username}')" title="Reset Password"><i class="fa-solid fa-key"></i></button>
                    <button class="action-btn btn-delete" onclick="deleteUser('${user.username}')" title="Delete" style="background:#ef4444;"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
            `).join('');
        } else {
            regularTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">No regular users found.</td></tr>`;
        }
    }

    // 2. System Users Table
    if (systemTbody) {
        if (systemUsers.length > 0) {
            systemTbody.innerHTML = systemUsers.map(user => `
            <tr>
                <td>
                    <div class="profile-pic-box" onclick="triggerProfileUpload('${user.username}')" title="Click to change" 
                         style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #333; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid rgba(255,255,255,0.1);">
                        ${user.profileImage ? `<img src="${user.profileImage}" style="width: 100%; height: 100%; object-fit: cover;">` : '<i class="fa-solid fa-user-shield" style="color: #666;"></i>'}
                    </div>
                </td>
                <td><span style="font-weight:bold; color:${user.role === 'admin' ? '#ef4444' : '#f59e0b'}">${user.role.toUpperCase()}</span></td>
                <td>${user.name}</td>
                <td><span class="status-badge status-active">Active</span></td>
            </tr>
            `).join('');
        } else {
            systemTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No system users.</td></tr>`;
        }
    }
}

// Global variable to track which user is being edited
let userToUploadProfile = null;

window.triggerProfileUpload = function (username) {
    // if (username === 'trial') return alert("Cannot change profile for Guest Trial User."); // Allowed now
    userToUploadProfile = username;
    document.getElementById('profileUpload').click();
};

// Initialize file input listener once
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('profileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0] && userToUploadProfile) {
                const file = e.target.files[0];

                // Basic validation
                if (file.size > 1024 * 1024) { // 1MB limit for mock localstorage safety
                    alert("Image too large. Please use an image under 1MB.");
                    return;
                }

                const reader = new FileReader();
                reader.onload = async function (evt) {
                    const base64 = evt.target.result;

                    // Call API
                    // Show some loading indicator if we could, but for now just wait
                    const res = await API.updateUserProfile(userToUploadProfile, { profileImage: base64 });

                    if (res.status === 'success') {
                        alert("Profile picture updated!");
                        loadUsers(); // Refresh list
                    } else {
                        alert("Error updating profile: " + res.message);
                    }

                    // Reset
                    userToUploadProfile = null;
                    fileInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // ... existing listeners
});

window.approveUser = async function (username) {
    const res = await API.updateUserStatus(username, 'active');

    if (res.status === 'success') {
        // Fetch user details for WhatsApp message
        try {
            const users = await API.getUsers();
            const user = users.find(u => u.username === username);

            if (user && user.phone) {
                const msg = `*Welcome to IMS Cloud!* \n\nHi ${user.name || username},\nYour account has been approved and activated.\n\n*Details:*\nCompany: ${user.company}\nUsername: ${user.username}\n\nYou can now login at: https://ims-cloud.demo/`;
                const url = `https://wa.me/${user.phone}?text=${encodeURIComponent(msg)}`;
                window.open(url, '_blank');
            } else {
                alert("User approved, but phone number not found for WhatsApp notification.");
            }
        } catch (e) {
            console.error("Error fetching user for WA:", e);
        }

        loadUsers();
        loadDashboardStats();
    } else {
        alert("Failed to approve user: " + res.message);
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

window.viewUserProfile = async function (username) {
    // Switch to profile view (reusing logic from app.js but need to access it)
    // Since admin.js is loaded after app.js, we can try to reuse DOM manipulation or call a shared function if available.
    // We'll manually switch view here to be safe.

    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('profile').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'User Stats: ' + username;

    // Fetch user details to populate header
    const users = await API.getUsers();
    const user = users.find(u => u.username === username);

    if (user) {
        document.getElementById('pName').innerText = user.name || user.username;
        document.getElementById('pCompany').innerText = user.company || 'Unknown Company';
        document.getElementById('pRole').innerText = (user.role || 'User').toUpperCase();

        const pAvatar = document.getElementById('pAvatar');
        if (user.profileImage) {
            let imgPath = user.profileImage;
            if (imgPath.startsWith('assets/') && !imgPath.startsWith('../')) imgPath = '../' + imgPath;
            pAvatar.innerHTML = `<img src="${imgPath}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            pAvatar.innerHTML = '<i class="fa-solid fa-user"></i>';
        }
    }

    // Render Chart using app.js function (global scope)
    if (window.loadUserSalesChart) {
        await window.loadUserSalesChart(username);
    } else {
        console.error("loadUserSalesChart function not found");
    }
};

// 4. Dashboard Stats
// 4. Dashboard Stats
async function loadDashboardStats() {
    const users = await API.getUsers();

    // Filter out Admin and Trial from stats
    const realUsers = users.filter(u => u.role !== 'admin' && u.role !== 'trial' && u.username !== 'trial');

    // Companies
    const companies = new Set(realUsers.map(u => (u.company || '').trim().toLowerCase()).filter(c => c && c !== 'system'));

    document.getElementById('countCompanies').innerText = companies.size;
    document.getElementById('countTotalUsers').innerText = realUsers.length;
    document.getElementById('countActiveUsers').innerText = realUsers.filter(u => u.status === 'active').length;
    document.getElementById('countPendingUsers').innerText = realUsers.filter(u => u.status === 'pending').length;
}

// 4b. Recent Activity
async function loadRecentActivity() {
    const list = document.getElementById('adminActivityLog');
    if (!list) return;

    try {
        const res = await API.getActivities();
        const activities = (res && res.activities) ? res.activities : [];

        if (activities.length === 0) {
            list.innerHTML = '<li style="text-align: center; padding: 1rem;">No detailed activity logs yet.</li>';
            return;
        }

        list.innerHTML = activities.map(act => {
            const dateStr = new Date(act.date).toLocaleString();
            return `
            <li style="margin-bottom: 0px; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 0.8rem 0; display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <div style="color: white; font-weight: 500;">
                        <span style="color: #3b82f6;">${act.user}</span> 
                        <span style="color: #aaa; font-weight: 400;">- ${act.action}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 2px;">${act.details}</div>
                </div>
                <div style="font-size: 0.75rem; color: #666; white-space: nowrap; margin-left: 1rem;">${dateStr}</div>
            </li>`;
        }).join('');

    } catch (e) {
        console.error("Error loading activities", e);
        list.innerHTML = `<li style="color: #ef4444; padding: 1rem;">Failed to load activity log.</li>`;
    }
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

window.loadCategories = async function () {
    const tbody = document.getElementById('categoryList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading...</td></tr>';

    try {
        const res = await API.getCategories();
        let categories = [];
        if (res && res.categories) {
            categories = res.categories;
        } else if (Array.isArray(res)) {
            categories = res;
        }

        if (categories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No categories found.</td></tr>';
            return;
        }

        tbody.innerHTML = categories.map(cat => `
            <tr>
                <td>${cat.name}</td>
                <td style="text-align: right;">
                    <button class="action-btn btn-lock" onclick="deleteCategory('${cat.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color: red;">Error: ${e.message}</td></tr>`;
    }
};

window.addCategory = async function () {
    const input = document.getElementById('newCategoryName');
    const name = input.value.trim();
    if (!name) return alert("Please enter a category name");

    // Disable button to prevent double submit?
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    const res = await API.addCategory(name);

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (res.success || res.status === 'success') {
        input.value = '';
        loadCategories();
    } else {
        alert("Error adding category: " + (res.message || 'Unknown error'));
    }
};

window.deleteCategory = async function (id) {
    if (!confirm("Are you sure you want to delete this category? It will be hidden from new lists.")) return;

    const res = await API.deleteCategory(id);
    if (res.success || res.status === 'success') {
        loadCategories();
    } else {
        alert("Error deleting category: " + (res.message || 'Unknown error'));
    }
};

// 7. System Settings
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
