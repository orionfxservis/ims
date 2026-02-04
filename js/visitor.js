// Visitor Counter Logic

const VisitorAPI = {
    // Check if user visited in this session (or persistent check if desired)
    // Using sessionStorage for session-based counting, or localStorage for device-based.
    // "Actual visitors" usually means page hits or unique sessions.
    // Let's use sessionStorage to limit spamming the DB on reload in same tab, 
    // but log new visit on new tab/window.

    init: function () {
        if (!sessionStorage.getItem('imb_visit_logged')) {
            this.logVisit();
        } else {
            this.getStats();
        }

        // Refresh stats periodically (e.g., every 60s) to show "Online" changes
        setInterval(() => {
            this.getStats();
        }, 60000);
    },

    logVisit: function () {
        if (typeof API === 'undefined') {
            console.error("API module not loaded");
            return;
        }

        // Assuming API.post is available (from api.js)
        // If API.post requires auth, we might have an issue for public visitors.
        // Usually index.html is public. 
        // We need to check if API.post handles unauthenticated requests or if we need a public endpoint.
        // backend/Code.gs doPost usually requires deployment as "Anyone" (or "Anyone with Google Account").
        // If configured as "Me" (execution) and "Anyone" (access), it works.

        API.post({ action: 'logVisit' })
            .then(response => {
                if (response.success) {
                    sessionStorage.setItem('imb_visit_logged', 'true');
                    this.updateUI(response.stats);
                }
            })
            .catch(err => console.error("Visitor Log Error:", err));
    },

    getStats: function () {
        if (typeof API === 'undefined') return;

        API.post({ action: 'getVisitorStats' })
            .then(response => {
                if (response.success) {
                    this.updateUI(response.stats);
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
    }, 1000);
});
