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

    // Get the auth-section specifically
    const authSection = document.getElementById('auth-section');
    console.log('Auth section found:', !!authSection);
    
    if (!authSection) {
        console.error('Auth section not found!');
        alert('ERROR: Auth section not found! Device code: ' + deviceCode + ' URL: ' + loginUrl);
        return;
    }

    // Get auth-status div within auth-section
    const statusDiv = authSection.querySelector('#auth-status');
    console.log('Status div found:', !!statusDiv);

    if (!statusDiv) {
        console.error('Auth status div not found!');
        alert('ERROR: Auth status div not found! Device code: ' + deviceCode + ' URL: ' + loginUrl);
        return;
    }

    // Create a more visible and prominent display with inline styles
    const deviceCodeHTML = `
        <div style="background: #0078d4; color: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <h2 style="margin: 0 0 20px 0; color: white; font-size: 28px;">🔐 Azure Authentication Required</h2>
            <div style="background: white; color: #0078d4; padding: 30px; border-radius: 8px; margin: 20px auto; font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 5px; max-width: 500px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                ${deviceCode}
            </div>
            <p style="margin: 20px 0; font-size: 20px; color: white; font-weight: bold;">📱 COPY THIS DEVICE CODE ABOVE</p>
            <div style="margin: 20px 0;">
                <a href="${loginUrl}" target="_blank" style="background: #28a745; color: white; padding: 20px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 10px; font-size: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                    🌐 OPEN LOGIN PAGE
                </a>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 6px; margin: 20px 0; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                <p style="margin: 10px 0; color: white; font-size: 16px;"><strong>Step 1:</strong> Click "OPEN LOGIN PAGE" button above</p>
                <p style="margin: 10px 0; color: white; font-size: 16px;"><strong>Step 2:</strong> Sign in with your Azure credentials</p>
                <p style="margin: 10px 0; color: white; font-size: 16px;"><strong>Step 3:</strong> Enter device code: <strong style="font-size: 20px;">${deviceCode}</strong></p>
                <p style="margin: 10px 0; color: white; font-size: 16px;"><strong>Step 4:</strong> Return here and click "Verify" below</p>
            </div>
            <button onclick="checkAuthenticationStatus()" style="background: #ffc107; color: #212529; padding: 20px 40px; border: none; border-radius: 6px; font-weight: bold; font-size: 18px; cursor: pointer; margin: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                ✅ I'VE COMPLETED AUTHENTICATION - VERIFY NOW
            </button>
        </div>
    `;

    statusDiv.innerHTML = deviceCodeHTML;
    console.log('✅ Device code HTML set successfully! Length:', statusDiv.innerHTML.length);
    console.log('Auth section display:', getComputedStyle(authSection).display);
    console.log('Auth section visibility:', getComputedStyle(authSection).visibility);
    console.log('Status div content set with device code:', deviceCode);
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