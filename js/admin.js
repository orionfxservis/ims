// admin.js

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAdminAuth()) return; // Stop executing admin scripts for non-admins

    loadDashboardStats();
    loadRecentActivity(); // Load activity log
    loadUsers();
    loadCategories();
    loadBroadcasts(); // New: Load broadcasts
    loadInventoryHeaders(); // New: Load inventory headers
    setupInventoryHeadersListeners();

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Logout from Admin?')) {
            localStorage.removeItem('user'); // Use 'user' to match app.js
            window.location.href = 'index.html'; // Admin is in root folder, not pages
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

    const currentUser = JSON.parse(localStorage.getItem('user')); // Changed from currentUser to user
    const adminTab = document.getElementById('adminTab');

    if (!currentUser || currentUser.role !== 'admin') {
        // If not an admin, hide the admin tab and return false to stop admin.js execution
        if (adminTab) adminTab.classList.add('hidden');
        return false;
    }

    // Unhide the admin tab for admins
    if (adminTab) adminTab.classList.remove('hidden');

    // Load UI data
    document.getElementById('adminName').textContent = currentUser.name || currentUser.username;

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
    return true; // Return true to allow initialization to proceed
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

    // Robust filtering to ensure no users are accidentally dropped due to case sensitivity
    const regularUsers = users.filter(u => {
        const role = String(u.role || 'user').toLowerCase().trim();
        const company = String(u.company || '').trim();
        return role !== 'admin' && role !== 'trial' && company !== 'System';
    });
    regularUsers.sort((a, b) => (String(a.status || 'pending').toLowerCase() === 'pending' ? -1 : 1));

    const systemUsers = users.filter(u => {
        const role = String(u.role || '').toLowerCase().trim();
        const company = String(u.company || '').trim();
        return role === 'admin' || role === 'trial' || company === 'System';
    });

    // 1. Regular Users Table
    if (regularTbody) {
        if (regularUsers.length > 0) {
            regularTbody.innerHTML = regularUsers.map(user => `
            <tr class="user-row status-row-${String(user.status || 'pending').toLowerCase()}">
                <td>
                    <div class="profile-pic-box" onclick="triggerProfileUpload('${user.username}')" title="Click to change" 
                         style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #333; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid rgba(255,255,255,0.1);">
                        ${user.profileImage ? `<img src="${user.profileImage}" style="width: 100%; height: 100%; object-fit: cover;">` : '<i class="fa-solid fa-user" style="color: #666;"></i>'}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 600; color: white;">${user.name || user.username || 'Unknown'}</div>
                </td>
                <td>
                    <div style="font-size: 0.9rem;">${user.phone || '-'}</div>
                </td>
                <td>
                    <div style="font-size: 0.9rem; color: #aaa;">${user.address || '-'}</div> 
                </td>
                <td>${user.company || '-'}</td>
                <td>
                    <span class="status-badge status-${String(user.status || 'pending').toLowerCase()}">
                        ${(String(user.status || '').toLowerCase() === 'active' ? '<i class="fa-solid fa-check-circle"></i> ' : String(user.status || '').toLowerCase() === 'locked' ? '<i class="fa-solid fa-lock"></i> ' : '<i class="fa-solid fa-clock"></i> ')} 
                        ${String(user.status || 'pending').toUpperCase()}
                    </span>
                </td>
                <td>
                    ${String(user.status || '').toLowerCase() !== 'active' && String(user.status || '').toLowerCase() !== 'locked' ?
                    `<button class="action-btn btn-approve" onclick="approveUser('${user.username}')" title="Approve"><i class="fa-solid fa-check"></i></button>` : ''
                }
                    <button class="action-btn btn-lock" onclick="toggleLock('${user.username}', '${user.status}')" title="${String(user.status || '').toLowerCase() === 'locked' ? 'Unlock' : 'Lock'}">
                        <i class="fa-solid ${String(user.status || '').toLowerCase() === 'locked' ? 'fa-lock-open' : 'fa-lock'}"></i>
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
                <td><span style="font-weight:bold; color:${String(user.role).toLowerCase() === 'admin' ? '#ef4444' : '#f59e0b'}">${String(user.role || 'System').toUpperCase()}</span></td>
                <td>${user.name || user.username || 'System User'}</td>
                <td><span class="status-badge status-active">Active</span></td>
            </tr>
            `).join('');
        } else {
            systemTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No system users.</td></tr>`;
        }
    }

    // 3. Populate Inventory Headers User Select
    const userSelect = document.getElementById('invHeaderUserSelect');
    if (userSelect) {
        userSelect.innerHTML = '<option value="" style="color: black;">Select a User</option>' +
            regularUsers.map(u => `<option value="${u.username}" data-company="${u.company || ''}" style="color: black;">${u.name || u.username} (${u.company || 'No Company'})</option>`).join('');
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
async function loadDashboardStats() {
    const users = await API.getUsers();

    // Filter out Admin and Trial from stats
    const realUsers = users.filter(u => String(u.role || '').toLowerCase() !== 'admin' && String(u.role || '').toLowerCase() !== 'trial' && String(u.username || '').toLowerCase() !== 'trial');

    // Companies
    const companies = new Set(realUsers.map(u => String(u.company || '').trim().toLowerCase()).filter(c => c && c !== 'system'));

    document.getElementById('countCompanies').innerText = companies.size;
    document.getElementById('countTotalUsers').innerText = realUsers.length;
    document.getElementById('countActiveUsers').innerText = realUsers.filter(u => String(u.status || '').toLowerCase() === 'active').length;
    document.getElementById('countPendingUsers').innerText = realUsers.filter(u => String(u.status || '').toLowerCase() === 'pending').length;
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
                        <span style="color: #3b82f6;">${act.user || 'Anonymous'}</span> 
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
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading...</div>';

    currentBanners = await API.getBanners(); // Fetch all types

    if (currentBanners.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 2rem;">No banners active.</div>';
        return;
    }

    grid.innerHTML = currentBanners.map((banner, index) => {
        let displayType = 'Main Slider';
        if (banner.type === 'dashboard') displayType = 'Dashboard';
        else if (banner.type === 'hero') displayType = 'Hero Section';

        return `
        <div class="banner-card">
            <img src="${banner.url}" class="banner-img" alt="${banner.title}" style="width: 100%; height: auto; max-height: 200px; object-fit: contain;">
            <div class="banner-actions" style="padding: 0.8rem; display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; background: rgba(0,0,0,0.4);">
                <div style="font-weight: 600; font-size: 0.95rem; color: #fff;">${banner.title}</div>
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <span style="font-size: 0.75rem; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 0.2rem 0.6rem; border-radius: 4px;">${displayType}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="action-btn btn-edit" style="background: #3b82f6; padding: 0.3rem 0.6rem;" onclick="editBanner(${index})" title="Edit / Reuse Banner"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn btn-lock" style="background: #ef4444; padding: 0.3rem 0.6rem;" onclick="deleteBanner(${index})" title="Delete Banner"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.publishBanner = async function () {
    const title = document.getElementById('bnTitle').value;
    const url = document.getElementById('bnUrl').value;
    const type = document.getElementById('bnType').value;

    if (!title || !url) {
        alert("Please provide both title and URL.");
        return;
    }

    const btn = document.querySelector('#bannerForm button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    // Optimistically add to local array
    currentBanners.push({ title, url, type });

    const res = await API.saveBanners(currentBanners);

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (res.status === 'success' || res.success) {
        alert("Banner published successfully!");
        document.getElementById('bannerForm').reset();
        loadBanners(); // Refresh grid
    } else {
        alert("Error publishing banner: " + (res.message || res.error || 'Unknown Error'));
        // Rollback on failure
        currentBanners.pop();
    }
};

window.editBanner = function (index) {
    const banner = currentBanners[index];
    if (!banner) return;

    document.getElementById('bnTitle').value = banner.title;
    document.getElementById('bnUrl').value = banner.url;
    document.getElementById('bnType').value = banner.type || 'main'; // Provide a default if undefined

    // Scroll smoothly to the form so the user sees it populated
    document.getElementById('bnTitle').focus();
    document.getElementById('banners').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.deleteBanner = async function (index) {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    // Remove from local array
    const removed = currentBanners.splice(index, 1)[0];

    const res = await API.saveBanners(currentBanners);

    if (res.status === 'success' || res.success) {
        loadBanners(); // Refresh UI
    } else {
        alert("Error deleting banner: " + (res.message || res.error || 'Unknown Error'));
        // Rollback on failure
        currentBanners.splice(index, 0, removed);
    }
};

window.loadCategories = async function () {
    const tbody = document.getElementById('categoryList');

    if (tbody) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading...</td></tr>';
    console.log("loadCategories: Starting fetch...");

    try {
        const res = await API.getCategories();
        console.log("loadCategories: Fetched data:", res);

        let categories = [];
        if (res && res.categories) {
            categories = res.categories;
        } else if (Array.isArray(res)) {
            categories = res;
        }

        if (!tbody) return; // Wait until after we have the data to decide to abort manipulating DOM

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
        console.log("loadCategories: Rendered successfully.");
    } catch (e) {
        console.error("loadCategories Error:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color: red;">Error: ${e.message}</td></tr>`;
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

    const res = await API.testConnection(apiUrl);

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

// --- Broadcasts ---
window.publishBroadcast = async function () {
    const user = document.getElementById('bcUser').value;
    const message = document.getElementById('bcMessage').value;
    const duration = document.getElementById('bcDuration').value;
    const editId = document.getElementById('bcEditId') ? document.getElementById('bcEditId').value : null;

    if (!user || !message) {
        alert("User Name and Message are required!");
        return;
    }

    const btn = document.querySelector('#broadcastForm button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
        const payload = {
            userName: user,
            message: message,
            duration: duration,
            company: document.getElementById('bcCompany').value,
            contact: document.getElementById('bcContact').value
        };

        if (editId) payload.id = editId; // Add ID for update

        // API.saveBroadcast adds 'action: saveBroadcast' internally
        const res = await API.saveBroadcast(payload);

        if (res.status === 'success') {
            alert('Broadcast Published Successfully!');
            document.getElementById('broadcastForm').reset();
            loadBroadcasts(); // Refresh list
        } else {
            alert('Error: ' + res.message);
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred while publishing.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.cancelEditBroadcast = function () {
    document.getElementById('broadcastForm').reset();
    const idField = document.getElementById('bcEditId');
    if (idField) idField.value = '';

    // Reset button text
    const btn = document.querySelector('#broadcastForm button[type="submit"]');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Broadcast';

    // Hide cancel button if exists
    const cancelBtn = document.getElementById('btnCancelEdit');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

window.editBroadcast = function (dataStr) {
    try {
        const b = JSON.parse(decodeURIComponent(dataStr));
        document.getElementById('bcUser').value = b.userName || '';
        document.getElementById('bcCompany').value = b.company || '';
        document.getElementById('bcContact').value = b.contact || '';
        document.getElementById('bcMessage').value = b.message || '';
        document.getElementById('bcDuration').value = b.duration || '1 Week';

        // Set Hidden ID
        let idField = document.getElementById('bcEditId');
        if (!idField) {
            idField = document.createElement('input');
            idField.type = 'hidden';
            idField.id = 'bcEditId';
            document.getElementById('broadcastForm').appendChild(idField);
        }
        idField.value = data.id;

        // Change Button Text
        const btn = document.querySelector('#broadcastForm button[type="submit"]');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Broadcast';

        // Show Cancel Button
        let cancelBtn = document.getElementById('btnCancelEdit');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'btnCancelEdit';
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn';
            cancelBtn.style.background = '#64748b';
            cancelBtn.style.flex = '1'; /* Make it equal width */
            cancelBtn.style.padding = '0.5rem';
            cancelBtn.style.fontSize = '0.9rem';
            cancelBtn.innerHTML = 'Cancel';
            cancelBtn.onclick = cancelEditBroadcast;

            const container = document.getElementById('bcActionBtns');
            if (container) {
                container.appendChild(cancelBtn);
            } else {
                btn.parentNode.appendChild(cancelBtn); // Fallback
            }
        }
        cancelBtn.style.display = 'block';

        // Scroll to form
        document.getElementById('broadcasts').scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        console.error("Error parsing edit data", e);
    }
};

window.loadBroadcasts = async function () {
    const list = document.getElementById('activeBroadcastsList');

    if (list) list.innerHTML = '<li style="color:#888;">Loading...</li>';

    try {
        const broadcasts = await API.getBroadcasts();
        if (!list) return; // Wait until after we have the data to decide to abort manipulating DOM

        if (broadcasts && broadcasts.length > 0) {
            list.innerHTML = broadcasts.map((b, index) => {
                // Use ID if available, else fall back to index (not ideal for delete but okay for display)
                const id = b.id || 'err_' + index;
                // Encode data for repost
                const dataStr = encodeURIComponent(JSON.stringify(b));

                return `
                <li class="glass-card" style="padding: 0.5rem; margin-bottom: 0.25rem; border-left: 2px solid #eab308; display: flex; flex-direction: column; gap: 0.15rem;">
                    <div style="display:flex; justify-content:space-between; align-items: center;">
                        <div style="display:flex; align-items:center; gap: 0.5rem;">
                            <span style="font-weight: 600; color: #fff; font-size: 0.85rem;">${b.userName}</span>
                            <span style="font-size: 0.7rem; color: #64748b; background: rgba(255,255,255,0.05); padding: 1px 4px; border-radius: 3px;">
                                ${new Date(b.expiry).toLocaleDateString()}
                            </span>
                        </div>
                        <div style="display: flex; gap: 0.25rem;">
                             <button onclick="editBroadcast('${dataStr}')" class="btn-xs" style="background: transparent; border: 1px solid #3b82f6; color: #3b82f6; padding: 1px 6px; font-size: 0.7rem; cursor: pointer; border-radius: 3px;" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="repostBroadcast('${dataStr}')" class="btn-xs" style="background: transparent; border: 1px solid #64748b; color: #94a3b8; padding: 1px 6px; font-size: 0.7rem; cursor: pointer; border-radius: 3px;" title="Repost">
                                <i class="fa-solid fa-reply"></i>
                            </button>
                            <button onclick="deleteBroadcast('${id}')" class="btn-xs" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 1px 6px; font-size: 0.7rem; cursor: pointer; border-radius: 3px;" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.2; padding: 0.1rem 0;">
                        ${b.message}
                    </div>

                    <div style="display:flex; justify-content:flex-start; align-items: center; margin-top: 0;">
                        <div style="font-size: 0.75rem; color: #64748b;">
                            <i class="fa-regular fa-clock"></i> ${b.duration} 
                            ${b.contact ? '&bull; <i class="fa-solid fa-phone"></i> ' + b.contact : ''}
                        </div>
                    </div>
                </li>
            `;
            }).join('');
        } else {
            list.innerHTML = '<li style="color:#888; text-align:center; padding: 1rem;">No active broadcasts found.</li>';
        }
    } catch (e) {
        console.error(e);
        if (list) list.innerHTML = '<li style="color:red;">Error loading broadcasts.</li>';
    }
};

window.deleteBroadcast = async function (id) {
    if (!confirm("Are you sure you want to delete this broadcast?")) return;

    // Optimistic UI update could go here, but let's wait for server
    try {
        const res = await API.deleteBroadcast(id);
        if (res.status === 'success') {
            loadBroadcasts(); // Refresh
        } else {
            alert("Error deleting: " + res.message);
        }
    } catch (e) {
        console.error(e);
        alert("Delete failed.");
    }
};

window.repostBroadcast = function (dataStr) {
    try {
        const data = JSON.parse(decodeURIComponent(dataStr));
        document.getElementById('bcUser').value = data.userName || '';
        document.getElementById('bcCompany').value = data.company || '';
        document.getElementById('bcContact').value = data.contact || '';
        document.getElementById('bcMessage').value = data.message || '';
        if (data.duration) document.getElementById('bcDuration').value = data.duration;

        // Scroll to form
        document.getElementById('broadcasts').scrollIntoView({ behavior: 'smooth' });

        // Highlight form logic? (Optional)
    } catch (e) {
        console.error("Error parsing repost data", e);
    }
};

// --- Custom Inventory Headers ---
let allInventoryHeaders = [];

async function loadInventoryHeaders() {
    try {
        allInventoryHeaders = await API.getInventoryHeaders();
    } catch (e) {
        console.error("Failed to load inventory headers", e);
    }
}

function setupInventoryHeadersListeners() {
    const userSelect = document.getElementById('invHeaderUserSelect');
    const btnAdd = document.getElementById('btnAddHeaderField');
    const btnSave = document.getElementById('btnSaveHeaders');

    if (userSelect) {
        userSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const companyInput = document.getElementById('invHeaderCompany');
            const username = e.target.value;

            if (!username) {
                if (companyInput) companyInput.value = '';
                renderHeaderFields([]);
                return;
            }

            if (companyInput) companyInput.value = selectedOption.getAttribute('data-company') || '';
            const userHeaders = allInventoryHeaders.find(h => h.username === username);
            renderHeaderFields(userHeaders ? userHeaders.headers : []);
        });
    }

    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            const container = document.getElementById('invHeaderFieldsContainer');
            if (!container) return;
            const count = container.querySelectorAll('.header-field-row').length + 1;
            const row = document.createElement('div');
            row.className = 'header-field-row';
            row.style.display = 'flex';
            row.style.gap = '0.5rem';
            row.style.alignItems = 'center';
            row.innerHTML = `
                <label style="min-width: 100px; font-size: 0.85rem; color: #ccc;">Serial No. ${count.toString().padStart(2, '0')}</label>
                <input type="text" class="form-input inv-header-input" placeholder="Field Name" style="padding: 0.4rem; font-size: 0.85rem; flex: 1;">
            `;
            container.appendChild(row);
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const username = userSelect ? userSelect.value : null;
            if (!username) return alert("Please select a user first.");

            const companyInput = document.getElementById('invHeaderCompany');
            const company = companyInput ? companyInput.value : '';
            const container = document.getElementById('invHeaderFieldsContainer');
            const inputs = container ? container.querySelectorAll('.inv-header-input') : [];
            const headers = Array.from(inputs).map(inp => inp.value.trim()).filter(v => v);

            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            btnSave.disabled = true;

            try {
                const res = await API.saveInventoryHeaders(username, company, headers);
                if (res.status === 'success' || res.success) {
                    alert('Inventory headers saved successfully!');
                    // Update local cache
                    const existing = allInventoryHeaders.find(h => h.username === username);
                    if (existing) {
                        existing.headers = headers;
                    } else {
                        allInventoryHeaders.push({ username, company, headers });
                    }
                } else {
                    alert('Error saving headers: ' + (res.message || 'Unknown error'));
                }
            } catch (e) {
                console.error(e);
                alert('An error occurred while saving.');
            } finally {
                btnSave.innerHTML = originalText;
                btnSave.disabled = false;
            }
        });
    }
}

function renderHeaderFields(headers) {
    const container = document.getElementById('invHeaderFieldsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!headers || headers.length === 0) {
        // Default 1 empty field
        addEmptyHeaderField(1);
        return;
    }

    headers.forEach((hdr, index) => {
        const row = document.createElement('div');
        row.className = 'header-field-row';
        row.style.display = 'flex';
        row.style.gap = '0.5rem';
        row.style.alignItems = 'center';
        row.innerHTML = `
            <label style="min-width: 100px; font-size: 0.85rem; color: #ccc;">Serial No. ${(index + 1).toString().padStart(2, '0')}</label>
            <input type="text" class="form-input inv-header-input" value="${hdr.replace(/"/g, '&quot;')}" placeholder="Field Name" style="padding: 0.4rem; font-size: 0.85rem; flex: 1;">
        `;
        container.appendChild(row);
    });
}

function addEmptyHeaderField(count) {
    const container = document.getElementById('invHeaderFieldsContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'header-field-row';
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <label style="min-width: 100px; font-size: 0.85rem; color: #ccc;">Serial No. ${count.toString().padStart(2, '0')}</label>
        <input type="text" class="form-input inv-header-input" placeholder="Field Name (e.g., Condition, Warranty)" style="padding: 0.4rem; font-size: 0.85rem; flex: 1;">
    `;
    container.appendChild(row);
}
