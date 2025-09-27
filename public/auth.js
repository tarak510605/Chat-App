// Authentication JavaScript
class AuthManager {
    constructor() {
        this.apiBase = '/api/auth';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        // Form switches
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignupForm();
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Form submissions
        document.getElementById('login-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('signup-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        // Password confirmation validation
        const confirmPassword = document.getElementById('signup-confirm-password');
        const password = document.getElementById('signup-password');
        
        confirmPassword.addEventListener('input', () => {
            if (password.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.setCustomValidity('');
            }
        });
    }

    showSignupForm() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
        this.clearMessage();
    }

    showLoginForm() {
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        this.clearMessage();
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        const buttons = document.querySelectorAll('.auth-button');
        buttons.forEach(btn => btn.disabled = true);
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        const buttons = document.querySelectorAll('.auth-button');
        buttons.forEach(btn => btn.disabled = false);
    }

    showMessage(message, type = 'error') {
        const messageEl = document.getElementById('message');
        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');
    }

    clearMessage() {
        const messageEl = document.getElementById('message');
        messageEl.classList.add('hidden');
        messageEl.textContent = '';
        messageEl.className = 'message';
    }

    async handleLogin() {
        const formData = new FormData(document.getElementById('login-form-element'));
        const data = {
            identifier: formData.get('identifier'),
            password: formData.get('password')
        };

        this.showLoading();
        this.clearMessage();

        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Store token and user data
                localStorage.setItem('chatflow_token', result.data.token);
                localStorage.setItem('chatflow_user', JSON.stringify(result.data.user));
                
                this.showMessage('Login successful! Redirecting...', 'success');
                
                // Redirect to chat
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } else {
                this.showMessage(result.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async handleSignup() {
        const formData = new FormData(document.getElementById('signup-form-element'));
        const data = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword')
        };

        // Client-side validation
        if (data.password !== data.confirmPassword) {
            this.showMessage('Passwords do not match');
            return;
        }

        if (data.password.length < 6) {
            this.showMessage('Password must be at least 6 characters long');
            return;
        }

        this.showLoading();
        this.clearMessage();

        try {
            const response = await fetch(`${this.apiBase}/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Store token and user data
                localStorage.setItem('chatflow_token', result.data.token);
                localStorage.setItem('chatflow_user', JSON.stringify(result.data.user));
                
                this.showMessage('Account created successfully! Redirecting...', 'success');
                
                // Redirect to chat
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 1500);
            } else {
                this.showMessage(result.message || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showMessage('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async checkExistingAuth() {
        const token = localStorage.getItem('chatflow_token');
        
        if (token) {
            try {
                const response = await fetch(`${this.apiBase}/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token })
                });

                const result = await response.json();

                if (result.success) {
                    // User is already authenticated, redirect to chat
                    window.location.href = '/index.html';
                } else {
                    // Invalid token, remove it
                    localStorage.removeItem('chatflow_token');
                    localStorage.removeItem('chatflow_user');
                }
            } catch (error) {
                console.error('Token verification error:', error);
                localStorage.removeItem('chatflow_token');
                localStorage.removeItem('chatflow_user');
            }
        }
    }

    // Static method to get stored token
    static getToken() {
        return localStorage.getItem('chatflow_token');
    }

    // Static method to get stored user
    static getUser() {
        const user = localStorage.getItem('chatflow_user');
        return user ? JSON.parse(user) : null;
    }

    // Static method to logout
    static logout() {
        localStorage.removeItem('chatflow_token');
        localStorage.removeItem('chatflow_user');
        window.location.href = '/auth.html';
    }

    // Static method to check if user is authenticated
    static isAuthenticated() {
        return !!localStorage.getItem('chatflow_token');
    }
}

// Initialize authentication manager
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});