(() => {
    // ===============================
    // Visitor API Logic
    // ===============================
    const VisitorAPI = {
        init: function () {
            const visitorId = this.getVisitorId();

            if (!sessionStorage.getItem('imb_visit_active')) {
                this.logVisit(visitorId);
            } else {
                this.getStats();
            }

            // Refresh stats every 60s
            setInterval(() => this.getStats(), 60000);
        },

        getVisitorId: function () {
            let visitorId = localStorage.getItem('imb_visitor_id');
            if (!visitorId) {
                visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
                localStorage.setItem('imb_visitor_id', visitorId);
            }

            // Use logged-in username if available
            try {
                const userStr = localStorage.getItem('currentUser');
                if (userStr) {
                    const userObj = JSON.parse(userStr);
                    if (userObj?.username) visitorId = userObj.username;
                }
            } catch (e) { console.warn("Error parsing currentUser", e); }

            return visitorId;
        },

        logVisit: async function (visitorId) {
            if (typeof API === 'undefined') return;
            if (!visitorId) visitorId = this.getVisitorId();

            try {
                const response = await API.logVisit(visitorId);
                if (response?.success) {
                    sessionStorage.setItem('imb_visit_active', 'true');
                    this.updateUI(response.stats);
                }
            } catch (err) {
                console.error("Visitor Log Error:", err);
            }
        },

        getStats: async function () {
            if (typeof API === 'undefined') return;
            try {
                const response = await API.getVisitorStats();
                if (response?.success) this.updateUI(response.stats);
            } catch (err) {
                console.error("Visitor Stats Error:", err);
            }
        },

        updateUI: function (stats) {
            if (!stats) return;
            this.setText('vOnline', stats.online);
            this.setText('vToday', stats.today);
            this.setText('vYesterday', stats.yesterday);
            this.setText('vWeek', stats.week);
            this.setText('vMonth', stats.month);
        },

        setText: function (id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = Number(value).toLocaleString();
        }
    };

    // ===============================
    // Landing Page Content Loaders
    // ===============================
    const loadHeroBanner = async () => {
        if (typeof API === 'undefined') return;

        try {
            const banners = await API.getBanners();
            const heroBanner = banners.find(b => b.type === 'hero');
            const container = document.getElementById('heroBannerContainer');

            if (container && heroBanner?.url) {
                container.innerHTML = `
                    <img src="${heroBanner.url}" alt="${heroBanner.title || 'Hero Banner'}"
                         style="max-width:100%;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.4);">
                `;
            }
        } catch (e) {
            console.error("Failed to load hero banner:", e);
        }
    };

    const loadLandingPageStats = async () => {
        if (typeof API === 'undefined') return;

        try {
            const users = await API.getUsers();
            const realUsers = users.filter(u => !['admin','trial'].includes((u.role||'').toLowerCase()) && (u.username||'').toLowerCase() !== 'trial');
            const companies = new Set(realUsers.map(u => (u.company||'').trim().toLowerCase()).filter(c => c && c !== 'system'));

            const lpElements = [
                { id: 'lpCountCompanies', value: companies.size },
                { id: 'lpCountUsers', value: realUsers.length },
                { id: 'lpCountActive', value: realUsers.filter(u => (u.status||'').toLowerCase() === 'active').length },
            ];

            lpElements.forEach(el => {
                const dom = document.getElementById(el.id);
                if (dom) dom.innerText = el.value;
            });

            const inventory = await API.getInventory();
            const lpItems = document.getElementById('lpCountItems');
            if (lpItems && inventory) lpItems.innerText = inventory.length;

        } catch (e) {
            console.error("Failed to load landing page stats:", e);
        }
    };

    // ===============================
    // Init
    // ===============================
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            VisitorAPI.init();
            loadHeroBanner();
            loadLandingPageStats();
        }, 1000);
    });

    // ===============================
    // Expose VisitorAPI globally if needed
    // ===============================
    window.VisitorAPI = VisitorAPI;
})();
