// auth.js - Handles Login and Registration

// auth.js - Handles Login and Registration

// Global toggle function
// Global toggle function for Modal
window.toggleAuth = function (view) {
    const modal = document.getElementById('registrationModal');
    if (!modal) return;

    if (view === 'register') {
        modal.style.display = 'flex'; // Flex to center as per CSS

        // Auto-set Date on Open
        const regDateInput = document.getElementById('regDate');
        if (regDateInput) {
            regDateInput.value = new Date().toISOString().split('T')[0];
        }
    } else {
        // Close Modal
        modal.style.display = 'none';

        // Reset Password Visibility
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

window.loginAsTrial = function () {
    const trialUser = {
        username: 'trial',
        name: 'Guest User',
        role: 'trial',
        company: 'Demo Company Ltd.',
        status: 'active',
        profileImage: 'assets/trial_avatar.jpg'
    };

    // Slight delay to simulate login
    const btn = document.querySelector('.hero-cta .btn-primary');
    const originalText = btn ? btn.innerHTML : 'Start Free / Login';
    if (btn) btn.innerText = 'Setting up Demo...';

    setTimeout(() => {
        localStorage.setItem('user', JSON.stringify(trialUser));
        localStorage.setItem('currentUser', JSON.stringify(trialUser));
        window.location.href = 'pages/dashboard.html';
        if (btn) btn.innerHTML = originalText;
    }, 800);
};

document.addEventListener('DOMContentLoaded', () => {

    // Load Hero Banner
    loadHeroBanner();
    loadPublicStats();

    async function loadPublicStats() {
        // Fetch Users (Registered Companies, Users, Active)
        try {
            const users = await API.getUsers();

            // Filter out Admin and Trial from stats (Matching Admin Dashboard Logic)
            const realUsers = users.filter(u => u.role !== 'admin' && u.role !== 'trial' && u.username !== 'trial' && u.company !== 'System');

            // 1. Registered Companies
            const companies = new Set(realUsers.map(u => (u.company || '').trim().toLowerCase()).filter(c => c && c !== 'system'));
            const companyCount = companies.size;

            // 2. Registered Users & Active
            const userCount = realUsers.length;
            const activeCount = realUsers.filter(u => u.status === 'active').length;

            animateValue(document.getElementById('lpCountCompanies'), 0, companyCount, 2000);
            animateValue(document.getElementById('lpCountUsers'), 0, userCount, 2000);
            animateValue(document.getElementById('lpCountActive'), 0, activeCount, 2000);
        } catch (e) {
            console.error("Failed to load public user stats", e);
        }

        // Fetch Inventory (Items in Stock)
        try {
            const inventory = await API.getInventory();
            const itemCount = inventory.length;
            animateValue(document.getElementById('lpCountItems'), 0, itemCount, 2000);
        } catch (e) {
            console.error("Failed to load public inventory stats", e);
        }
    }

    function animateValue(obj, start, end, duration) {
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    async function loadHeroBanner() {
        try {
            const banners = await API.getBanners();
            const heroBanner = banners.find(b => b.type === 'hero');
            const heroBannerContainer = document.getElementById('heroBannerContainer');

            if (heroBanner && heroBanner.url && heroBannerContainer) {
                heroBannerContainer.innerHTML = `<img src="${heroBanner.url}" alt="Hero Banner" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">`;
            }
        } catch (e) {
            console.error("Failed to load hero banner", e);
        }
    }

    // Login Handling
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const originalText = btn.innerHTML;

            // Loading State
            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span> Signing In...';

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            console.log("Attempting login for:", username);

            // TODO: Call Google Apps Script backend here
            // Mocking network delay
            // setTimeout(() => { // Removed internal timeout, API handles it
            // btn.disabled = false;
            // btn.innerHTML = originalText;

            // Call API
            API.login(username, password).then(response => {
                btn.disabled = false;
                btn.innerHTML = originalText;

                if (response.status === 'success') {
                    // Success
                    const user = response.user;
                    localStorage.setItem('user', JSON.stringify(user));
                    localStorage.setItem('currentUser', JSON.stringify(user)); // Legacy support for admin.js

                    if (user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'pages/dashboard.html';
                    }
                } else {
                    // Error
                    alert(response.message);
                }
            }).catch(err => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                alert('Login Error: ' + err);
            });
            // }, 1000); // Removed internal timeout, API handles it
        });
    }

    // Registration Handling
    const registerForm = document.getElementById('registerForm');

    // Auto-set Date on Load
    const regDateInput = document.getElementById('regDate');
    if (regDateInput) {
        regDateInput.value = new Date().toISOString().split('T')[0];
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('registerBtn');
            const originalText = btn.innerHTML;

            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;

            if (password !== confirm) {
                showToast("Passwords do not match!", true);
                return;
            }

            // Loading State
            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span> Registering...';

            const processRegistration = (base64Image) => {
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
                    role: 'user',
                    profileImage: base64Image || ''
                };

                // Call API
                API.register(data).then(response => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;

                    if (response.status === 'success') {
                        showToast("Registration successful! sending request to Admin...");
                        registerForm.reset();
                        if (document.getElementById('regDate'))
                            document.getElementById('regDate').value = new Date().toISOString().split('T')[0];

                        // WhatsApp to Admin
                        const adminPhone = "923001234567";
                        const msg = `*New Registration Request*\n\n` +
                            `Name: ${data.name}\n` +
                            `Company: ${data.company}\n` +
                            `Mobile: ${data.mobile}\n` +
                            `WhatsApp: ${data.whatsapp}\n` +
                            `Email: ${data.email}\n` +
                            `Payment: ${data.paymentMode}\n\n` +
                            `Please approve this user.`;

                        const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`;

                        setTimeout(() => {
                            window.open(url, '_blank');
                            toggleAuth('close'); // Close Modal
                        }, 1500);

                    } else {
                        showToast(response.message, true);
                    }
                }).catch(err => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    showToast("Error: " + err.message, true);
                });
            };

            // Image handling
            const imageInput = document.getElementById('regImage');
            if (imageInput && imageInput.files.length > 0) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    processRegistration(e.target.result);
                };
                reader.readAsDataURL(imageInput.files[0]);
            } else {
                processRegistration(null);
            }
        });
    }

    function showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) return; // Only exists on register page for now
        const toastMsg = document.getElementById('toastMsg');

        toastMsg.textContent = msg;
        toast.style.display = 'block';
        toast.style.borderColor = isError ? 'var(--error)' : 'var(--success)';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
});

// Scroll-to-top button logic
const scrollTopBtn = document.getElementById("scrollTopBtn");
const heroLeft = document.querySelector('.hero-left');

if (scrollTopBtn && heroLeft) {
    // Show button when hero-left is scrolled down
    heroLeft.addEventListener('scroll', () => {
        if (heroLeft.scrollTop > 200) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    });

    // Smooth scroll hero-left to top on click
    scrollTopBtn.addEventListener("click", () => {
        heroLeft.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}
