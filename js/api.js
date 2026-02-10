// api.js - API Layer
// Handles communication with Google Apps Script or LocalStorage (Mock)

// --- CONFIGURATION ---
// ADMIN: Paste your Google Apps Script Web App URL here before deploying to GitHub.
// Example: "https://script.google.com/macros/s/AKfycb.../exec"
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxTXZnDHfEpZZ9ynpTnC7MB7VhlbfGZDmMrGTBEacPJDkkRnYDmWxjPRuOc37i21EvDFw/exec"; // Set to "" to use URL from Admin Panel > System Settings

const API = {
    // Config
    getUrl: () => {
        // 1. Use Hardcoded URL (Simplest & Most Reliable for Deployment)
        const hardcoded = GOOGLE_SCRIPT_URL ? GOOGLE_SCRIPT_URL.trim() : "";
        if (hardcoded && hardcoded.startsWith('http')) {
            // console.log("Using Hardcoded API URL:", hardcoded);
            return hardcoded;
        }
        // 2. Fallback to LocalStorage (Dev/Manual)
        const local = localStorage.getItem('apiUrl');
        // console.log("Using LocalStorage API URL:", local);
        return local;
    },
    isLive: () => {
        // Check if we have a valid URL
        const url = API.getUrl();
        const isLive = (url && url.length > 0);

        // Log status only once per page load to avoid spam, or use a flag?
        // simple log for debugging now:
        if (!window._apiLogged) {
            console.log("API Live Status:", isLive, "URL:", url);
            window._apiLogged = true;
        }

        return isLive;
    },
    isTrial: () => {
        const user = JSON.parse(localStorage.getItem('user'));
        return user && user.role === 'trial';
    },

    // --- Dummy Data for Trial ---
    DUMMY_DATA: {
        inventory: [
            { date: '2026-01-20', category: 'Electronics', vendor: 'Samsung World', item: 'Samsung TV 55"', brand: 'Samsung', model: 'UE55', qty: 15, price: 85000, total: 1275000, paid: 1275000, balance: 0, mode: 'Online' },
            { date: '2026-01-21', category: 'Electronics', vendor: 'Apple Store', item: 'Apple iPhone 14', brand: 'Apple', model: '128GB', qty: 8, price: 210000, total: 1680000, paid: 1500000, balance: 180000, mode: 'Cheque' },
            { date: '2026-01-22', category: 'Furniture', vendor: 'Interwood Plus', item: 'Office Chair', brand: 'Interwood', model: 'Ergo-X', qty: 25, price: 18000, total: 450000, paid: 450000, balance: 0, mode: 'Cash' },
            { date: '2026-01-22', category: 'Electronics', vendor: 'Dell Official', item: 'Dell Laptop', brand: 'Dell', model: 'Inspiron', qty: 2, price: 120000, total: 240000, paid: 240000, balance: 0, mode: 'Online' }
        ],
        sales: [
            { date: '2026-01-28', item: 'Samsung TV 55"', qty: 2, price: 95000, total: 190000, customer: 'John Doe', user: 'admin' },
            { date: '2026-02-15', item: 'Office Chair', qty: 5, price: 25000, total: 125000, customer: 'ABC Corp', user: 'admin' },
            { date: '2026-01-15', item: 'Mouse', qty: 10, price: 500, total: 5000, customer: 'X', user: 'testuser' }
        ],
        categories: [
            { id: 1, name: 'Electronics' },
            { id: 2, name: 'Furniture' },
            { id: 3, name: 'Stationery' },
            { id: 4, name: 'Groceries' }
        ],
        banners: [
            { type: 'main', url: 'https://via.placeholder.com/600x300?text=Summer+Sale', title: 'Summer Sale' },
            { type: 'hero', url: 'https://via.placeholder.com/800x400?text=Welcome+Trial+User', title: 'Hero' }
        ],
        broadcasts: [
            { date: '2026-02-10', message: 'Welcome to IMS Cloud! System maintenance scheduled for Sunday.', userName: 'Admin', duration: '1 Week', expiry: '2026-02-17' },
            { date: '2026-02-08', message: 'New stock of Laptops arrived!', userName: 'Sales Team', duration: '2 Weeks', expiry: '2026-02-22' }
        ]
    },

    // --- Auth ---
    async login(username, password) {
        // Force check URL directly -> if URL exists, we try live login regardless of current "Trial" session
        const url = this.getUrl();

        if (url && url.length > 0) {
            try {
                const start = Date.now();
                const result = await this.post({ action: 'login', username, password });
                return result;
            } catch (e) {
                console.error(e);
                return { status: 'error', message: 'Connection Failed: ' + e.message };
            }
        } else {
            // Mock Implementation (from old auth.js logic)
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const users = JSON.parse(localStorage.getItem('users') || '[]');
                    // Seed Admin logic duplicated here for safety in mock mode
                    if (!users.find(u => u.username === 'admin')) {
                        users.push({ username: 'admin', password: 'admin123', name: 'Super Admin', role: 'admin', company: 'System', status: 'active' });
                        localStorage.setItem('users', JSON.stringify(users));
                    }

                    const user = users.find(u => u.username === username && u.password === password);
                    if (user) {
                        if (user.status !== 'active') return resolve({ status: 'error', message: 'Account pending approval' });
                        return resolve({ status: 'success', user });
                    }
                    return resolve({ status: 'error', message: 'Invalid credentials' });
                }, 800);
            });
        }
    },

    async register(data) { // data: { username, password, company, ... }
        if (this.isLive()) {
            return this.post({ action: 'register', ...data });
        } else {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const users = JSON.parse(localStorage.getItem('users') || '[]');
                    if (users.find(u => u.username === data.username)) {
                        return resolve({ status: 'error', message: 'Username exists' });
                    }
                    users.push({ ...data, role: 'user', status: 'pending', date: new Date().toISOString() });
                    localStorage.setItem('users', JSON.stringify(users));
                    return resolve({ status: 'success', message: 'Registration successful' });
                }, 800);
            });
        }
    },

    // --- Admin ---
    async getUsers() {
        // Ensure Trial User is visible in Admin List
        const trialUser = {
            username: 'trial',
            name: 'Guest Trial User',
            role: 'trial',
            company: 'Demo Company Ltd.',
            status: 'active',
            profileImage: 'assets/trial_avatar.jpg' // Default trial avatar
        };

        let users = [];
        if (this.isLive()) {
            try {
                users = await this.get('getUsers');
                if (!Array.isArray(users)) users = [];
            } catch (e) {
                console.error("Error fetching users", e);
                users = [];
            }
        } else {
            users = JSON.parse(localStorage.getItem('users') || '[]');
        }

        // Add mock trial user to list if not present (just for display)
        if (!users.find(u => u.username === 'trial')) {
            users.push(trialUser);
        }

        return Promise.resolve(users);
    },

    async updateUserStatus(username, status) {
        if (this.isLive()) {
            return this.post({ action: 'updateUserStatus', username, status });
        } else {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.username === username);
            if (user) {
                user.status = status;
                localStorage.setItem('users', JSON.stringify(users));
                return Promise.resolve({ status: 'success' });
            }
            return Promise.resolve({ status: 'error', message: 'User not found' });
        }
    },

    async updateUserProfile(username, data) { // data: { profileImage: base64 }
        if (this.isLive()) {
            // Backend support needed, for now mock success or implement if backend ready
            // Assuming backend might not have this yet, return success mock or try post
            // return this.post({ action: 'updateUserProfile', username, ...data });
            return Promise.resolve({ status: 'success', message: 'Backend upload not yet implemented' });
        } else {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.username === username);
            if (user) {
                if (data.profileImage) user.profileImage = data.profileImage;
                localStorage.setItem('users', JSON.stringify(users));

                // If current user is this user, update session too
                const current = JSON.parse(localStorage.getItem('user'));
                if (current && current.username === username) {
                    current.profileImage = data.profileImage;
                    localStorage.setItem('user', JSON.stringify(current));
                }

                return Promise.resolve({ status: 'success' });
            }
            return Promise.resolve({ status: 'error', message: 'User not found' });
        }
    },

    async getActivities() {
        if (this.isLive()) {
            return this.get('getActivities');
        } else {
            return Promise.resolve([]);
        }
    },

    // --- Generic Helpers ---
    async post(data) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            // Google Apps Script requires text/plain to avoid OPTIONS preflight
            const response = await fetch(this.getUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("API POST Parse Error", text);
                alert("Server Error: " + text.substring(0, 100)); // Show part of the error to the user
                return { status: 'error', message: 'Server returned invalid response (Not JSON).' };
            }
        } catch (e) {
            clearTimeout(timeoutId);
            console.error("API POST Error", e);
            if (e.name === 'AbortError') {
                return { status: 'error', message: 'Request Timed Out. Try again.' };
            }
            return { status: 'error', message: 'Connection Error: ' + e.message };
        }
    },

    async get(action) {
        try {
            const baseUrl = this.getUrl();
            const sep = baseUrl.includes('?') ? '&' : '?';
            const url = `${baseUrl}${sep}action=${action}&_=${new Date().getTime()}`; // Cache buster
            const response = await fetch(url);
            return await response.json();
        } catch (e) {
            console.error("API GET Error", e);
            return []; // Return empty list on failure for list-getters
        }
    },

    // --- System ---
    async testConnection() {
        if (!this.isLive()) {
            return { status: 'error', message: 'No API URL configured' };
        }
        try {
            const baseUrl = this.getUrl();
            const sep = baseUrl.includes('?') ? '&' : '?';
            const url = `${baseUrl}${sep}action=test`;
            const response = await fetch(url);
            return await response.json();
        } catch (e) {
            return { status: 'error', message: 'Network Error: ' + e.message };
        }
    },

    // --- Banners ---
    async getBanners() {


        if (this.isLive()) {
            return this.get('getBanners');
        } else {
            let data = JSON.parse(localStorage.getItem('banners'));
            if (!data && this.isTrial()) {
                data = this.DUMMY_DATA.banners.filter(b => b.type === 'main');
                localStorage.setItem('banners', JSON.stringify(data));
                const dash = this.DUMMY_DATA.banners.find(b => b.type === 'main'); // Reuse as example
                const hero = this.DUMMY_DATA.banners.find(b => b.type === 'hero');
                if (hero) localStorage.setItem('heroBanner', hero.url);
                // Note: DUMMY_DATA structure only has main/hero in banners array, logic adjusted to just use what's there
            }
            // Mock
            return Promise.resolve([
                ...(JSON.parse(localStorage.getItem('banners') || '[]').map(b => ({ ...b, type: 'main' }))),
                { title: 'Dashboard', url: localStorage.getItem('dashboardBanner'), type: 'dashboard' },
                { title: 'Hero', url: localStorage.getItem('heroBanner'), type: 'hero' }
            ].filter(b => b.url));
        }
    },

    async saveBanners(banners) {


        if (this.isLive()) {
            return this.post({ action: 'saveBanners', banners });
        } else {
            if (this.isTrial()) return Promise.resolve({ status: 'error', message: 'Editing is disabled in Trial Mode.' });
            // Mock: split back to localStorage
            const main = banners.filter(b => b.type === 'main');
            const dash = banners.find(b => b.type === 'dashboard');
            const hero = banners.find(b => b.type === 'hero');

            localStorage.setItem('banners', JSON.stringify(main));
            if (dash) localStorage.setItem('dashboardBanner', dash.url);
            if (hero) localStorage.setItem('heroBanner', hero.url);

            return Promise.resolve({ status: 'success' });
        }
    },

    // --- Inventory ---
    async getInventory() {


        if (this.isLive()) {
            return this.get('getInventory');
        } else {
            // Mock
            let data = JSON.parse(localStorage.getItem('inventory'));
            if (!data && this.isTrial()) {
                data = this.DUMMY_DATA.inventory;
                localStorage.setItem('inventory', JSON.stringify(data));
            }
            return Promise.resolve(data || []);
        }
    },

    async saveInventory(item) {


        if (this.isLive()) {
            return this.post({ action: 'saveInventory', data: item });
        } else {
            if (this.isTrial()) return Promise.resolve({ status: 'error', message: 'Editing is disabled in Trial Mode.' });
            const items = JSON.parse(localStorage.getItem('inventory') || '[]');
            items.push(item);
            localStorage.setItem('inventory', JSON.stringify(items));
            return Promise.resolve({ status: 'success' });
        }
    },

    // --- Sales ---
    async getSales() {


        if (this.isLive()) {
            return this.get('getSales');
        } else {
            let data = JSON.parse(localStorage.getItem('sales'));
            if (!data && this.isTrial()) {
                data = this.DUMMY_DATA.sales;
                localStorage.setItem('sales', JSON.stringify(data));
            }
            return Promise.resolve(data || []);
        }
    },

    async saveSale(sale) {


        if (this.isLive()) {
            return this.post({ action: 'saveSale', ...sale });
        } else {
            if (this.isTrial()) return Promise.resolve({ status: 'error', message: 'Editing is disabled in Trial Mode.' });
            const sales = JSON.parse(localStorage.getItem('sales') || '[]');
            sales.push({ ...sale, date: new Date().toISOString(), user: sale.user || 'unknown' });
            localStorage.setItem('sales', JSON.stringify(sales));
            return Promise.resolve({ status: 'success' });
        }
    },

    // --- Categories ---
    async getCategories() {


        if (this.isLive()) {
            return this.get('getCategories');
            // Expected format from GS: { success: true, categories: [{id, name}, ...] }
        } else {
            let data = JSON.parse(localStorage.getItem('categories'));
            if (!data && this.isTrial()) {
                data = this.DUMMY_DATA.categories;
                localStorage.setItem('categories', JSON.stringify(data));
            }
            return Promise.resolve({ success: true, categories: data || [] });
        }
    },

    async addCategory(name) {


        if (this.isLive()) {
            return this.post({ action: 'addCategory', categoryName: name });
        } else {
            if (this.isTrial()) return Promise.resolve({ success: false, message: 'Editing is disabled in Trial Mode.' });
            const cats = JSON.parse(localStorage.getItem('categories') || '[]');
            cats.push({ id: new Date().getTime(), name: name });
            localStorage.setItem('categories', JSON.stringify(cats));
            return Promise.resolve({ success: true, message: 'Category added' });
        }
    },

    async deleteCategory(id) {


        if (this.isLive()) {
            return this.post({ action: 'deleteCategory', id: id });
        } else {
            if (this.isTrial()) return Promise.resolve({ success: false, message: 'Editing is disabled in Trial Mode.' });
            const cats = JSON.parse(localStorage.getItem('categories') || '[]');
            const newCats = cats.filter(c => c.id != id);
            localStorage.setItem('categories', JSON.stringify(newCats));
            return Promise.resolve({ success: true, message: 'Category deleted' });
        }
    },

    // --- Expenses ---
    async getExpenses() {


        if (this.isLive()) {
            return this.get('getExpenses');
        } else {
            return Promise.resolve(JSON.parse(localStorage.getItem('expenses') || '[]'));
        }
    },

    async saveExpense(data) {


        if (this.isLive()) {
            return this.post({ action: 'saveExpense', ...data });
        } else {
            if (this.isTrial()) return Promise.resolve({ success: false, message: 'Editing is disabled in Trial Mode.' });
            const expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
            expenses.push({ ...data, date: data.date || new Date().toISOString() });
            localStorage.setItem('expenses', JSON.stringify(expenses));
            return Promise.resolve({ success: true, message: 'Expense saved' });
        }
    },

    // --- Visitor Counter ---
    async logVisit(visitorId) {
        if (this.isLive()) {
            return this.post({ action: 'logVisit', visitorId: visitorId });
        } else {
            // Mock Implementation
            const visits = JSON.parse(localStorage.getItem('visitorLog') || '[]');
            const now = new Date();
            visits.push({ date: now.toISOString(), visitorId: visitorId || 'mock_user' });
            localStorage.setItem('visitorLog', JSON.stringify(visits));
            return this.getVisitorStats(); // Return updated stats
        }
    },

    async getVisitorStats() {
        if (this.isLive()) {
            return this.post({ action: 'getVisitorStats' });
        } else {
            // Mock Implementation
            const visits = JSON.parse(localStorage.getItem('visitorLog') || '[]');
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            let online = 1; // Always 1 for yourself
            let today = 0;
            let yest = 0;
            let week = 0;
            let month = 0;

            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            visits.forEach(v => {
                const d = new Date(v.date);
                const dStr = v.date.split('T')[0];

                if (dStr === todayStr) today++;
                if (dStr === yesterdayStr) yest++;
                if (d > oneWeekAgo) week++;
                if (d > oneMonthAgo) month++;
            });

            return Promise.resolve({
                success: true,
                stats: {
                    online: online,
                    today: today,
                    yesterday: yest,
                    week: week,
                    month: month
                }
            });
        }
    },

    // --- Broadcasts ---
    async saveBroadcast(data) {
        if (this.isLive()) {
            return this.post({ action: 'saveBroadcast', ...data });
        } else {
            if (this.isTrial()) return Promise.resolve({ status: 'error', message: 'Editing is disabled in Trial Mode.' });

            const broadcasts = JSON.parse(localStorage.getItem('broadcasts') || '[]');
            // Calculate mock expiry
            const now = new Date();
            let expiry = new Date();
            if (data.duration === '1 Week') expiry.setDate(now.getDate() + 7);
            else if (data.duration === '2 Weeks') expiry.setDate(now.getDate() + 14);
            else if (data.duration === '3 Weeks') expiry.setDate(now.getDate() + 21);
            else if (data.duration === '1 Month') expiry.setMonth(now.getMonth() + 1);
            else expiry.setDate(now.getDate() + 7);

            if (data.id) {
                // Update existing
                const index = broadcasts.findIndex(b => b.id === data.id);
                if (index !== -1) {
                    broadcasts[index] = {
                        ...broadcasts[index],
                        ...data,
                        expiry: expiry.toISOString()
                    };
                    localStorage.setItem('broadcasts', JSON.stringify(broadcasts));
                    return Promise.resolve({ status: 'success', message: 'Broadcast updated' });
                }
            }

            broadcasts.push({
                ...data,
                date: now.toISOString(),
                expiry: expiry.toISOString(),
                status: 'Active',
                id: 'mock_' + new Date().getTime()
            });
            localStorage.setItem('broadcasts', JSON.stringify(broadcasts));
            return Promise.resolve({ status: 'success', message: 'Broadcast published' });
        }
    },

    async getBroadcasts() {
        if (this.isLive()) {
            return this.get('getBroadcasts');
        } else {
            let data = JSON.parse(localStorage.getItem('broadcasts'));
            if (!data && this.isTrial()) {
                data = this.DUMMY_DATA.broadcasts;
                localStorage.setItem('broadcasts', JSON.stringify(data));
            }
            // Filter expired in mock
            const now = new Date();
            const valid = (data || []).filter(b => new Date(b.expiry) > now);

            return Promise.resolve({ success: true, broadcasts: valid.reverse() });
        }
    },

    async deleteBroadcast(id) {
        if (this.isLive()) {
            return this.post({ action: 'deleteBroadcast', id: id });
        } else {
            if (this.isTrial()) return Promise.resolve({ status: 'error', message: 'Editing is disabled in Trial Mode.' });
            let data = JSON.parse(localStorage.getItem('broadcasts') || '[]');
            // Mock delete (filter out) - Mock data might not have IDs if created before, so add ID check or simple index? 
            // Mock saveBroadcast should also add IDs now.
            // For now, filter by ID assuming updated mock.
            const newData = data.filter(b => b.id != id);
            localStorage.setItem('broadcasts', JSON.stringify(newData));
            return Promise.resolve({ status: 'success', message: 'Broadcast deleted' });
        }
    }
};
