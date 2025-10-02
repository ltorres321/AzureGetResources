# Azure Resource Manager

A web application to browse and manage Azure resources using Azure CLI authentication.

## Features

- 🔐 Azure CLI-based authentication (no Azure AD app registration required)
- 📋 Browse Azure subscriptions
- 🔍 List all Azure resources across subscriptions
- 💾 Export resource data as JSON
- 🎨 Modern, responsive UI

## Prerequisites

1. **Azure CLI** installed and configured
   - Download from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
   - Log in with: `az login`

2. **Node.js** (version 14 or higher)
   - Download from: https://nodejs.org/

## Setup Instructions

1. **Install backend dependencies:**
   ```bash
   npm install
   ```

2. **Login to Azure CLI:**
   ```bash
   az login
   ```
   Follow the browser-based authentication process.

3. **Start the backend server:**
   ```bash
   npm start
   ```
   The server will run on http://localhost:3001

4. **Open the application:**
   - Open `index.html` in your web browser
   - Or serve it using a local web server if needed

## How It Works

1. **Authentication**: The app uses your Azure CLI login session to get an access token for Azure Resource Manager APIs
2. **Subscription Selection**: Choose which Azure subscriptions to scan
3. **Resource Discovery**: Fetches all resources from selected subscriptions
4. **Export**: Download the resource data as JSON

## Troubleshooting

### "Failed to get Azure token"
- Make sure you're logged in to Azure CLI: `az login`
- Ensure Azure CLI is properly installed
- Check that the backend server is running on port 3001

### "Authentication failed"
- Verify your Azure CLI login is still valid
- Try logging out and back in: `az logout` then `az login`
- Check browser console for detailed error messages

### CORS Issues
- The backend server includes CORS support
- Make sure you're accessing the app through a web server (not file:// protocol)

## Architecture

- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Backend**: Node.js/Express server for Azure CLI integration
- **Authentication**: Uses Azure CLI's access token for ARM API calls

## Security Note

This application uses your Azure CLI authentication session, so it inherits the same permissions as your CLI login. Make sure you're logged in with appropriate permissions for the subscriptions you want to access.