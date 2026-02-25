// api.js - Fixed for IMS Cloud with Login, Banners & Broadcasts
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwo1oxc9f05M5_rpwxnW-ZjYHrTJCjWNifvpoxIy8nzOgj-Y63i-pk9As0l2AT2fwipYA/exec";

const API = {
    getUrl: () => {
        const local = localStorage.getItem('apiUrl');
        if (local && local.trim().length > 0) return local;
        const hardcoded = GOOGLE_SCRIPT_URL ? GOOGLE_SCRIPT_URL.trim() : "";
        if (hardcoded && hardcoded.startsWith('http')) return hardcoded;
        return "";
    },

    isLive: () => {
        const url = API.getUrl();
        return (url && url.length > 0);
    },

    isTrial: () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user && user.role === 'trial';
    },

    // --- Categories ---
    async getCategories() {
        if (this.isLive()) {
            const data = await this.get('getCategories');
            return Array.isArray(data) ? data : (data.categories || []);
        } else {
            return [
                { id: 1, name: 'Laptop', status: 'active' },
                { id: 2, name: 'Charger', status: 'active' },
                { id: 3, name: 'RAM', status: 'active' }
            ];
        }
    },

    // --- Inventory ---
    async getInventory() {
        if (this.isLive()) {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const response = await this.get('getInventory', { username: user.username });
                const data = Array.isArray(response) ? response : (response.inventory || []);
                return data.map(item => ({
                    id: item.id,
                    date: item.date,
                    category: item.category,
                    vendor: item['vendor name'] || item.vendor,
                    item: item['item name'] || item.item,
                    brand: item.brand,
                    model: item.model,
                    qty: item.quantity !== undefined ? item.quantity : item.qty,
                    price: item['unit price'] !== undefined ? item['unit price'] : item.price,
                    total: item.total,
                    paid: item['paid amount'] !== undefined ? item['paid amount'] : item.paid,
                    balance: item.balance,
                    mode: item['payment mode'] || item.mode,
                    notes: item.notes,
                    customData: item.customdata || item.customData
                }));
            } catch (e) {
                console.warn("API getInventory failed, returning local storage fallback", e);
                return JSON.parse(localStorage.getItem('inventory') || '[]');
            }
        }
        return JSON.parse(localStorage.getItem('inventory') || '[]');
    },

    let data = JSON.parse(localStorage.getItem('inventory') || '[]');
    if(!data && this.isTrial()) {
        data = [
            {
                InventoryID: 'INV001',
                Type: 'Laptop',
                Make: 'Dell',
                Model: 'Latitude 7480',
                SerialNumber: 'ABC123',
                'CPU Model': 'i5-7th',
                'RAM Capacity Size': '8GB',
                'HDD Capacity Size': '256GB SSD',
                'Cosmetic Option': 'A Grade',
                'Functional Option': '100%',
                'Test Results': 'Passed',
                'Battery Testing Method': 'Standard'
            }
        ];
localStorage.setItem('inventory', JSON.stringify(data));
        }
return data || [];
    },

    async saveInventory(item) {
    if (this.isLive()) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return this.post({ action: 'saveInventory', data: item, username: user.username });
    } else {
        if (this.isTrial()) return { status: 'error', message: 'Disabled in Trial' };
        const items = JSON.parse(localStorage.getItem('inventory') || '[]');
        items.push(item);
        localStorage.setItem('inventory', JSON.stringify(items));
        return { status: 'success' };
    }
},

    async updateInventory(item) {
    if (this.isLive()) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return this.post({ action: 'updateInventory', data: item, username: user.username });
    } else {
        return { status: 'success', message: 'Mock offline update success' };
    }
},

    async bulkSaveInventory(items) {
    if (this.isLive()) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return this.post({ action: 'bulkSaveInventory', data: items, username: user.username });
    } else {
        if (this.isTrial()) return { status: 'error', message: 'Disabled in Trial' };
        const existing = JSON.parse(localStorage.getItem('inventory') || '[]');
        const newArray = existing.concat(items);
        localStorage.setItem('inventory', JSON.stringify(newArray));
        return { status: 'success' };
    }
},

    // --- Banners ---
    async getBanners() {
    if (this.isLive()) {
        const data = await this.get('getBanners');
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.banners)) return data.banners;
        return [];
    } else {
        return [
            { title: "Dashboard Banner", url: "https://orionfxservis.github.io/ims/images/banner/OrionFx - Web Banner.gif", type: "dashboard" },
            { title: "Hero Banner", url: "https://orionfxservis.github.io/ims/images/banner/OrionFx - Web Banner.gif", type: "hero" }
        ];
    }
},

    // --- Broadcasts ---
    async getBroadcasts() {
    if (this.isLive()) {
        const data = await this.get('getBroadcasts');
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.broadcasts)) return data.broadcasts;
        return [];
    } else {
        return [{ Message: "Welcome to IMS Cloud 🚀" }];
    }
},

    // --- Core Fetch Helpers ---
    async get(action, params = {}) {
    try {
        const baseUrl = this.getUrl();

        // Build query string from params object
        let queryStr = `action=${action}&_=${new Date().getTime()}`;
        for (let key in params) {
            queryStr += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
        }

        const sep = baseUrl.includes('?') ? '&' : '?';
        const url = `${baseUrl}${sep}${queryStr}`;

        const res = await fetch(url, {
            method: 'GET'
        });

        if (!res.ok) throw new Error("Network response not ok");

        const jsonData = await res.json();
        console.log(`[API GET ${action}] Response:`, jsonData);
        return jsonData;
    } catch (e) {
        console.error("API GET Error:", e);
        throw e;
    }
},

    async post(data) {
    try {
        const res = await fetch(this.getUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(data)
        });

        const rawText = await res.text();
        console.log(`[API POST ${data.action}] Raw Response Text:`, rawText);

        if (!res.ok) throw new Error("Network response not ok: " + rawText);

        try {
            return JSON.parse(rawText);
        } catch (err) {
            console.error("JSON Parse Error on POST response:", err);
            throw err;
        }
    } catch (e) {
        console.error("API POST Error:", e);
        throw e;
    }
},

    // --- Auth / Login ---
    async login(username, password, company) {
    if (!company) company = 'IMS Cloud'; // default
    if (this.isLive()) {
        let res = await this.post({ action: 'login', username, password, company });
        // Google Sheets strict equality (===) fix: try numeric password if string fails
        if (res.status === 'error' && !isNaN(password) && password.trim() !== '') {
            const retryRes = await this.post({ action: 'login', username, password: Number(password), company });
            if (retryRes.status === 'success') return retryRes;
        }
        return res;
    } else {
        if (username === 'admin' && password === 'admin123') {
            return { status: 'success', user: { username: 'admin', name: 'Admin', role: 'admin', company: 'IMS Cloud' } };
        }
        return { status: 'error', message: 'Invalid Credentials' };
    }
},

    async register(data) {
    if (this.isLive()) {
        return await this.post({ action: 'register', ...data });
    } else {
        return { status: 'success', message: 'Offline Mock: Registration successful' };
    }
},

    // --- Users ---
    async getUsers() {
    if (this.isLive()) {
        const data = await this.get('getUsers');
        return Array.isArray(data) ? data : (data.users || []);
    } else {
        return JSON.parse(localStorage.getItem('users') || '[]');
    }
},

    async updateUserStatus(username, status) {
    if (this.isLive()) {
        return await this.post({ action: 'updateUserStatus', username, status });
    } else {
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        let user = users.find(u => u.username === username);
        if (user) {
            user.status = status;
            localStorage.setItem('users', JSON.stringify(users));
            return { status: 'success' };
        }
        return { status: 'error', message: 'User not found' };
    }
},

    async changePassword(username, oldPassword, newPassword) {
    if (this.isLive()) {
        return await this.post({ action: 'changePassword', username, oldPassword, newPassword });
    } else {
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        let user = users.find(u => u.username === username && u.password === oldPassword);
        if (user) {
            user.password = newPassword;
            localStorage.setItem('users', JSON.stringify(users));
            return { status: 'success' };
        }
        return { status: 'error', message: 'Incorrect old password' };
    }
},

    async testConnection(testUrl) {
    // If a testUrl is provided, we temporarily override getUrl to test it, 
    // or just fetch it directly.
    const urlToTest = testUrl || this.getUrl();

    if (urlToTest && urlToTest.startsWith('http')) {
        try {
            const sep = urlToTest.includes('?') ? '&' : '?';
            const url = `${urlToTest}${sep}action=test&_=${new Date().getTime()}`;
            const res = await fetch(url, { method: 'GET' });
            if (!res.ok) throw new Error("Network response not ok");
            return await res.json();
        } catch (e) {
            return { status: 'error', message: e.message };
        }
    } else {
        return { status: 'error', message: 'No valid Google Script URL provided.' };
    }
},

    async getActivities() {
    if (this.isLive()) {
        return await this.get('getActivities');
    } else {
        return { activities: [] };
    }
},

    async bulkSaveInventory(items) {
    if (this.isLive()) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return this.post({ action: 'bulkSaveInventory', username: user.username, data: items });
    }
    return { status: 'success' };
},

    // --- Sales / Expenses ---
    async getSales() {
    if (this.isLive()) {
        const response = await this.get('getSales');
        const data = Array.isArray(response) ? response : (response.sales || []);
        return data.map(sale => ({
            date: sale.date,
            item: sale['item name'] || sale.item,
            qty: sale.quantity !== undefined ? sale.quantity : sale.qty,
            total: sale.total,
            customer: sale.customer,
            user: sale.user,
            price: sale['unit price'] || sale.price,
            paid: sale['paid amount'] || sale.paid,
            mode: sale['payment mode'] || sale.mode,
            balance: sale.balance
        }));
    }
    return [];
},
    async saveSale(sale) { return this.isLive() ? this.post({ action: 'saveSale', ...sale }) : { status: 'success' }; },
    async getExpenses() {
    if (this.isLive()) {
        const response = await this.get('getExpenses');
        const data = Array.isArray(response) ? response : (response.expenses || []);
        return data.map(exp => ({
            date: exp.date,
            title: exp.title,
            desc: exp.description || exp.desc,
            amount: exp.amount,
            mode: exp['payment mode'] || exp.mode
        }));
    }
    return [];
},
    async saveExpense(exp) { return this.isLive() ? this.post({ action: 'saveExpense', ...exp }) : { status: 'success' }; },

    // --- Banner Operations ---
    async saveBanners(banners) {
    if (this.isLive()) {
        return this.post({ action: 'saveBanners', banners: banners });
    }
    return { status: 'success' };
},

    // --- Category Operations ---
    async addCategory(name) {
    if (this.isLive()) {
        return this.post({ action: 'addCategory', categoryName: name });
    }
    return { status: 'success' };
},
    async deleteCategory(id) {
    if (this.isLive()) {
        return this.post({ action: 'deleteCategory', id: id });
    }
    return { status: 'success' };
},

    // --- Broadcast Operations ---
    async saveBroadcast(payload) {
    if (this.isLive()) {
        return this.post({ action: 'saveBroadcast', ...payload });
    }
    return { status: 'success' };
},
    async deleteBroadcast(broadcastObj) {
    if (this.isLive()) {
        return this.post({
            action: 'deleteBroadcast',
            id: broadcastObj.id || "",
            message: broadcastObj.message
        });
    }
    return { status: 'success' };
},

    // --- Inventory Headers Operations ---
    async getInventoryHeaders() {
    if (this.isLive()) {
        const data = await this.get('getInventoryHeaders');
        return Array.isArray(data) ? data : (data.headers || []);
    }
    return [];
},
    async saveInventoryHeaders(username, company, headers) {
    if (this.isLive()) {
        return this.post({ action: 'saveInventoryHeaders', username, company, headers });
    }
    return { status: 'success' };
}
};