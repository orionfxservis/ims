// ===============================
// IMS Frontend JS (Refactored for Modular API)
// ===============================

// ===============================
// API DEFINITION (FIX)
// ===============================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziXKCx9Fl94FGo_gCs7gAdPzTD7ikK7cGYrDAIxSs3lm-5hkO5wRPKWpjsZ7O5_4mKEQ/exec';

const IMS_API = {
    request: async (action, data = null) => {
        // Enforce the hardcoded current Google Script URL to ensure endpoints don't fail, 
        // bypassing any old broken URLs the user manually configured in system settings
        const url = GOOGLE_SCRIPT_URL;
        try {
            if (data) {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action, ...data })
                });
                return await response.json();
            } else {
                const response = await fetch(`${url}?action=${action}&_=${new Date().getTime()}`);
                return await response.json();
            }
        } catch (error) {
            console.error(`API Error (${action}):`, error);
            return { status: 'error', success: false, message: error.message };
        }
    },

    API_Auth: {
        login: (username, password, company) => IMS_API.request('login', { username, password, company }),
        register: (data) => IMS_API.request('register', data),
        changePassword: (username, oldPassword, newPassword) => IMS_API.request('changePassword', { username, oldPassword, newPassword })
    },
    
    API_Inventory: {
        getInventory: () => {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const username = encodeURIComponent(user.username || '');
            return IMS_API.request(`getInventory&username=${username}`).then(res => Array.isArray(res) ? res : (res.inventory || []));
        },
        saveInventory: (item) => {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            return IMS_API.request('saveInventory', { data: item, username: user.username });
        },
        updateInventory: (item) => {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            return IMS_API.request('updateInventory', { data: item, username: user.username });
        },
        bulkSaveInventory: (items) => {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            return IMS_API.request('bulkSaveInventory', { data: items, username: user.username });
        }
    },

    API_Categories: {
        getCategories: () => IMS_API.request('getCategories').then(res => Array.isArray(res) ? res : (res.categories || [])),
        addCategory: (name) => IMS_API.request('addCategory', { categoryName: name }),
        deleteCategory: (id) => IMS_API.request('deleteCategory', { id })
    },

    API_Sales: {
        getSales: () => IMS_API.request('getSales').then(res => Array.isArray(res) ? res : (res.sales || [])),
        saveSale: (sale) => IMS_API.request('saveSale', sale),
        getExpenses: () => IMS_API.request('getExpenses').then(res => Array.isArray(res) ? res : (res.expenses || [])),
        saveExpense: (expense) => IMS_API.request('saveExpense', expense)
    },

    API_Banners: {
        getBanners: () => IMS_API.request('getBanners').then(res => Array.isArray(res) ? res : (res.banners || [])),
        saveBanners: (banners) => IMS_API.request('saveBanners', { banners })
    },

    API_Broadcasts: {
        getBroadcasts: (isAdmin) => IMS_API.request('getBroadcasts').then(res => Array.isArray(res) ? res : (res.broadcasts || [])),
        saveBroadcast: (payload) => IMS_API.request('saveBroadcast', payload)
    },

    API_Users: {
        getUsers: () => IMS_API.request('getUsers').then(res => Array.isArray(res) ? res : (res.users || [])),
        updateUserStatus: (username, status) => IMS_API.request('updateUserStatus', { username, status }),
        updateUserProfile: (username, updates) => IMS_API.request('updateUserProfile', { username, ...updates })
    },

    API_Reviews: {
        getReviews: () => IMS_API.request('getReviews').then(res => Array.isArray(res) ? res : (res.reviews || [])),
        submitReview: (reviewData) => IMS_API.request('saveReview', reviewData)
    },

    API_Pricing: {
        getPricingPackages: async () => {
            const data = localStorage.getItem('pricingPackages');
            if (data) return JSON.parse(data);
            
            return [
                { id: 'starter', name: 'Starter', price: 'Rs 1,500', services: 'Stock Management, Purchase & Sales, Udhaar Tracking, Basic Reports', isPopular: false, desc: '1 User • Small Shops', btnText: 'Start Free' },
                { id: 'business', name: 'Business ⭐', price: 'Rs 3,000', services: 'Everything in Starter, Multi User Access, Customer & Supplier, Profit Dashboard', isPopular: true, desc: '2 Users • Shop + Staff', btnText: 'Start Free Trial 🚀' },
                { id: 'professional', name: 'Professional', price: 'Rs 5,500', services: 'Everything in Business, Advanced Reports, Analytics Dashboard, Priority Support', isPopular: false, desc: '5+ Users • Wholesale', btnText: 'Upgrade Now' },
                { id: 'enterprise', name: 'Enterprise', price: 'Custom', services: 'Everything in Professional, Custom Reports, Multi Branch, API Integration', isPopular: false, desc: 'Unlimited • Large Business', btnText: 'Talk to Sales' }
            ];
        },
        savePricingPackages: async (packages) => {
            localStorage.setItem('pricingPackages', JSON.stringify(packages));
            return { status: 'success', success: true };
        }
    },

    API_Visitors: {
        logVisit: (visitorId) => IMS_API.request('logVisit', { visitorId }),
        getVisitorStats: () => IMS_API.request('getVisitorStats')
    }
};

window.API = {
    getUrl: () => GOOGLE_SCRIPT_URL,
    testConnection: async (url) => {
        try {
            const response = await fetch(`${url}?action=test&_=${new Date().getTime()}`);
            return await response.json();
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    },
    ...IMS_API.API_Auth,
    ...IMS_API.API_Inventory,
    ...IMS_API.API_Categories,
    ...IMS_API.API_Sales,
    ...IMS_API.API_Banners,
    ...IMS_API.API_Broadcasts,
    ...IMS_API.API_Users,
    ...IMS_API.API_Reviews,
    ...IMS_API.API_Pricing,
    ...IMS_API.API_Visitors,
    getActivities: () => IMS_API.request('getActivities'),
    getInventoryHeaders: () => IMS_API.request('getInventoryHeaders').then(res => Array.isArray(res) ? res : (res.headers || []))
};

// ===============================
// 🔥 GLOBAL USER NORMALIZER (FIX)
// ===============================
function normalizeUser(data) {
    return {
        ...data,
        name: data.name || data.fullName || data["Full Name"] || data["Name"] || data.username || "User",
        username: data.username || data["User Name"] || data["Username"] || "",
        company: data.company || data["Company"] || data["Company Name"] || "",
        role: (data.role || data["Role"] || "user").toLowerCase()
    };
}

// ===============================
// Inventory
// ===============================
const InventoryUI = {
    loadInventory: async () => {
        try {
            const data = await IMS_API.API_Inventory.getInventory();
            renderInventoryTable(data);
        } catch (err) {
            console.error("Error loading inventory:", err);
        }
    },

    saveInventory: async (item) => {
        try {
            const res = await IMS_API.API_Inventory.saveInventory(item);
            if (res.status === 'success') {
                alert('Inventory saved!');
                InventoryUI.loadInventory();
            } else {
                alert(res.message || 'Save failed');
            }
        } catch (err) {
            console.error("Error saving inventory:", err);
        }
    },

    updateInventory: async (item) => {
        try {
            const res = await IMS_API.API_Inventory.updateInventory(item);
            if (res.status === 'success') {
                alert('Inventory updated!');
                InventoryUI.loadInventory();
            } else {
                alert(res.message || 'Update failed');
            }
        } catch (err) {
            console.error("Error updating inventory:", err);
        }
    },

    bulkSave: async (items) => {
        try {
            const res = await IMS_API.API_Inventory.bulkSaveInventory(items);
            if (res.status === 'success') {
                alert('Bulk inventory saved!');
                InventoryUI.loadInventory();
            } else {
                alert(res.message || 'Bulk save failed');
            }
        } catch (err) {
            console.error("Error bulk saving inventory:", err);
        }
    }
};

// ===============================
// Categories
// ===============================
const CategoryUI = {
    loadCategories: async () => {
        try {
            const categories = await IMS_API.API_Categories.getCategories();
            renderCategoryList(categories);
        } catch (err) {
            console.error("Error loading categories:", err);
        }
    },

    addCategory: async (name) => {
        try {
            const res = await IMS_API.API_Categories.addCategory(name);
            if (res.status === 'success') CategoryUI.loadCategories();
        } catch (err) { console.error(err); }
    },

    deleteCategory: async (id) => {
        try {
            const res = await IMS_API.API_Categories.deleteCategory(id);
            if (res.status === 'success') CategoryUI.loadCategories();
        } catch (err) { console.error(err); }
    }
};

// ===============================
// 🔥 AUTH (FIXED)
// ===============================
const AuthUI = {
    login: async (username, password, company) => {
        try {
            const res = await IMS_API.API_Auth.login(username, password, company);

            if (res.status === 'success' || res.success) {

                let userData = res.user || res;

                // ✅ APPLY FIX
                userData = normalizeUser(userData);

                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('currentUser', JSON.stringify(userData));

                alert('Login successful!');

                // Redirect
                window.location.href = userData.role === 'admin'
                    ? 'admin.html'
                    : 'pages/dashboard.html';

            } else {
                alert(res.message || 'Login failed');
            }

        } catch (err) {
            console.error("Login error:", err);
        }
    },

    changePassword: async (username, oldPassword, newPassword) => {
        try {
            const res = await IMS_API.API_Auth.changePassword(username, oldPassword, newPassword);
            alert(res.message || (res.status === 'success' ? 'Password changed' : 'Failed'));
        } catch (err) {
            console.error(err);
        }
    }
};

// ===============================
// Sales & Expenses
// ===============================
const FinanceUI = {
    loadSales: async () => {
        try {
            const sales = await IMS_API.API_Sales.getSales();
            renderSalesTable(sales);
        } catch (err) { console.error(err); }
    },

    saveSale: async (sale) => {
        try {
            const res = await IMS_API.API_Sales.saveSale(sale);
            if (res.status === 'success') FinanceUI.loadSales();
        } catch (err) { console.error(err); }
    },

    loadExpenses: async () => {
        try {
            const expenses = await IMS_API.API_Sales.getExpenses();
            renderExpensesTable(expenses);
        } catch (err) { console.error(err); }
    },

    saveExpense: async (expense) => {
        try {
            const res = await IMS_API.API_Sales.saveExpense(expense);
            if (res.status === 'success') FinanceUI.loadExpenses();
        } catch (err) { console.error(err); }
    }
};

// ===============================
// Banners & Broadcasts
// ===============================
const BannerUI = {
    loadBanners: async () => {
        try {
            const banners = await IMS_API.API_Banners.getBanners();
            renderBannerCarousel(banners);
        } catch (err) { console.error(err); }
    },
    saveBanners: async (banners) => {
        try { await IMS_API.API_Banners.saveBanners(banners); }
        catch (err) { console.error(err); }
    }
};

const BroadcastUI = {
    loadBroadcasts: async (isAdmin = false) => {
        try {
            const broadcasts = await IMS_API.API_Broadcasts.getBroadcasts(isAdmin);
            renderBroadcastList(broadcasts);
        } catch (err) { console.error(err); }
    },
    saveBroadcast: async (payload) => {
        try { await IMS_API.API_Broadcasts.saveBroadcast(payload); }
        catch (err) { console.error(err); }
    }
};

// ===============================
// Users
// ===============================
const UserUI = {
    loadUsers: async () => {
        try {
            const users = await IMS_API.API_Users.getUsers();
            renderUserTable(users);
        } catch (err) { console.error(err); }
    },
    updateUserStatus: async (username, status) => {
        try { await IMS_API.API_Users.updateUserStatus(username, status); }
        catch (err) { console.error(err); }
    }
};

// ===============================
// Reviews
// ===============================
const ReviewUI = {
    loadReviews: async () => {
        try {
            const reviews = await IMS_API.API_Reviews.getReviews();
            renderReviewList(reviews);
        } catch (err) { console.error(err); }
    },
    submitReview: async (reviewData) => {
        try { await IMS_API.API_Reviews.submitReview(reviewData); }
        catch (err) { console.error(err); }
    }
};

// ===============================
// Visitor Tracking
// ===============================
const VisitorUI = {
    logVisit: async (visitorId) => {
        try { await IMS_API.API_Visitors.logVisit(visitorId); }
        catch (err) { console.error(err); }
    },
    getStats: async () => {
        try {
            const stats = await IMS_API.API_Visitors.getVisitorStats();
            renderVisitorStats(stats.stats);
        } catch (err) { console.error(err); }
    }
};

// ===============================
// Initialization
// ===============================
document.addEventListener('DOMContentLoaded', () => {
    InventoryUI.loadInventory();
    CategoryUI.loadCategories();
    BannerUI.loadBanners();
    BroadcastUI.loadBroadcasts();
    UserUI.loadUsers();
    ReviewUI.loadReviews();
    FinanceUI.loadSales();
    FinanceUI.loadExpenses();
    VisitorUI.getStats();
});