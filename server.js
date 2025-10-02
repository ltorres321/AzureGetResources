const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
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

        // Use az login with device code - spawn process to capture output immediately
        console.log('Starting az login with device code...');
        
        // Spawn the process to capture output without waiting for completion
        const loginProcess = spawn('az', ['login', '--use-device-code']);
        
        let stderrOutput = '';
        let deviceCodeFound = false;
        
        // Create a promise that resolves when we get the device code
        const deviceCodePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!deviceCodeFound) {
                    loginProcess.kill();
                    reject(new Error('Timeout waiting for device code'));
                }
            }, 30000); // 30 second timeout
            
            loginProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderrOutput += output;
                console.log('Azure CLI stderr:', output);
                
                // Look for the device code in the output
                // Format: "To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code XXXXXXXXX to authenticate."
                const deviceCodeMatch = stderrOutput.match(/open the page (https?:\/\/[^\s]+) and enter the code ([A-Z0-9]+)/i);
                
                if (deviceCodeMatch && !deviceCodeFound) {
                    deviceCodeFound = true;
                    clearTimeout(timeout);
                    
                    resolve({
                        loginUrl: deviceCodeMatch[1],
                        deviceCode: deviceCodeMatch[2]
                    });
                    
                    // Keep the process running in background to complete authentication
                    // Don't kill it - let it finish naturally
                }
            });
            
            loginProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            
            loginProcess.stdout.on('data', (data) => {
                console.log('Azure CLI stdout:', data.toString());
            });
        });
        
        try {
            const { loginUrl, deviceCode } = await deviceCodePromise;
            
            console.log('Device code obtained:', deviceCode);
            console.log('Login URL:', loginUrl);
            
            return res.json({
                loginRequired: true,
                loginUrl: loginUrl,
                deviceCode: deviceCode,
                message: 'Please complete device code authentication'
            });
            
        } catch (error) {
            console.error('Failed to get device code:', error);
            
            return res.status(500).json({
                error: 'Failed to start device code login: ' + error.message,
                details: stderrOutput || 'No output captured'
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