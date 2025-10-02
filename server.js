const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Promisify exec for async/await
const execAsync = util.promisify(exec);

// Azure CLI token endpoint
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Azure authentication server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Azure authentication server running on http://localhost:${PORT}`);
    console.log('Make sure Azure CLI is installed and you are logged in with "az login"');
});