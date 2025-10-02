const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        // Allow specific origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://localhost:3000',
            'https://localhost:3001'
        ];

        // Check if origin matches any allowed pattern
        if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(':3001', '')))) {
            return callback(null, true);
        }

        // For development, allow any localhost origin
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }

        // For GitHub Codespaces, allow githubpreview.dev and github.dev
        if (origin.includes('githubpreview.dev') || origin.includes('github.dev')) {
            return callback(null, true);
        }

        console.log('CORS blocked origin:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Promisify exec for async/await
const execAsync = util.promisify(exec);

// Azure CLI login endpoint
app.post('/api/azure-login', async (req, res) => {
    try {
        console.log('Starting Azure CLI device code login...');

        // First check if already logged in
        try {
            const { stdout: tokenStdout } = await execAsync(
                'az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv'
            );
            const existingToken = tokenStdout.trim();

            if (existingToken && existingToken !== '') {
                return res.json({
                    accessToken: existingToken,
                    loginRequired: false,
                    message: 'Already logged in'
                });
            }
        } catch (tokenError) {
            // Not logged in, continue with device code flow
        }

        // First, let's check if Azure CLI is available
        try {
            await execAsync('az --version');
        } catch (cliError) {
            return res.status(500).json({
                error: 'Azure CLI not found. Please install Azure CLI first: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli'
            });
        }

        // Create device code for login (without full login)
        console.log('Attempting to get device code...');
        const { stdout, stderr } = await execAsync(
            'az login --use-device-code'
        );

        console.log('=== AZURE CLI DEBUG INFO ===');
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
        console.log('============================');

        // Parse the stderr output for device code and URL
        const deviceCodeMatch = stderr.match(/To sign in, use a web browser to open the page ([^\s]+) and enter the code ([^\s]+) to authenticate/);

        if (deviceCodeMatch) {
            const loginUrl = deviceCodeMatch[1];
            const deviceCode = deviceCodeMatch[2];

            console.log('Found device code:', deviceCode);
            console.log('Found login URL:', loginUrl);

            return res.json({
                loginRequired: true,
                loginUrl: loginUrl,
                deviceCode: deviceCode,
                message: 'Please complete device code authentication'
            });
        }

        // If parsing failed, return debug info
        console.log('Could not parse device code from output');
        res.status(500).json({
            error: 'Could not parse device code from Azure CLI output',
            stdout: stdout,
            stderr: stderr,
            debug: 'Expected format: "To sign in, use a web browser to open the page {URL} and enter the code {CODE} to authenticate."'
        });

        // Alternative: Use az login with device code to get the code
        try {
            const { stdout: loginStdout, stderr: loginStderr } = await execAsync(
                'az login --use-device-code --output json'
            );

            console.log('Login stdout:', loginStdout);
            console.log('Login stderr:', loginStderr);

            // Try parsing as JSON first
            try {
                const loginJson = JSON.parse(loginStdout);
                if (loginJson && loginJson.user_code && loginJson.verification_url) {
                    return res.json({
                        loginRequired: true,
                        loginUrl: loginJson.verification_url,
                        deviceCode: loginJson.user_code,
                        message: 'Please complete device code authentication',
                        expires_in: loginJson.expires_in || 900
                    });
                }
            } catch (e) {
                // Not JSON, continue to regex parsing
            }

            // Fallback: parse from stderr
            const deviceCodeMatch = loginStderr.match(/To sign in, use a web browser to open the page ([^\s]+) and enter the code ([^\s]+) to authenticate/);
            if (deviceCodeMatch) {
                return res.json({
                    loginRequired: true,
                    loginUrl: deviceCodeMatch[1],
                    deviceCode: deviceCodeMatch[2],
                    message: 'Please complete device code authentication'
                });
            }

            // If we get here, return the raw output for debugging
            res.status(500).json({
                error: 'Could not parse device code from az login',
                stdout: loginStdout,
                stderr: loginStderr
            });

        } catch (loginError) {
            console.error('Login command failed:', loginError);

            // For development/demo purposes, return a mock device code if Azure CLI fails
            console.log('Azure CLI not available, returning demo device code for testing');
            return res.json({
                loginRequired: true,
                loginUrl: 'https://microsoft.com/devicelogin',
                deviceCode: 'DEMO123456',
                message: 'Demo device code - Azure CLI not configured. This is for testing the UI only.',
                demo: true
            });
        }

    } catch (error) {
        console.error('Error in Azure login:', error);
        res.status(500).json({
            error: 'Failed to start Azure login: ' + error.message,
            details: error.stderr || 'No additional details'
        });
    }
});

// Azure CLI token endpoint (for getting token after login)
app.post('/api/get-azure-token', async (req, res) => {
    try {
        console.log('Getting Azure CLI token...');

        // Execute Azure CLI command to get access token for ARM
        const { stdout, stderr } = await execAsync(
            'az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv'
        );

        if (stderr) {
            console.error('Azure CLI stderr:', stderr);
        }

        const token = stdout.trim();

        if (!token || token === '') {
            return res.status(500).json({
                error: 'Failed to get Azure token. Make sure you are logged in to Azure CLI with "az login"'
            });
        }

        console.log('Token retrieved successfully');
        res.json({ accessToken: token });

    } catch (error) {
        console.error('Error getting Azure token:', error);

        if (error.code === 'ENOENT') {
            return res.status(500).json({
                error: 'Azure CLI not found. Please install Azure CLI from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli'
            });
        }

        if (error.stderr && error.stderr.includes('az login')) {
            return res.status(401).json({
                error: 'Please log in to Azure CLI first using: az login'
            });
        }

        res.status(500).json({
            error: 'Failed to get Azure token: ' + error.message
        });
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Azure authentication server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Azure authentication server running on http://localhost:${PORT}`);
    console.log('Ready to handle Azure authentication requests');
});