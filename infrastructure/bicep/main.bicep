// Main Bicep orchestration template for Augeo Platform
targetScope = 'subscription'

@description('Environment name')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Azure region')
param location string = 'eastus'

@description('Application name prefix')
param appName string = 'augeo'

@description('Tags for all resources')
param tags object = {
  Environment: environment
  Project: 'augeo-platform'
  ManagedBy: 'Bicep'
}

@description('Alert notification email addresses')
param alertEmailAddresses array = []

// Naming convention
var resourceGroupName = '${appName}-${environment}-rg'
var appServicePlanName = '${appName}-${environment}-asp'
var appServiceName = '${appName}-${environment}-api'
var staticWebAppName = '${appName}-${environment}-admin'
var postgresServerName = '${appName}-${environment}-postgres'
var redisCacheName = '${appName}-${environment}-redis'
var keyVaultName = '${appName}-${environment}-kv'
var logAnalyticsName = '${appName}-${environment}-logs'
var appInsightsName = '${appName}-${environment}-insights'
var storageAccountName = replace('${appName}${environment}storage', '-', '')

// Secure parameters
@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

// Optional parameters for custom domain (Phase 5)
@description('Custom domain name (e.g., augeo.app) - only used in production')
param customDomain string = ''

@description('Enable custom domain and email services')
param enableCustomDomain bool = environment == 'production'

// Cost management parameters
@description('Monthly budget amount in USD')
param monthlyBudget int

// Deploy Resource Group
module resourceGroup './modules/resource-group.bicep' = {
  name: 'resourceGroup-${environment}'
  params: {
    resourceGroupName: resourceGroupName
    location: location
    tags: tags
  }
}

// Deploy Log Analytics Workspace (needed by Application Insights)
module logAnalytics './modules/log-analytics.bicep' = {
  name: 'logAnalytics-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    workspaceName: logAnalyticsName
    location: location
    environment: environment
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy Application Insights
module appInsights './modules/monitoring.bicep' = {
  name: 'appInsights-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appInsightsName: appInsightsName
    location: location
    environment: environment
    workspaceId: logAnalytics.outputs.workspaceId
    backendApiUrl: environment == 'production' ? 'https://api.${customDomain}' : 'https://${appServiceName}.azurewebsites.net'
    frontendUrl: environment == 'production' ? 'https://admin.${customDomain}' : 'https://${staticWebAppName}.azurestaticapps.net'
    alertEmailAddresses: alertEmailAddresses
    tags: tags
  }
}

// Deploy App Service Plan
module appServicePlan './modules/app-service-plan.bicep' = {
  name: 'appServicePlan-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appServicePlanName: appServicePlanName
    location: location
    environment: environment
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy PostgreSQL
module postgres './modules/database.bicep' = {
  name: 'postgres-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    postgresServerName: postgresServerName
    location: location
    environment: environment
    administratorPassword: postgresAdminPassword
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy Redis Cache
module redis './modules/redis.bicep' = {
  name: 'redis-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    redisCacheName: redisCacheName
    location: location
    environment: environment
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy Storage Account
module storage './modules/storage.bicep' = {
  name: 'storage-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    storageAccountName: storageAccountName
    location: location
    environment: environment
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy App Service (Backend)
module appService './modules/app-service.bicep' = {
  name: 'appService-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appServiceName: appServiceName
    location: location
    environment: environment
    appServicePlanId: appServicePlan.outputs.appServicePlanId
    keyVaultName: keyVaultName
    appInsightsConnectionString: appInsights.outputs.appInsightsConnectionString
    tags: tags
  }
}

// Deploy Key Vault (depends on App Service for managed identity)
module keyVault './modules/key-vault.bicep' = {
  name: 'keyVault-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    keyVaultName: keyVaultName
    location: location
    environment: environment
    appServicePrincipalId: appService.outputs.appServicePrincipalId
    tags: tags
  }
}

// Deploy Static Web App (Frontend) - Use eastus2 as Static Web Apps not available in eastus
module staticWebApp './modules/static-web-app.bicep' = {
  name: 'staticWebApp-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    staticWebAppName: staticWebAppName
    location: 'eastus2' // Static Web Apps limited regions
    environment: environment
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy DNS Zone (Phase 5 - Production only)
module dnsZone './modules/dns.bicep' = if (enableCustomDomain && customDomain != '') {
  name: 'dnsZone-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    domainName: customDomain
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy Communication Services (Phase 5)
module communicationServices './modules/communication.bicep' = if (enableCustomDomain && customDomain != '') {
  name: 'communicationServices-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: environment
    emailDomain: customDomain
    tags: tags
  }
  dependsOn: [
    resourceGroup
    dnsZone
  ]
}

// Deploy Cost Budget (Phase 9)
module budget './modules/budget.bicep' = {
  name: 'budget-${environment}'
  params: {
    environment: environment
    budgetAmount: monthlyBudget
    alertEmailAddresses: alertEmailAddresses
    resourceGroupName: resourceGroupName
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy Resource Locks for Production (Phase 9 - T152)
// Locks prevent accidental deletion of critical resources
module postgresLock './modules/resource-lock.bicep' = {
  name: 'postgresLock-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: environment
    targetResourceName: postgresServerName
    lockNotes: 'Critical database - contains all application data'
  }
}

module redisLock './modules/resource-lock.bicep' = {
  name: 'redisLock-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: environment
    targetResourceName: redisCacheName
    lockNotes: 'Critical cache - contains session data'
  }
}

module keyVaultLock './modules/resource-lock.bicep' = {
  name: 'keyVaultLock-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: environment
    targetResourceName: keyVaultName
    lockNotes: 'Critical secrets store - contains all application secrets'
  }
}

module storageLock './modules/resource-lock.bicep' = {
  name: 'storageLock-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: environment
    targetResourceName: storageAccountName
    lockNotes: 'Critical storage - contains backups and logs'
  }
}

// TODO: Update DNS records with App Service and Static Web App hostnames after deployment

// Outputs
output resourceGroupName string = resourceGroup.outputs.resourceGroupName
output resourceGroupId string = resourceGroup.outputs.resourceGroupId
output location string = location
output environment string = environment

// App Service outputs
output appServiceName string = appService.outputs.appServiceName
output appServiceUrl string = 'https://${appService.outputs.appServiceDefaultHostname}'

// Static Web App outputs
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output staticWebAppUrl string = 'https://${staticWebApp.outputs.staticWebAppDefaultHostname}'

// Database outputs
output postgresServerName string = postgres.outputs.postgresServerName
output postgresDatabaseName string = postgres.outputs.postgresDatabaseName

// Redis outputs
output redisCacheName string = redis.outputs.redisCacheName

// Key Vault outputs
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri

// Monitoring outputs
output appInsightsName string = appInsights.outputs.appInsightsName
output appInsightsConnectionString string = appInsights.outputs.appInsightsConnectionString

// Storage outputs
output storageAccountName string = storage.outputs.storageAccountName

// DNS outputs (Phase 5)
output dnsZoneName string = enableCustomDomain && customDomain != '' ? dnsZone!.outputs.dnsZoneName : ''
output nameServers array = enableCustomDomain && customDomain != '' ? dnsZone!.outputs.nameServers : []
output nameServerInstructions string = enableCustomDomain && customDomain != '' ? dnsZone!.outputs.nameServerInstructions : 'Custom domain not configured'

// Communication Services outputs (Phase 5)
output communicationServiceName string = enableCustomDomain && customDomain != '' ? communicationServices!.outputs.communicationServiceName : ''
output communicationServiceEndpoint string = enableCustomDomain && customDomain != '' ? communicationServices!.outputs.communicationServiceEndpoint : ''
output emailDomainStatus string = enableCustomDomain && customDomain != '' ? communicationServices!.outputs.emailDomainStatus : ''
output dnsRecordsRequired object = enableCustomDomain && customDomain != '' ? communicationServices!.outputs.dnsRecordsRequired : {}
output emailConfigurationInstructions string = enableCustomDomain && customDomain != '' ? communicationServices!.outputs.configurationInstructions : 'Email services not configured'

// Budget outputs (Phase 9)
output budgetId string = budget.outputs.budgetId
output budgetName string = budget.outputs.budgetName
output monthlyBudgetAmount int = budget.outputs.budgetAmount
