// auth.js - Handles Login and Registration

// auth.js - Handles Login and Registration

// Global toggle function
window.toggleAuth = function (view) {
    const login = document.getElementById('loginContainer');
    const register = document.getElementById('registerContainer');

    if (view === 'register') {
        login.style.display = 'none';
        register.style.display = 'block';
        register.classList.add('fade-in'); // Optional animation class if defined
    } else {
        register.style.display = 'none';
        login.style.display = 'block';
        login.classList.add('fade-in');
    }
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
    // Load Hero Banner
    loadHeroBanner();

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
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('registerBtn');
            const originalText = btn.innerHTML;

            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('confirmPassword').value;

            if (password !== confirm) {
                showToast("Passwords do not match!", true);
                return;
            }

            // Loading State
            btn.disabled = true;
            btn.innerHTML = '<span class="loader"></span> Registering...';

            const data = {
                company: document.getElementById('regCompanyName').value,
                username: document.getElementById('regUsername').value,
                password: password,
                phone: document.getElementById('regPhone').value,
                role: 'user',
                name: document.getElementById('regUsername').value // Default name to username
            };

            // Call API
            API.register(data).then(response => {
                btn.disabled = false;
                btn.innerHTML = originalText;

                if (response.status === 'success') {
                    showToast("Registration successful! Please wait for Admin approval.");
                    registerForm.reset();
                    // Optional: Switch to login view after successful registration after a delay
                    setTimeout(() => toggleAuth('login'), 2000);
                } else {
                    showToast(response.message, true);
                }
            }).catch(err => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                showToast("Error: " + err.message, true);
            });
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
            scrollTopBtn.style.display = "block";
        } else {
            scrollTopBtn.style.display = "none";
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
