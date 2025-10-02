# Azure Resource Manager

A web application that authenticates with Azure and pulls all resources by subscription into a JSON file.

## Features

- 🔐 Azure OAuth 2.0 authentication
- 📋 Multi-subscription support with selection
- 🌐 Fetches resources from all resource groups and subscription level
- 📊 Displays resource summary statistics
- 💾 Downloads results as JSON file
- 🎨 Clean, responsive web interface

## Prerequisites

### Azure AD Application Registration

Before using this application, you need to register an Azure AD application:

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Enter a name for your application (e.g., "Azure Resource Manager")
5. Select **Single Page Application (SPA)** as the platform type
6. Add your redirect URI: `http://localhost:3000` (or your deployed URL)
7. Click **Register**

### API Permissions

After registration, configure API permissions:

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** > **Delegated permissions**
4. Add `User.Read` permission
5. Click **Add a permission** again
6. Select **APIs my organization uses** > Search for "Azure Service Management"
7. Select **Azure Service Management** > **Delegated permissions**
8. Add `user_impersonation` permission
9. Click **Grant admin consent**

### Client ID

Note down your application's **Application (client) ID** - you'll need this in the code.

## Setup

1. **Clone or download** the project files
2. **Open `auth.js`** and replace `YOUR_AZURE_APP_CLIENT_ID` with your actual client ID:

```javascript
const AZURE_CONFIG = {
    clientId: 'your-actual-client-id-here', // Replace this line
    // ... rest of config
};
```

3. **Open `index.html`** in a web browser or serve it using a local server

## Usage

1. **Enter your Azure email** (user@tenant.onmicrosoft.com)
2. **Click "Authenticate with Azure"**
3. **Sign in** to your Azure account in the popup
4. **Select subscriptions** you want to fetch resources from
5. **Click "Fetch All Resources"**
6. **View results** and click "Download as JSON" to save

## File Structure

```
├── index.html      # Main HTML interface
├── auth.js         # Azure OAuth authentication logic
├── resources.js    # Resource fetching and management
├── styles.css      # CSS styling
└── README.md       # This file
```

## Azure Resource Data

The JSON output includes the following information for each resource:

- `subscriptionId` - Azure subscription ID
- `subscriptionName` - Display name of the subscription
- `resourceGroupName` - Name of the resource group (null for subscription-level resources)
- `resourceId` - Full Azure resource ID
- `resourceName` - Resource name
- `resourceType` - Azure resource type (e.g., Microsoft.Compute/virtualMachines)
- `location` - Azure region
- `tags` - Resource tags object
- `sku` - SKU information (if applicable)
- `kind` - Resource kind (if applicable)
- `managedBy` - Managing resource ID (if applicable)
- `createdTime` - Resource creation timestamp
- `changedTime` - Last modification timestamp
- `provisioningState` - Current provisioning state

## Security Notes

- Access tokens are stored in browser sessionStorage (not persistent)
- The application only requests the minimum required permissions
- No data is sent to external servers except Azure APIs
- Consider using HTTPS in production for enhanced security

## Browser Compatibility

- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge (recent versions)
- Internet Explorer 11+ (with polyfills)

## Troubleshooting

### Authentication Issues

- Ensure your Azure AD app is properly configured
- Check that redirect URI matches your setup
- Verify API permissions are granted

### Resource Fetching Issues

- Check that your account has read permissions on the subscriptions
- Some resources might not be accessible due to RBAC restrictions
- Large subscriptions may take time to fetch all resources

### CORS Issues

- Serve the files through a web server (not file:// protocol)
- Use a simple HTTP server: `python -m http.server` or `npx serve`

## Development

To modify or extend the application:

1. **Authentication**: Modify `auth.js` for OAuth flow changes
2. **Resource fetching**: Update `resources.js` for different Azure APIs
3. **UI changes**: Edit `index.html` and `styles.css`

## License

This project is provided as-is for educational and internal business use.