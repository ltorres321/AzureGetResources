// Global variables for resources
let allResources = [];
let isLoading = false;

// Fetch all resources from selected subscriptions
async function fetchAllResources() {
    if (isLoading) return;

    const selectedSubscriptions = getSelectedSubscriptions();

    if (selectedSubscriptions.length === 0) {
        showFetchStatus('Please select at least one subscription.', 'error');
        return;
    }

    isLoading = true;
    allResources = [];

    showFetchStatus(`Fetching resources from ${selectedSubscriptions.length} subscription(s)...`, 'info');

    try {
        for (const subscriptionId of selectedSubscriptions) {
            await fetchResourcesForSubscription(subscriptionId);
        }

        displayResults();
        showResultsSection();
        showFetchStatus(`Successfully fetched ${allResources.length} resources.`, 'success');

    } catch (error) {
        console.error('Error fetching resources:', error);
        showFetchStatus('Error fetching resources: ' + error.message, 'error');
    } finally {
        isLoading = false;
    }
}

// Fetch resources for a specific subscription
async function fetchResourcesForSubscription(subscriptionId) {
    const subscription = subscriptions.find(sub => sub.subscriptionId === subscriptionId);
    const subscriptionName = subscription ? subscription.displayName : subscriptionId;

    try {
        // Get all resource groups first
        const resourceGroupsResponse = await axios.get(
            `https://management.azure.com/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const resourceGroups = resourceGroupsResponse.data.value;

        // Fetch resources for each resource group
        for (const rg of resourceGroups) {
            await fetchResourcesInResourceGroup(subscriptionId, rg.name, subscriptionName);
        }

        // Also fetch resources at subscription level (not in resource groups)
        await fetchResourcesAtSubscriptionLevel(subscriptionId, subscriptionName);

    } catch (error) {
        console.error(`Error fetching resources for subscription ${subscriptionId}:`, error);
        throw error;
    }
}

// Fetch resources in a specific resource group
async function fetchResourcesInResourceGroup(subscriptionId, resourceGroupName, subscriptionName) {
    try {
        const response = await axios.get(
            `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/resources?api-version=2021-04-01`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const resources = response.data.value;

        // Add subscription and resource group info to each resource
        resources.forEach(resource => {
            allResources.push({
                subscriptionId: subscriptionId,
                subscriptionName: subscriptionName,
                resourceGroupName: resourceGroupName,
                resourceId: resource.id,
                resourceName: resource.name,
                resourceType: resource.type,
                location: resource.location,
                tags: resource.tags || {},
                sku: resource.sku,
                kind: resource.kind,
                managedBy: resource.managedBy,
                createdTime: resource.createdTime,
                changedTime: resource.changedTime,
                provisioningState: resource.provisioningState
            });
        });

    } catch (error) {
        // Some resource groups might not exist or be accessible
        console.warn(`Could not fetch resources for resource group ${resourceGroupName}:`, error.message);
    }
}

// Fetch resources at subscription level (not in resource groups)
async function fetchResourcesAtSubscriptionLevel(subscriptionId, subscriptionName) {
    try {
        const response = await axios.get(
            `https://management.azure.com/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const resources = response.data.value;

        // Add subscription info to each resource (no resource group)
        resources.forEach(resource => {
            allResources.push({
                subscriptionId: subscriptionId,
                subscriptionName: subscriptionName,
                resourceGroupName: null,
                resourceId: resource.id,
                resourceName: resource.name,
                resourceType: resource.type,
                location: resource.location,
                tags: resource.tags || {},
                sku: resource.sku,
                kind: resource.kind,
                managedBy: resource.managedBy,
                createdTime: resource.createdTime,
                changedTime: resource.changedTime,
                provisioningState: resource.provisioningState
            });
        });

    } catch (error) {
        console.warn(`Could not fetch subscription-level resources for ${subscriptionId}:`, error.message);
    }
}

// Display results
function displayResults() {
    const summaryDiv = document.getElementById('results-summary');
    const resourcesListDiv = document.getElementById('resources-list');

    // Summary
    const subscriptionCount = new Set(allResources.map(r => r.subscriptionId)).size;
    const resourceGroupCount = new Set(allResources.map(r => r.resourceGroupName).filter(Boolean)).size;

    summaryDiv.innerHTML = `
        <div class="summary-stats">
            <div class="stat">
                <span class="stat-value">${allResources.length}</span>
                <span class="stat-label">Total Resources</span>
            </div>
            <div class="stat">
                <span class="stat-value">${subscriptionCount}</span>
                <span class="stat-label">Subscriptions</span>
            </div>
            <div class="stat">
                <span class="stat-value">${resourceGroupCount}</span>
                <span class="stat-label">Resource Groups</span>
            </div>
        </div>
    `;

    // Resources list (grouped by subscription)
    const resourcesBySubscription = groupResourcesBySubscription();

    let html = '';
    for (const [subscriptionId, resources] of Object.entries(resourcesBySubscription)) {
        const subscription = subscriptions.find(sub => sub.subscriptionId === subscriptionId);
        const subscriptionName = subscription ? subscription.displayName : subscriptionId;

        html += `
            <div class="subscription-group">
                <h4>${subscriptionName} (${subscriptionId})</h4>
                <div class="resource-group">
        `;

        const resourcesByRG = groupResourcesByResourceGroup(resources);
        for (const [rgName, rgResources] of Object.entries(resourcesByRG)) {
            if (rgName) {
                html += `<h5>Resource Group: ${rgName}</h5>`;
            } else {
                html += `<h5>Subscription Level Resources</h5>`;
            }

            html += '<div class="resources-table">';
            html += `
                <div class="resource-header">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Location</span>
                </div>
            `;

            rgResources.forEach(resource => {
                html += `
                    <div class="resource-item">
                        <span class="resource-name">${resource.resourceName}</span>
                        <span class="resource-type">${resource.resourceType}</span>
                        <span class="resource-location">${resource.location || 'N/A'}</span>
                    </div>
                `;
            });

            html += '</div>';
        }

        html += '</div></div>';
    }

    resourcesListDiv.innerHTML = html;
}

// Group resources by subscription
function groupResourcesBySubscription() {
    return allResources.reduce((acc, resource) => {
        if (!acc[resource.subscriptionId]) {
            acc[resource.subscriptionId] = [];
        }
        acc[resource.subscriptionId].push(resource);
        return acc;
    }, {});
}

// Group resources by resource group
function groupResourcesByResourceGroup(resources) {
    return resources.reduce((acc, resource) => {
        const rgName = resource.resourceGroupName || '';
        if (!acc[rgName]) {
            acc[rgName] = [];
        }
        acc[rgName].push(resource);
        return acc;
    }, {});
}

// Download results as JSON file
function downloadAsJSON() {
    if (allResources.length === 0) {
        showFetchStatus('No resources to download.', 'error');
        return;
    }

    const dataStr = JSON.stringify(allResources, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `azure-resources-${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    showFetchStatus('JSON file downloaded successfully.', 'success');
}

// Show fetch status
function showFetchStatus(message, type) {
    const statusDiv = document.getElementById('fetch-status');
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 3000);
    }
}

// Show loading state on fetch button
function updateFetchButton() {
    const button = document.getElementById('fetch-resources-btn');
    if (isLoading) {
        button.textContent = 'Fetching Resources...';
        button.disabled = true;
    } else {
        button.textContent = 'Fetch All Resources';
        button.disabled = false;
    }
}

// Monitor loading state
setInterval(() => {
    updateFetchButton();
}, 100);