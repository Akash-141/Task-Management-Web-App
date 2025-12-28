// Authentication Page Logic
(function() {
    'use strict';

    // ===== STATE =====
    let currentForm = 'login'; // 'login', 'signup', or 'reset'
    let currentTheme = localStorage.getItem('theme') || 'light';

    // ===== FORM SWITCHING =====
    function showLoginForm() {
        currentForm = 'login';
        document.getElementById('login-form-container').classList.remove('hidden');
        document.getElementById('signup-form-container').classList.add('hidden');
        document.getElementById('reset-form-container').classList.add('hidden');
        hideMessages();
    }

    function showSignupForm() {
        currentForm = 'signup';
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('signup-form-container').classList.remove('hidden');
        document.getElementById('reset-form-container').classList.add('hidden');
        hideMessages();
    }

    function showResetForm() {
        currentForm = 'reset';
        document.getElementById('login-form-container').classList.add('hidden');
        document.getElementById('signup-form-container').classList.add('hidden');
        document.getElementById('reset-form-container').classList.remove('hidden');
        hideMessages();
    }

    // ===== MESSAGES =====
    function showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');

        const successDiv = document.getElementById('success-message');
        successDiv.classList.add('hidden');
    }

    function showSuccess(message) {
        const successDiv = document.getElementById('success-message');
        successDiv.textContent = message;
        successDiv.classList.remove('hidden');

        const errorDiv = document.getElementById('error-message');
        errorDiv.classList.add('hidden');
    }

    function hideMessages() {
        document.getElementById('error-message').classList.add('hidden');
        document.getElementById('success-message').classList.add('hidden');
    }

    // ===== THEME TOGGLE =====
    function toggleTheme() {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);

        const moonIcon = document.querySelector('.icon-moon');
        const sunIcon = document.querySelector('.icon-sun');

        if (currentTheme === 'dark') {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    }

    // ===== LOADING STATE =====
    function setLoading(formType, isLoading) {
        let submitBtn, btnText, spinner;

        if (formType === 'login') {
            submitBtn = document.getElementById('login-submit-btn');
        } else if (formType === 'signup') {
            submitBtn = document.getElementById('signup-submit-btn');
        } else if (formType === 'reset') {
            submitBtn = document.getElementById('reset-submit-btn');
        }

        if (submitBtn) {
            btnText = submitBtn.querySelector('.btn-text');
            spinner = submitBtn.querySelector('.spinner');

            if (isLoading) {
                submitBtn.disabled = true;
                btnText.classList.add('hidden');
                spinner.classList.remove('hidden');
            } else {
                submitBtn.disabled = false;
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
            }
        }
    }

    // ===== PASSWORD VISIBILITY TOGGLE =====
    function togglePasswordVisibility(inputId, toggleBtn) {
        const input = document.getElementById(inputId);
        const eyeIcon = toggleBtn.querySelector('.eye-icon');

        if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            input.type = 'password';
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    }

    // ===== ERROR HANDLING =====
    function getErrorMessage(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please contact support.',
            'auth/weak-password': 'Password should be at least 6 characters long.',
            'auth/user-disabled': 'This account has been disabled. Please contact support.',
            'auth/user-not-found': 'No account found with this email. Please sign up.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your internet connection.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
            'auth/cancelled-popup-request': 'Only one popup request is allowed at a time.',
            'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.'
        };

        return errorMessages[error.code] || error.message || 'An unexpected error occurred. Please try again.';
    }

    // ===== AUTHENTICATION HANDLERS =====

    // Login with Email
    async function handleLogin(e) {
        e.preventDefault();
        console.log('Login form submitted');
        hideMessages();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showError('Please enter both email and password.');
            return;
        }

        setLoading('login', true);

        try {
            if (!window.signInWithEmail) {
                throw new Error('Firebase authentication is not loaded. Please refresh the page.');
            }
            await window.signInWithEmail(email, password);
            // Redirect to main app
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Login error:', error);
            showError(getErrorMessage(error));
        } finally {
            setLoading('login', false);
        }
    }

    // Signup with Email
    async function handleSignup(e) {
        e.preventDefault();
        console.log('Signup form submitted');
        hideMessages();

        const fullName = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        console.log('📋 Form values captured:');
        console.log('  Full Name:', fullName);
        console.log('  Email:', email);
        console.log('  Password length:', password.length);

        if (!fullName || !email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        if (fullName.length < 2) {
            showError('Please enter your full name.');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long.');
            return;
        }

        setLoading('signup', true);

        try {
            if (!window.signUpWithEmail) {
                throw new Error('Firebase authentication is not loaded. Please refresh the page.');
            }

            console.log('\n🎯 === AUTH.JS: Starting signup ===');
            console.log('Calling signUpWithEmail with:', { email, fullName });
            const user = await window.signUpWithEmail(email, password, fullName);
            console.log('✅ Signup returned successfully');
            console.log('User UID:', user.uid);
            console.log('Display Name:', user.displayName);

            // Wait for Firestore write to complete
            console.log('⏳ Waiting 2 seconds for Firestore write...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('✅ Redirecting to main app...');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('\n❌ Signup error in auth.js:', error);
            showError(getErrorMessage(error));
        } finally {
            setLoading('signup', false);
        }
    }

    // Google Sign-In
    async function handleGoogleSignIn() {
        console.log('Google sign-in clicked');
        hideMessages();

        try {
            if (!window.signInWithGoogle) {
                throw new Error('Firebase authentication is not loaded. Please refresh the page.');
            }
            await window.signInWithGoogle();
            // Redirect to main app
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Google sign-in error:', error);
            showError(getErrorMessage(error));
        }
    }

    // Password Reset
    async function handlePasswordReset(e) {
        e.preventDefault();
        console.log('Password reset form submitted');
        hideMessages();

        const email = document.getElementById('reset-email').value.trim();

        if (!email) {
            showError('Please enter your email address.');
            return;
        }

        setLoading('reset', true);

        try {
            if (!window.resetPassword) {
                throw new Error('Firebase authentication is not loaded. Please refresh the page.');
            }
            await window.resetPassword(email);
            showSuccess('Password reset email sent! Please check your inbox.');
            document.getElementById('reset-form').reset();
        } catch (error) {
            console.error('Password reset error:', error);
            showError(getErrorMessage(error));
        } finally {
            setLoading('reset', false);
        }
    }

    // ===== INITIALIZATION =====
    function init() {
        try {
            console.log('Auth page initializing...');

            // Initialize theme
            document.documentElement.setAttribute('data-theme', currentTheme);
            if (currentTheme === 'dark') {
                document.querySelector('.icon-moon').classList.add('hidden');
                document.querySelector('.icon-sun').classList.remove('hidden');
            }

            // Theme toggle button
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', toggleTheme);
                console.log('Theme toggle attached');
            }

            // Check if Firebase is loaded
            if (typeof firebase === 'undefined') {
                console.error('Firebase is not loaded!');
                showError('Firebase is not loaded. Please check your internet connection and refresh the page.');
                // Still attach event listeners for better UX
            } else {
                console.log('Firebase loaded:', firebase.SDK_VERSION);
            }

            // Check if user is already logged in (only if Firebase is loaded)
            if (window.auth) {
                console.log('Firebase Auth available');
                try {
                    window.auth.onAuthStateChanged((user) => {
                        if (user) {
                            console.log('User already logged in, redirecting...');
                            // User is already signed in, redirect to main app
                            window.location.href = 'index.html';
                        } else {
                            console.log('No user logged in');
                        }
                    });
                } catch (error) {
                    console.error('Auth state change error:', error);
                }
            } else {
                console.warn('Firebase Auth not loaded yet - auth functionality may not work');
            }

            // Form submissions
            console.log('Attaching form event listeners...');
            const loginForm = document.getElementById('login-form');
            const signupForm = document.getElementById('signup-form');
            const resetForm = document.getElementById('reset-form');

            console.log('Login form found:', loginForm);
            console.log('Signup form found:', signupForm);
            console.log('Reset form found:', resetForm);

            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
                console.log('Login form listener attached');
            } else {
                console.error('Login form NOT found!');
            }

            if (signupForm) {
                signupForm.addEventListener('submit', handleSignup);
                console.log('Signup form listener attached');
            } else {
                console.error('Signup form NOT found!');
            }

            if (resetForm) {
                resetForm.addEventListener('submit', handlePasswordReset);
                console.log('Reset form listener attached');
            } else {
                console.error('Reset form NOT found!');
            }

            // Form switching
            document.getElementById('show-signup-link').addEventListener('click', (e) => {
                e.preventDefault();
                showSignupForm();
            });

            document.getElementById('show-login-link').addEventListener('click', (e) => {
                e.preventDefault();
                showLoginForm();
            });

            document.getElementById('show-reset-link').addEventListener('click', (e) => {
                e.preventDefault();
                showResetForm();
            });

            document.getElementById('back-to-login-link').addEventListener('click', (e) => {
                e.preventDefault();
                showLoginForm();
            });

            // Google sign-in buttons
            document.getElementById('google-login-btn').addEventListener('click', handleGoogleSignIn);
            document.getElementById('google-signup-btn').addEventListener('click', handleGoogleSignIn);

            // Password visibility toggles
            document.getElementById('login-password-toggle').addEventListener('click', function() {
                togglePasswordVisibility('login-password', this);
            });

            document.getElementById('signup-password-toggle').addEventListener('click', function() {
                togglePasswordVisibility('signup-password', this);
            });

            // Enter key navigation
            document.getElementById('login-email').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('login-password').focus();
                }
            });

            document.getElementById('signup-email').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('signup-password').focus();
                }
            });

            console.log('Auth page initialized successfully!');
        } catch (error) {
            console.error('Error initializing auth page:', error);
            alert('Error loading the page. Please refresh and try again. Error: ' + error.message);
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== PAGE LOADER =====
    window.addEventListener('load', () => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            setTimeout(() => {
                loader.classList.add('hidden');
                // Remove from DOM after transition
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500);
            }, 300);
        }
    });

})();