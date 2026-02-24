// ===============================
// auth.js - Handles Login and Registration (Final)
// ===============================

// ------------------------------
// Global functions for modal toggling & password visibility
// ------------------------------
window.toggleAuth = function (view) {
    const modal = document.getElementById('registrationModal');
    if (!modal) return;

    if (view === 'register') {
        modal.style.display = 'flex'; // Flex centers modal

        // Auto-set Date
        const regDateInput = document.getElementById('regDate');
        if (regDateInput) {
            regDateInput.value = new Date().toISOString().split('T')[0];
        }
    } else {
        modal.style.display = 'none';

        // Reset password visibility
        const toggle = document.getElementById('showPassToggle');
        if (toggle) {
            toggle.checked = false;
            const pass = document.getElementById('regPassword');
            const confirm = document.getElementById('regConfirmPassword');
            if (pass) pass.type = 'password';
            if (confirm) confirm.type = 'password';
        }
    }
};

window.togglePasswordVisibility = function () {
    const pass = document.getElementById('regPassword');
    const confirm = document.getElementById('regConfirmPassword');
    const toggle = document.getElementById('showPassToggle');
    if (!toggle) return;

    const type = toggle.checked ? 'text' : 'password';
    if (pass) pass.type = type;
    if (confirm) confirm.type = type;
};

window.toggleLoginPasswordVisibility = function () {
    const pass = document.getElementById('password');
    const icon = document.getElementById('toggleLoginPassword');
    if (!pass || !icon) return;

    if (pass.type === 'password') {
        pass.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        pass.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

// ------------------------------
// Trial User Login
// ------------------------------
window.loginAsTrial = function () {
    const trialUser = {
        username: 'trial',
        name: 'Guest User',
        role: 'trial',
        company: 'Demo Company Ltd.',
        status: 'active',
        profileImage: 'assets/trial_avatar.jpg'
    };
    localStorage.setItem('user', JSON.stringify(trialUser));
    localStorage.setItem('currentUser', JSON.stringify(trialUser));
    window.location.href = 'pages/dashboard.html';
};

// ------------------------------
// DOMContentLoaded
// ------------------------------
document.addEventListener('DOMContentLoaded', () => {

    // --------------------------
    // Login Form Handling
    // --------------------------
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const originalText = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span> Signing In...';

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const company = document.getElementById('loginCompany').value.trim();

            const isAdmin = username.toLowerCase() === 'admin' || username.toLowerCase() === 'superadmin';

            if (!isAdmin && !company) {
                alert('Company Name is required for regular users.');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }

            console.log("Attempting login for:", { username, company });

            try {
                const result = await API.login(username, password, company);
                console.log("Login Response:", result);

                btn.disabled = false;
                btn.innerHTML = originalText;

                if (result.success || result.status === 'success') {
                    // Normalize user data from response
                    const userData = result.user || result;

                    // Save user to localStorage
                    localStorage.setItem('user', JSON.stringify(userData));
                    localStorage.setItem('currentUser', JSON.stringify(userData));

                    // Redirect based on role
                    if (userData.role && userData.role.toLowerCase() === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'pages/dashboard.html';
                    }
                } else {
                    alert(result.message || "Invalid credentials");
                }

            } catch (err) {
                console.error("Login Error:", err);
                btn.disabled = false;
                btn.innerHTML = originalText;
                alert("Login failed. Check console for details.");
            }
        });
    }

    // --------------------------
    // Registration Form Handling
    // --------------------------
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const regDateInput = document.getElementById('regDate');
        if (regDateInput) regDateInput.value = new Date().toISOString().split('T')[0];

        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('registerBtn');
            const originalText = btn.innerHTML;

            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;

            if (password !== confirm) {
                alert("Passwords do not match!");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span> Registering...';

            // Prepare registration data
            const data = {
                username: document.getElementById('regUsername').value,
                password: password,
                name: document.getElementById('regName').value,
                company: document.getElementById('regCompany').value,
                mobile: document.getElementById('regMobile').value,
                whatsapp: document.getElementById('regWhatsapp').value,
                email: document.getElementById('regEmail').value,
                address: document.getElementById('regAddress').value,
                paymentMode: document.getElementById('regPayment').value,
                role: 'user'
            };

            // Call registration API (assumes your API.register exists)
            API.register(data).then(res => {
                btn.disabled = false;
                btn.innerHTML = originalText;

                if (res.status === 'success') {
                    alert("Registration successful! Admin approval required.");
                    registerForm.reset();
                    if (regDateInput) regDateInput.value = new Date().toISOString().split('T')[0];
                    toggleAuth('close');
                } else {
                    alert(res.message || "Registration failed");
                }
            }).catch(err => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                console.error("Registration Error:", err);
                alert("Registration failed. Check console.");
            });
        });
    }

});