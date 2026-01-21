const CONFIG = {
    // Placeholder - User needs to fill this with their deployment URL
    // Checks localStorage first for dynamic configuration via Admin Panel
    API_URL: localStorage.getItem('IMS_API_URL') || "",

    // Application Constants
    ROLES: {
        ADMIN: 'ADMIN',
        USER: 'USER'
    },

    STATUS: {
        PENDING: 'Pending',
        APPROVED: 'Approved',
        REJECTED: 'Rejected',
        LOCKED: 'Locked'
    }
};
