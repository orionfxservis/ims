class Auth {
    static async register(data) {
        if (!CONFIG.API_URL) {
            console.log("Demo Mode: Registration successful");
            return { success: true, message: "Demo Mode: Account created automatically! You can login now." };
        }

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'register',
                    ...data
                })
            });
            return await response.json();
        } catch (error) {
            console.error("Registration Error:", error);
            return { success: false, message: "Network error occurred." };
        }
    }

    static async login(username, password) {
        // Local Admin Authentication (Bypasses Server)
        // User requested to save password locally to resolve server issues
        const localAdminPass = localStorage.getItem('IMS_ADMIN_PASS') || 'admin123';

        if (username.toLowerCase() === 'admin' && password === localAdminPass) {
            console.log("Local Admin Login Successful");
            const user = {
                name: 'Admin',
                username: 'admin',
                role: CONFIG.ROLES.ADMIN,
                status: 'Approved'
            };
            this.setSession(user);
            return { success: true, role: user.role, user: user };
        }

        if (!CONFIG.API_URL) {
            // Demo Mode: Allow any login
            console.log("Demo Mode: Login successful");
            // ... existing demo logic ...
            const role = CONFIG.ROLES.USER;
            const user = {
                name: 'Demo User',
                username: username,
                role: role,
                status: 'Approved'
            };
            this.setSession(user);
            return { success: true, role: role, user: user };
        }

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'login',
                    username,
                    password
                })
            });
            console.log("Login Request sent to:", CONFIG.API_URL);
            const result = await response.json();
            console.log("Login Response received:", result);

            if (result.success) {
                this.setSession(result.user);
            }
            return result;
        } catch (error) {
            console.error("Login Error:", error);
            return { success: false, message: "Network error occurred." };
        }
    }

    static setSession(user) {
        localStorage.setItem('ims_user', JSON.stringify(user));
    }

    static getSession() {
        const user = localStorage.getItem('ims_user');
        return user ? JSON.parse(user) : null;
    }

    static logout() {
        localStorage.removeItem('ims_user');
        window.location.href = '../index.html'; // Adjust path if needed
    }

    static checkAuth() {
        const user = this.getSession();
        if (!user) {
            window.location.href = '../index.html'; // Redirect to login if not authenticated
        }
        return user;
    }

    static checkAdmin() {
        const user = this.getSession();
        if (!user || user.role !== CONFIG.ROLES.ADMIN) {
            window.location.href = user ? 'dashboard.html' : '../index.html';
        }
    }
}
