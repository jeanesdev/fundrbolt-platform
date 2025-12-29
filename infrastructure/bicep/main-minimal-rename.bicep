// Minimal Bicep deployment for Fundrbolt rename
// Only creates: Resource Group, Key Vault, Storage, Log Analytics, App Insights, Communication Services, DNS
// Excludes: App Service, Static Web Apps, PostgreSQL, Redis

targetScope = 'subscription'

@description('Environment name (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Azure region for resources')
param location string = 'eastus'

@description('Application name')
param appName string = 'fundrbolt'

@description('Custom tags for resources')
param tags object = {}

@description('Email addresses for budget alerts')
param alertEmailAddresses array = []

@description('Custom domain for DNS')
param customDomain string = 'fundrbolt.com'

// Resource naming
var resourceGroupName = '${appName}-${environment}-rg'
var keyVaultName = '${appName}-${environment}-kv'
var storageName = replace('${appName}${environment}stor', '-', '')
var logAnalyticsName = '${appName}-${environment}-logs'
var appInsightsName = '${appName}-${environment}-insights'
var communicationName = '${appName}-${environment}-comm'

// Merge tags
var allTags = union(tags, {
  Environment: environment
  Project: '${appName}-platform'
  ManagedBy: 'Bicep'
})

// 1. Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: allTags
}

// 2. Log Analytics Workspace
module logAnalytics './modules/log-analytics.bicep' = {
  name: '${deployment().name}-logs'
  scope: rg
  params: {
    workspaceName: logAnalyticsName
    location: location
    environment: environment
    tags: allTags
  }
}

// 3. Application Insights (using monitoring module)
module appInsights './modules/monitoring.bicep' = {
  name: '${deployment().name}-insights'
  scope: rg
  params: {
    appInsightsName: appInsightsName
    location: location
    environment: environment
    workspaceId: logAnalytics.outputs.workspaceId
    tags: allTags
    alertEmailAddresses: alertEmailAddresses
    backendApiUrl: 'https://${appName}-${environment}-backend.azurewebsites.net'
    frontendUrl: 'https://${appName}-${environment}-admin.azurestaticapps.net'
    enableAvailabilityTests: false // Disabled for minimal deployment (no apps yet)
  }
}

// 4. Storage Account
module storage './modules/storage.bicep' = {
  name: '${deployment().name}-storage'
  scope: rg
  params: {
    storageAccountName: storageName
    location: location
    environment: environment
    tags: allTags
  }
}

// 5. Key Vault
module keyVault './modules/key-vault.bicep' = {
  name: '${deployment().name}-kv'
  scope: rg
  params: {
    keyVaultName: keyVaultName
    location: location
    environment: environment
    tags: allTags
  }
}

// 6. Communication Services - SKIPPED for minimal deployment due to API type issues
// Will be deployed with full infrastructure later

// 7. DNS Zone
module dns './modules/dns.bicep' = {
  name: '${deployment().name}-dns'
  scope: rg
  params: {
    domainName: customDomain
    tags: allTags
  }
}

// Outputs
output resourceGroupName string = resourceGroupName
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output storageName string = storage.outputs.storageAccountName
output storageEndpoints object = storage.outputs.storageAccountPrimaryEndpoints
output logAnalyticsId string = logAnalytics.outputs.workspaceId
output appInsightsId string = appInsights.outputs.appInsightsId
output appInsightsConnectionString string = appInsights.outputs.appInsightsConnectionString
output dnsZoneName string = dns.outputs.dnsZoneName
output dnsNameServers array = dns.outputs.nameServers
