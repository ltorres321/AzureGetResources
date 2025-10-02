// Azure Authentication Configuration
const AZURE_CONFIG = {
    tenantId: '', // Will be extracted from email
    clientId: 'YOUR_AZURE_APP_CLIENT_ID', // Replace with your Azure AD app client ID
    redirectUri: window.location.origin,
    scopes: ['https://management.azure.com/.default']
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

// Extract tenant ID from email
function extractTenantId(email) {
    const parts = email.split('@');
    if (parts.length === 2) {
        const domain = parts[1];
        // For Microsoft accounts, use common tenant
        if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com')) {
            return 'common';
        }
        // For Azure AD accounts, use the domain as tenant ID
        return domain;
    }
    return 'common';
}

// Authenticate with Azure
async function authenticate() {
    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();

    if (!email) {
        showAuthStatus('Please enter your Azure email address.', 'error');
        return;
    }

    userEmail = email;
    const tenantId = extractTenantId(email);
    AZURE_CONFIG.tenantId = tenantId;

    showAuthStatus('Starting authentication...', 'info');

    try {
        // Step 1: Get authorization code
        const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
            `client_id=${AZURE_CONFIG.clientId}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(AZURE_CONFIG.redirectUri)}&` +
            `scope=${encodeURIComponent(AZURE_CONFIG.scopes.join(' '))}&` +
            `state=${Date.now()}&` +
            `prompt=consent`;

        // Open authentication popup
        openAuthPopup(authUrl);

    } catch (error) {
        console.error('Authentication error:', error);
        showAuthStatus('Authentication failed: ' + error.message, 'error');
    }
}

// Open authentication popup
function openAuthPopup(authUrl) {
    const popup = document.getElementById('auth-popup');
    const authFrame = document.getElementById('auth-frame');

    authFrame.src = authUrl;
    popup.classList.remove('hidden');

    // Listen for messages from the popup
    window.addEventListener('message', handleAuthMessage, { once: true });
}

// Close authentication popup
function closeAuthPopup() {
    const popup = document.getElementById('auth-popup');
    popup.classList.add('hidden');
    const authFrame = document.getElementById('auth-frame');
    authFrame.src = '';
}

// Handle authentication messages from popup
async function handleAuthMessage(event) {
    closeAuthPopup();

    if (event.data.type === 'auth_success') {
        const { code } = event.data;

        try {
            // Step 2: Exchange code for token
            await exchangeCodeForToken(code);
            showAuthStatus('Authentication successful!', 'success');

            // Step 3: Get subscriptions
            await loadSubscriptions();

        } catch (error) {
            console.error('Token exchange error:', error);
            showAuthStatus('Token exchange failed: ' + error.message, 'error');
        }
    } else if (event.data.type === 'auth_error') {
        showAuthStatus('Authentication cancelled or failed.', 'error');
    }
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
    const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}/oauth2/v2.0/token`;

    const tokenData = new URLSearchParams({
        client_id: AZURE_CONFIG.clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: AZURE_CONFIG.redirectUri,
        scope: AZURE_CONFIG.scopes.join(' ')
    });

    const response = await axios.post(tokenEndpoint, tokenData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    accessToken = response.data.access_token;

    // Store token in sessionStorage for persistence
    sessionStorage.setItem('azureAccessToken', accessToken);
    sessionStorage.setItem('azureUserEmail', userEmail);
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