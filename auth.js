// Azure Authentication Configuration
const AZURE_CONFIG = {
    apiBaseUrl: window.location.origin.includes('githubpreview.dev') ||
                 window.location.origin.includes('github.dev') ||
                 window.location.hostname === 'localhost' ?
        'http://localhost:3001' : // GitHub Codespaces and local development
        window.location.origin.replace(/:\d+$/, ':3001') // Replace port with 3001
};

// Global variables
let accessToken = null;
let userEmail = '';
let subscriptions = [];

// Authentication state management
function showAuthSection() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('subscription-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
}

function showSubscriptionSection() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('subscription-section').classList.remove('hidden');
    document.getElementById('results-section').classList.add('hidden');
}

function showResultsSection() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('subscription-section').classList.add('hidden');
    document.getElementById('results-section').classList.remove('hidden');
}

// Authenticate with Azure using CLI
async function authenticate() {
    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();

    if (!email) {
        showAuthStatus('Please enter your Azure email address.', 'error');
        return;
    }

    userEmail = email;

    showAuthStatus('Starting Azure authentication...', 'info');

    try {
        // First, try to login/get token from backend API
        const response = await fetch(`${AZURE_CONFIG.apiBaseUrl}/api/azure-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: userEmail })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to start Azure login');
        }

        const data = await response.json();

        if (data.loginRequired) {
            // Show device code authentication UI
            showDeviceCodeLogin(data.loginUrl, data.deviceCode);
            return;
        }

        // If we get here, we have a token
        accessToken = data.accessToken;

        // Store token in sessionStorage for persistence
        sessionStorage.setItem('azureAccessToken', accessToken);
        sessionStorage.setItem('azureUserEmail', userEmail);

        showAuthStatus('Authentication successful!', 'success');

        // Load subscriptions
        await loadSubscriptions();

    } catch (error) {
        console.error('Authentication error:', error);
        showAuthStatus('Authentication failed: ' + error.message, 'error');
    }
}

// Show device code login interface
function showDeviceCodeLogin(loginUrl, deviceCode) {
    const statusDiv = document.getElementById('auth-status');
    statusDiv.innerHTML = `
        <div class="status info">
            <h3>Complete Azure Authentication</h3>
            <p><strong>Device Code:</strong> <code>${deviceCode}</code></p>
            <p><strong>Login URL:</strong> <a href="${loginUrl}" target="_blank">${loginUrl}</a></p>
            <p>Please open the login URL in your browser and enter the device code above.</p>
            <button onclick="checkAuthenticationStatus()" class="btn-primary">I've completed authentication</button>
            <button onclick="showAuthSection()" class="btn-secondary">Cancel</button>
        </div>
    `;
}

// Check authentication status after device code entry
async function checkAuthenticationStatus() {
    showAuthStatus('Checking authentication status...', 'info');

    try {
        // Try to get token from backend API
        const response = await fetch(`${AZURE_CONFIG.apiBaseUrl}/api/get-azure-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get Azure token');
        }

        const data = await response.json();
        accessToken = data.accessToken;

        // Store token in sessionStorage for persistence
        sessionStorage.setItem('azureAccessToken', accessToken);
        sessionStorage.setItem('azureUserEmail', userEmail);

        showAuthStatus('Authentication successful!', 'success');

        // Load subscriptions
        await loadSubscriptions();

    } catch (error) {
        console.error('Authentication check error:', error);
        showAuthStatus('Authentication check failed: ' + error.message + '. Please try again.', 'error');
    }
}


// Load user subscriptions
async function loadSubscriptions() {
    try {
        const response = await axios.get('https://management.azure.com/subscriptions?api-version=2020-01-01', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        subscriptions = response.data.value;
        displaySubscriptions();

        showSubscriptionSection();

    } catch (error) {
        console.error('Error loading subscriptions:', error);
        showAuthStatus('Failed to load subscriptions: ' + error.message, 'error');
    }
}

// Display subscriptions for selection
function displaySubscriptions() {
    const container = document.getElementById('subscriptions-list');

    if (subscriptions.length === 0) {
        container.innerHTML = '<p>No subscriptions found.</p>';
        return;
    }

    const html = subscriptions.map(sub => `
        <div class="subscription-item">
            <label class="subscription-label">
                <input type="checkbox" value="${sub.subscriptionId}" checked>
                <span class="subscription-name">${sub.displayName}</span>
                <span class="subscription-id">${sub.subscriptionId}</span>
            </label>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Get selected subscriptions
function getSelectedSubscriptions() {
    const checkboxes = document.querySelectorAll('#subscriptions-list input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Show authentication status
function showAuthStatus(message, type) {
    const statusDiv = document.getElementById('auth-status');
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

// Start over
function startOver() {
    accessToken = null;
    userEmail = '';
    subscriptions = [];

    sessionStorage.removeItem('azureAccessToken');
    sessionStorage.removeItem('azureUserEmail');

    document.getElementById('email').value = '';
    showAuthSection();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a stored token
    const storedToken = sessionStorage.getItem('azureAccessToken');
    const storedEmail = sessionStorage.getItem('azureUserEmail');

    if (storedToken && storedEmail) {
        accessToken = storedToken;
        userEmail = storedEmail;
        document.getElementById('email').value = userEmail;
        loadSubscriptions();
    }
});