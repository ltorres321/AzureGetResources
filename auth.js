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
    const statusDiv = document.getElementById('auth-status');
    const demoNotice = isDemo ? `
        <div class="demo-notice">
            <h4>🔧 DEMO MODE - Azure CLI Not Configured</h4>
            <p>This is a demo device code for testing the interface. To use with real Azure authentication, please install and configure Azure CLI.</p>
        </div>
    ` : '';

    statusDiv.innerHTML = `
        <div class="device-code-container">
            <div class="device-code-header">
                <h3>${isDemo ? '🔧' : '🔐'} Complete Your Azure Authentication</h3>
                <p class="instructions">Follow these steps to authenticate:</p>
                ${demoNotice}
            </div>

            <div class="device-code-display">
                <div class="code-section">
                    <h4>📱 Your Device Code:</h4>
                    <div class="device-code-box">${deviceCode}</div>
                    <p class="code-instruction">Copy this code - you'll need to enter it in the next step</p>
                </div>

                <div class="url-section">
                    <h4>🌐 Login URL:</h4>
                    <div class="login-url">
                        <a href="${loginUrl}" target="_blank" class="login-link">${loginUrl}</a>
                    </div>
                    <p class="url-instruction">Click the link above or copy and paste it into your browser</p>
                </div>
            </div>

            <div class="step-by-step">
                <h4>Step-by-Step Instructions:</h4>
                <ol>
                    <li><strong>Open your web browser</strong> and navigate to the login URL above</li>
                    <li><strong>Sign in</strong> with your Azure credentials when prompted</li>
                    <li><strong>Enter the device code</strong> <code>${deviceCode}</code> when asked</li>
                    <li><strong>Complete the authentication</strong> in your browser</li>
                    <li><strong>Return here</strong> and click the button below to verify</li>
                </ol>
            </div>

            <div class="action-buttons">
                <button onclick="checkAuthenticationStatus()" class="btn-primary btn-large">
                    ✅ I've completed authentication - Verify Now
                </button>
                <button onclick="startOver()" class="btn-secondary">
                    🔄 Start Over
                </button>
            </div>

            <div class="waiting-note">
                <p>⏳ <strong>Waiting for authentication...</strong> This process is secure and your credentials are protected.</p>
            </div>
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