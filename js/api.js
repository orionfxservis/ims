// api.js - API Layer
// Handles communication with Google Apps Script or LocalStorage (Mock)

const API = {
    // Config
    getUrl: () => localStorage.getItem('apiUrl'),
    isLive: () => !!localStorage.getItem('apiUrl'),

    // --- Auth ---
    async login(username, password) {
        if (this.isLive()) {
            return this.post({ action: 'login', username, password });
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
        if (this.isLive()) {
            return this.get('getUsers');
        } else {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            return Promise.resolve(users);
        }
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
            const url = `${this.getUrl()}?action=${action}&_=${new Date().getTime()}`; // Cache buster
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
            const url = `${this.getUrl()}?action=test`;
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
            return Promise.resolve(JSON.parse(localStorage.getItem('inventory') || '[]'));
        }
    },

    async saveInventory(item) {
        if (this.isLive()) {
            return this.post({ action: 'saveInventory', data: item });
        } else {
            const items = JSON.parse(localStorage.getItem('inventory') || '[]');
            items.push(item);
            localStorage.setItem('inventory', JSON.stringify(items));
            return Promise.resolve({ status: 'success' });
        }
    }
};
