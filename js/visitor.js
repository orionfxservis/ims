// Visitor Counter Logic

const VisitorAPI = {
    // Check if user visited in this session (or persistent check if desired)
    // Using sessionStorage for session-based counting, or localStorage for device-based.
    // "Actual visitors" usually means page hits or unique sessions.
    // Let's use sessionStorage to limit spamming the DB on reload in same tab, 
    // but log new visit on new tab/window.

    init: function () {
        // Generate or retrieve a unique ID for this device/browser
        let visitorId = localStorage.getItem('imb_visitor_id');
        if (!visitorId) {
            visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
            localStorage.setItem('imb_visitor_id', visitorId);
        }

        // Log visit if not logged in this session (to avoid refresh spam, saving quota)
        // AND/OR if we want to support "Online" accurately across tabs, we can log.
        // Let's stick to "Log once per session" but use the Unique ID so backend counts distinct users.
        // Actually, if we use the Unique ID, we can relax the session check if we want, 
        // but Google Apps Script has quotas. Better to check session.
        if (!sessionStorage.getItem('imb_visit_active')) {
            this.logVisit(visitorId);
        } else {
            this.getStats();
        }

        // Refresh stats periodically
        setInterval(() => {
            this.getStats();
        }, 60000);
    },

    logVisit: function (visitorId) {
        if (typeof API === 'undefined') return;

        // If no ID passed (e.g. called manually), try get it
        if (!visitorId) visitorId = localStorage.getItem('imb_visitor_id');

        // Use actual username if logged in
        try {
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                if (userObj && userObj.username) {
                    visitorId = userObj.username;
                }
            }
        } catch (e) { }

        console.log("Visitor: Logging visit for ID:", visitorId);
        API.logVisit(visitorId)
            .then(response => {
                if (response.success) {
                    sessionStorage.setItem('imb_visit_active', 'true');
                    this.updateUI(response.stats);
                }
            })
            .catch(err => console.error("Visitor Log Error:", err));
    },



    getStats: function () {
        if (typeof API === 'undefined') return;

        console.log("Visitor: Fetching stats...");
        API.getVisitorStats()
            .then(response => {
                console.log("Visitor: Stats response:", response);
                if (response.success) {
                    this.updateUI(response.stats);
                } else {
                    console.warn("Visitor: Stats fetch failed", response);
                }
            })
            .catch(err => console.error("Visitor Stats Error:", err));
    },

    updateUI: function (stats) {
        if (!stats) return;

        // Animate numbers? For now, just set text.
        this.setSafe('vOnline', stats.online);
        this.setSafe('vToday', stats.today);
        this.setSafe('vYesterday', stats.yesterday);
        this.setSafe('vWeek', stats.week);
        this.setSafe('vMonth', stats.month);
    },

    setSafe: function (id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val.toLocaleString();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to ensure API is ready
    setTimeout(() => {
        VisitorAPI.init();
        loadHeroBanner();
        loadLandingPageStats();
    }, 1000);
});

async function loadHeroBanner() {
    try {
        if (typeof API === 'undefined') return;
        const banners = await API.getBanners();
        const heroBanner = banners.find(b => b.type === 'hero');

        const container = document.getElementById('heroBannerContainer');
        if (container && heroBanner && heroBanner.url) {
            container.innerHTML = `<img src="${heroBanner.url}" alt="${heroBanner.title || 'Hero Banner'}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">`;
        }
    } catch (e) {
        console.error("Failed to load hero banner", e);
    }
}

// Removed loadHomeBroadcasts()

async function loadLandingPageStats() {
    try {
        if (typeof API === 'undefined') return;

        const users = await API.getUsers();
        // Filter out admin and trial accounts from being counted
        const realUsers = users.filter(u => String(u.role || '').toLowerCase() !== 'admin' && String(u.role || '').toLowerCase() !== 'trial' && String(u.username || '').toLowerCase() !== 'trial');

        // Use a Set to calculate unique companies
        const companies = new Set(realUsers.map(u => String(u.company || '').trim().toLowerCase()).filter(c => c && c !== 'system'));

        const countCompanies = companies.size;
        const countTotalUsers = realUsers.length;
        const countActiveUsers = realUsers.filter(u => String(u.status || '').toLowerCase() === 'active').length;

        // Populate elements
        const lpCompanies = document.getElementById('lpCountCompanies');
        if (lpCompanies) lpCompanies.innerText = countCompanies;

        const lpUsers = document.getElementById('lpCountUsers');
        if (lpUsers) lpUsers.innerText = countTotalUsers;

        const lpActive = document.getElementById('lpCountActive');
        if (lpActive) lpActive.innerText = countActiveUsers;

        // Fetch Inventory
        const inventory = await API.getInventory();
        const lpItems = document.getElementById('lpCountItems');
        if (lpItems && inventory) lpItems.innerText = inventory.length;

    } catch (e) {
        console.error("Failed to load landing page stats", e);
    }
}
