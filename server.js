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
        console.log('Starting Azure CLI login process...');

        // First try to get existing token
        try {
            const { stdout: tokenStdout, stderr: tokenStderr } = await execAsync(
                'az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv'
            );

            if (tokenStderr) {
                console.error('Azure CLI token stderr:', tokenStderr);
            }

            const existingToken = tokenStdout.trim();

            if (existingToken && existingToken !== '') {
                console.log('Existing token found');
                return res.json({
                    accessToken: existingToken,
                    loginRequired: false,
                    message: 'Token retrieved successfully'
                });
            }
        } catch (tokenError) {
            // Token retrieval failed, need to login
            console.log('No existing token, starting login process...');
        }

        // Execute Azure CLI login command (no timeout to allow interactive login)
        console.log('Executing: az login --use-device-code');
        const { stdout, stderr } = await execAsync('az login --use-device-code');

        console.log('Login stdout:', stdout);
        console.log('Login stderr:', stderr);

        // Parse the device code from stderr (where Azure CLI outputs it)
        const deviceCodeMatch = stderr.match(/To sign in, use a web browser to open the page ([^\s]+) and enter the code ([^\s]+) to authenticate/);

        if (deviceCodeMatch) {
            const loginUrl = deviceCodeMatch[1];
            const deviceCode = deviceCodeMatch[2];

            console.log('Device code found in stderr:', deviceCode);
            return res.json({
                loginRequired: true,
                loginUrl: loginUrl,
                deviceCode: deviceCode,
                message: 'Please complete device code authentication'
            });
        }

        // Check for alternative output format in stderr
        const altMatch = stderr.match(/code:?\s*([A-Z0-9]+)/i);
        if (altMatch) {
            // Try to find URL in stderr
            const urlMatch = stderr.match(/https?:\/\/[^\s)]+/);
            const url = urlMatch ? urlMatch[0] : 'https://microsoft.com/devicelogin';

            return res.json({
                loginRequired: true,
                loginUrl: url,
                deviceCode: altMatch[1],
                message: 'Please complete device code authentication'
            });
        }

        // If we get here, something went wrong
        res.status(500).json({
            error: 'Failed to parse Azure login output',
            stderr: stderr,
            stdout: stdout
        });

    } catch (error) {
        console.error('Error in Azure login process:', error);

        if (error.code === 'ENOENT') {
            return res.status(500).json({
                error: 'Azure CLI not found. Please install Azure CLI from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli'
            });
        }

        res.status(500).json({
            error: 'Failed to start Azure login: ' + error.message
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
    console.log('Make sure Azure CLI is installed and you are logged in with "az login"');
});