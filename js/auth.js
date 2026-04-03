(() => {
    const Auth = {
        init: function () {
            this.bindUI();
            this.setDefaultRegDate();
        },

        bindUI: function () {
            const showPassToggle = document.getElementById('showPassToggle');
            if (showPassToggle) showPassToggle.addEventListener('change', this.togglePasswordVisibility);

            const loginPassToggle = document.getElementById('toggleLoginPassword');
            if (loginPassToggle) loginPassToggle.addEventListener('click', this.toggleLoginPasswordVisibility);

            const loginForm = document.getElementById('loginForm');
            if (loginForm) loginForm.addEventListener('submit', this.handleLogin);

            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.addEventListener('submit', this.handleRegister);
        },

        toggleAuth: function (view) {
            const modal = document.getElementById('registrationModal');
            if (!modal) return;

            if (view === 'register') {
                modal.style.display = 'flex';
                Auth.setDefaultRegDate();
            } else {
                modal.style.display = 'none';
                Auth.resetPasswordVisibility();
            }
        },

        resetPasswordVisibility: function () {
            const toggle = document.getElementById('showPassToggle');
            if (toggle) toggle.checked = false;

            ['regPassword', 'regConfirmPassword'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.type = 'password';
            });
        },

        togglePasswordVisibility: function () {
            const type = this.checked ? 'text' : 'password';
            ['regPassword', 'regConfirmPassword'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.type = type;
            });
        },

        toggleLoginPasswordVisibility: function () {
            const pass = document.getElementById('loginPassword') || document.getElementById('password');
            const icon = document.getElementById('toggleLoginPassword');
            if (!pass || !icon) return;

            if (pass.type === 'password') {
                pass.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                pass.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        },

        setDefaultRegDate: function () {
            const regDateInput = document.getElementById('regDate');
            if (regDateInput) regDateInput.valueAsDate = new Date();
        },

        // ✅ Normalize user data (CORE FIX)
        normalizeUser: function (data) {
            return {
                ...data,
                name: data.name || data.fullName || data["Full Name"] || data["Name"] || data.username || "User",
                username: data.username || data["User Name"] || data["Username"] || "",
                company: data.company || data["Company"] || data["Company Name"] || "",
                role: (data.role || data["Role"] || "user").toLowerCase()
            };
        },

        loginAsTrial: function () {
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
        },

        handleLogin: async function (e) {
            e.preventDefault();

            const btn = document.getElementById('loginBtn');
            const originalText = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span> Signing In...';

            const loginNameVal = document.getElementById('loginName') ? document.getElementById('loginName').value.trim() : '';
            const usernameVal = document.getElementById('username') ? document.getElementById('username').value.trim() : '';
            const username = usernameVal || loginNameVal;
            const password = (document.getElementById('loginPassword') || document.getElementById('password')).value;
            const company = document.getElementById('loginCompany')?.value.trim() || '';

            const isAdmin = ['admin', 'superadmin', 'aadmin'].includes(username.toLowerCase());

            if (!isAdmin && !company) {
                alert('Company Name is required for regular users.');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }

            try {
                const result = await API.login(username, password, company);

                btn.disabled = false;
                btn.innerHTML = originalText;

                if (result.success || result.status === 'success') {

                    let userData = result.user || result;

                    // ✅ FIX APPLIED HERE
                    userData = Auth.normalizeUser(userData);

                    localStorage.setItem('user', JSON.stringify(userData));
                    localStorage.setItem('currentUser', JSON.stringify(userData));

                    window.location.href = userData.role === 'admin'
                        ? 'admin.html'
                        : 'pages/dashboard.html';

                } else {
                    alert(result.message || "Invalid credentials");
                }

            } catch (err) {
                console.error("Login Error:", err);
                btn.disabled = false;
                btn.innerHTML = originalText;
                alert("Login failed.");
            }
        },

        handleRegister: function (e) {
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

            const data = {
                username: document.getElementById('regUsername').value,
                password,
                name: document.getElementById('regName').value,
                company: document.getElementById('regCompany').value,
                mobile: document.getElementById('regMobile').value,
                whatsapp: document.getElementById('regWhatsapp').value,
                email: document.getElementById('regEmail').value,
                address: document.getElementById('regAddress').value,
                paymentMode: document.getElementById('regPayment').value,
                role: 'user'
            };

            API.register(data).then(res => {
                btn.disabled = false;
                btn.innerHTML = originalText;

                if (res.status === 'success') {
                    alert("Registration successful! Admin approval required.");
                    document.getElementById('registerForm').reset();
                    Auth.setDefaultRegDate();
                    Auth.toggleAuth('close');
                } else {
                    alert(res.message || "Registration failed");
                }
            }).catch(err => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                console.error("Registration Error:", err);
                alert("Registration failed.");
            });
        }
    };

    document.addEventListener('DOMContentLoaded', () => Auth.init());

    window.Auth = Auth;
    window.toggleAuth = Auth.toggleAuth;
    window.loginAsTrial = Auth.loginAsTrial;
})();