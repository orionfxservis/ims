// Check Admin Auth on Load
document.addEventListener('DOMContentLoaded', () => {
    Auth.checkAdmin();
    loadUsers();

    // Sidebar toggle (for mobile mainly)
    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
});

// Navigation
window.showSection = (sectionId) => {
    document.getElementById('usersSection').classList.add('hidden');
    document.getElementById('bannersSection').classList.add('hidden');
    document.getElementById('settingsSection').classList.add('hidden');

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (sectionId === 'users') {
        document.getElementById('usersSection').classList.remove('hidden');
        document.querySelector('.nav-item:nth-child(1)').classList.add('active');
        loadUsers();
    } else if (sectionId === 'banners') {
        document.getElementById('bannersSection').classList.remove('hidden');
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
    } else if (sectionId === 'settings') {
        document.getElementById('settingsSection').classList.remove('hidden');
        document.querySelector('.nav-item:nth-child(3)').classList.add('active');
        // Load current URL
        document.getElementById('apiUrlInput').value = localStorage.getItem('IMS_API_URL') || '';
    }
}

// Connection Settings Logic
document.getElementById('connectionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = document.getElementById('apiUrlInput').value.trim();

    if (!url.startsWith('https://script.google.com/')) {
        showToast('Invalid URL format. Must start with https://script.google.com/', 'error');
        return;
    }

    localStorage.setItem('IMS_API_URL', url);
    CONFIG.API_URL = url; // Update dynamic config
    showToast('Connected! Reloading...', 'success');

    setTimeout(() => {
        window.location.reload();
    }, 1500);
});

window.disconnectApi = () => {
    if (confirm('Disconnect from Google Sheet? The system will revert to Demo Mode.')) {
        localStorage.removeItem('IMS_API_URL');
        CONFIG.API_URL = "";
        document.getElementById('apiUrlInput').value = "";
        showToast('Disconnected. Reloading...', 'info');
        setTimeout(() => window.location.reload(), 1500);
    }
};

// User Management
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner" style="border-color:#4F46E5; border-top-color:transparent; margin: 0 auto;"></div></td></tr>';

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUsers' })
        });

        // Check for HTTP errors first
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text(); // Get raw text first
        let result;

        try {
            result = JSON.parse(text);
        } catch (e) {
            // If parse fails, it's likely HTML (Google error page)
            console.error("Non-JSON response:", text);
            throw new Error("Received HTML instead of JSON. Check deployment permissions (Must be 'Anyone').");
        }

        if (result && result.success) {
            renderUsers(result.users);
        } else {
            const msg = result ? (result.message || JSON.stringify(result)) : "Empty response";
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Server Error: ${msg}</td></tr>`;
        }
    } catch (error) {
        console.error("Error loading users:", error);

        let errorMsg = error.message || "Unknown error";
        // If it's a CORS error, it's often opaque, but we can give a hint
        if (errorMsg.includes('Failed to fetch')) {
            errorMsg = "Network/CORS Error. Check: 1. URL is correct 2. Deployment is 'Anyone'";
        }

        if (!CONFIG.API_URL) {
            // Mock data for UI preview if API fails/not set
            renderUsers([
                { timestamp: new Date(), name: 'John Doe', username: 'john', status: 'Pending' },
                { timestamp: new Date(), name: 'Jane Smith', username: 'jane', status: 'Approved' }
            ]);
            showToast('Using Demo Data (No API URL)', 'info');
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">
                Error: ${errorMsg}<br>
                <small>Check Console for details.</small>
            </td></tr>`;
            showToast('Failed to load data from Sheet', 'error');
        }
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
        return;
    }

    users.forEach(user => {
        // Filter out ADMIN role AND any username containing 'admin' (case insensitive)
        if (user.role === 'ADMIN' || user.username.toLowerCase().includes('admin')) return;

        const row = document.createElement('tr');

        let statusBadge = '';
        switch (user.status) {
            case 'Approved': statusBadge = '<span class="badge badge-success">Approved</span>'; break;
            case 'Pending': statusBadge = '<span class="badge badge-warning">Pending</span>'; break;
            case 'Locked': statusBadge = '<span class="badge badge-danger">Locked</span>'; break;
            default: statusBadge = `<span class="badge">${user.status}</span>`;
        }

        // Actions
        let actions = '<div style="display:flex; gap:8px;">';

        if (user.status === 'Pending') {
            actions += `<button class="btn-sm btn-success" onclick="updateStatus('${user.username}', 'Approved')" title="Approve"><i class="fa-solid fa-check"></i></button>`;
            actions += `<button class="btn-sm btn-danger" onclick="updateStatus('${user.username}', 'Rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>`;
        } else {
            if (user.status === 'Locked') {
                actions += `<button class="btn-sm btn-success" onclick="updateStatus('${user.username}', 'Approved')" title="Unlock"><i class="fa-solid fa-unlock"></i></button>`;
            } else {
                actions += `<button class="btn-sm btn-warning" onclick="updateStatus('${user.username}', 'Locked')" title="Lock"><i class="fa-solid fa-lock"></i></button>`;
            }
        }

        actions += `<button class="btn-sm btn-primary" onclick="openEditModal('${user.username}')" title="Change Password"><i class="fa-solid fa-key"></i></button>`;
        actions += `<button class="btn-sm btn-danger" onclick="deleteUser('${user.username}')" title="Delete"><i class="fa-solid fa-trash"></i></button>`;
        actions += '</div>';

        row.innerHTML = `
            <td>${new Date(user.timestamp).toLocaleDateString()}</td>
            <td>${user.name}</td>
            <td>${user.username}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
        `;
        tbody.appendChild(row);
    });
}

// Action Handlers
window.updateStatus = async (username, status) => {
    if (!confirm(`Are you sure you want to set ${username} to ${status}?`)) return;

    await performAction({
        action: 'updateUserStatus',
        username: username,
        newStatus: status
    });
};

window.deleteUser = async (username) => {
    if (!confirm(`Are you sure you want to DELETE ${username}? This cannot be undone.`)) return;

    await performAction({
        action: 'updateUserStatus',
        username: username,
        deleteUser: true
    });
};

async function performAction(data) {
    showToast('Processing...', 'info');
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            showToast('Success!', 'success');
            loadUsers();
        } else {
            showToast(result.message || 'Action failed', 'error');
        }
    } catch (e) {
        // Mock success for UI testing
        if (!CONFIG.API_URL) {
            showToast('Mock Action Success', 'success');
            loadUsers(); // Reloads mock data
        } else {
            showToast('Network error', 'error');
        }
    }
}

// Modal Logic
window.openEditModal = (username) => {
    document.getElementById('editUsername').value = username;
    document.getElementById('editPassword').value = '';
    document.getElementById('editModal').classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('editModal').classList.add('hidden');
};

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('editUsername').value;
    const password = document.getElementById('editPassword').value;

    if (!password) {
        closeModal();
        return;
    }

    await performAction({
        action: 'updateUserStatus',
        username: username,
        newPassword: password
    });

    closeModal();
});


// Helper for Toasts (Duplicated from index.html, could be shared)
function showToast(msg, type) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMessage');
    toast.className = `toast ${type} show`;
    msgEl.textContent = msg;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Banner Management Logic
window.previewBanner = () => {
    const url = document.getElementById('bannerUrlInput').value.trim();
    if (!url) {
        showToast('Please enter an image URL', 'error');
        return;
    }

    const img = document.getElementById('bannerPreviewImg');
    const container = document.getElementById('bannerPreviewContainer');
    const publishBtn = document.getElementById('publishBtn');

    // Load image to test URL
    img.src = url;
    img.onload = () => {
        container.style.display = 'block';
        publishBtn.disabled = false;
        showToast('Preview loaded successfully', 'success');
    };
    img.onerror = () => {
        container.style.display = 'none';
        publishBtn.disabled = true;
        showToast('Failed to load image. Check URL.', 'error');
    };
};

window.publishBanner = async () => {
    const url = document.getElementById('bannerUrlInput').value.trim();
    if (!url) return;

    if (!confirm('Are you sure you want to set this as the active banner?')) return;

    showToast('Publishing...', 'info');
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveBanner', url: url })
        });
        const result = await response.json();

        if (result.success) {
            showToast('Banner Published Successfully!', 'success');
            // Reset UI
            document.getElementById('bannerUrlInput').value = '';
            document.getElementById('bannerPreviewContainer').style.display = 'none';
            document.getElementById('publishBtn').disabled = true;
        } else {
            console.error("Publish Error:", result);

            // CRITICAL DIAGNOSTIC
            if (result.result === 'success') {
                alert("CRITICAL ERROR: YOUR GOOGLE SCRIPT IS OUTDATED\n\nThe server returned 'result: success', but we expect 'success: true'.\n\nThis PROVES that the web URL is pointing to OLD CODE.\n\nYou likely didn't Save the file before Deploying, or you are deploying the wrong script.");
                return;
            }

            if (result.message === 'Invalid action') {
                alert("DEPLOYMENT ERROR:\nThe server does not recognize 'saveBanner'.\n\nYou MUST create a 'New Version' in Google Apps Script deployment to update the code.");
            } else {
                showToast('Failed: ' + result.message, 'error');
            }
        }
    } catch (e) {
        showToast('Error publishing banner', 'error');
        console.error(e);
    }
};
