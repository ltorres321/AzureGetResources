// Azure Authentication Configuration
const AZURE_CONFIG = {
    apiBaseUrl: window.location.origin.includes('githubpreview.dev') ||
                 window.location.origin.includes('github.dev') ||
                 window.location.origin.includes('app.github.dev') ||
                 window.location.hostname === 'localhost' ?
        window.location.origin : // Use the same origin for GitHub Codespaces
        'http://localhost:3001' // Default to localhost for local development
};

console.log('API Base URL:', AZURE_CONFIG.apiBaseUrl);
console.log('Current origin:', window.location.origin);

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

// Start the authentication process (called when user clicks start button)
async function startAuthentication() {
    const emailInput = document.getElementById('email');
    const email = emailInput.value.trim();

    if (!email) {
        showAuthStatus('Please enter your Azure email address first.', 'error');
        return;
    }

    userEmail = email;

    // Hide welcome section and show auth section
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');

    showAuthStatus('🔄 Starting Azure authentication process...', 'info');

    try {
        // First, try to get device code for login
        console.log('Making API call to:', `${AZURE_CONFIG.apiBaseUrl}/api/azure-login`);
        const response = await fetch(`${AZURE_CONFIG.apiBaseUrl}/api/azure-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: userEmail })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('API Response:', data); // Debug log

        if (!response.ok) {
            throw new Error(data.error || 'Failed to start Azure login');
        }

        if (data.loginRequired && data.deviceCode) {
            console.log('Showing device code:', data.deviceCode); // Debug log

            // Hide welcome section and show auth section first
            console.log('Hiding welcome section and showing auth section');
            document.getElementById('welcome-section').classList.add('hidden');
            document.getElementById('auth-section').classList.remove('hidden');
            console.log('Auth section classes:', document.getElementById('auth-section').className);

            // Show device code authentication UI
            showDeviceCodeLogin(data.loginUrl, data.deviceCode, data.demo);
            return;
        } else {
            console.error('No device code in response:', data);
            showAuthStatus('❌ No device code received from server', 'error');
        }

        // If we get here, we have a token
        accessToken = data.accessToken;

        // Store token in sessionStorage for persistence
        sessionStorage.setItem('azureAccessToken', accessToken);
        sessionStorage.setItem('azureUserEmail', userEmail);

        showAuthStatus('✅ Authentication successful!', 'success');

        // Load subscriptions
        await loadSubscriptions();

    } catch (error) {
        console.error('Authentication error:', error);
        showAuthStatus('❌ Authentication failed: ' + error.message, 'error');
        console.log('Error details:', error); // More debug info
    }
}

// Test function to verify device code display is working
function testDeviceCodeDisplay() {
    console.log('Testing device code display...');
    showDeviceCodeLogin('https://microsoft.com/devicelogin', 'TEST123456');
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

// Show device code login interface
function showDeviceCodeLogin(loginUrl, deviceCode, isDemo = false) {
    console.log('showDeviceCodeLogin called with:', { loginUrl, deviceCode, isDemo });

    const statusDiv = document.getElementById('auth-status');
    console.log('Status div found:', !!statusDiv);

    if (!statusDiv) {
        console.error('Auth status div not found!');
        return;
    }

    const demoNotice = isDemo ? `
        <div class="demo-notice">
            <h4>🔧 DEMO MODE - Azure CLI Not Configured</h4>
            <p>This is a demo device code for testing the interface. To use with real Azure authentication, please install and configure Azure CLI.</p>
        </div>
    ` : '';

    // Create a more visible and prominent display
    statusDiv.innerHTML = `
        <div style="background: #0078d4; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h2 style="margin: 0 0 15px 0; color: white;">🔐 Azure Authentication Required</h2>
            <div style="background: white; color: #0078d4; padding: 20px; border-radius: 8px; margin: 15px 0; font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                ${deviceCode}
            </div>
            <p style="margin: 15px 0; font-size: 18px; color: white;">📱 Copy this device code</p>
            <div style="margin: 15px 0;">
                <a href="${loginUrl}" target="_blank" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 10px;">
                    🌐 Open Login Page
                </a>
            </div>
            <p style="margin: 15px 0; color: white;">1. Click the button above to open the login page<br>
            2. Sign in with your Azure credentials<br>
            3. Enter the device code: <strong>${deviceCode}</strong><br>
            4. Return here and click "Verify" below</p>
            <button onclick="checkAuthenticationStatus()" style="background: #ffc107; color: #212529; padding: 15px 30px; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; margin: 10px;">
                ✅ I've Completed Authentication - Verify Now
            </button>
        </div>
    `;

    console.log('Device code HTML set, length:', statusDiv.innerHTML.length);
    console.log('Auth section visibility:', getComputedStyle(document.getElementById('auth-section')).display);
    console.log('Status div content preview:', statusDiv.innerHTML.substring(0, 200) + '...');
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
            if (errorData.needsLogin) {
                showAuthStatus('Authentication not completed yet. Please complete the device code authentication in your browser first.', 'error');
                return;
            }
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