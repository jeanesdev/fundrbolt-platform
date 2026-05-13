// FundrBolt Platform — Beta Production Deployment
// Orchestration template targeting a single production environment.
// Uses Azure Container Apps (scale-to-zero) instead of App Service.
// Frontend: Azure Static Web Apps (Free tier × 3)
// Backend:  Azure Container Apps (api + worker + beat)
targetScope = 'subscription'

@description('Azure region for all resources')
param location string = 'eastus'

@description('Application name prefix')
param appName string = 'fundrbolt'

@description('Docker image reference (full tag, e.g. ghcr.io/owner/fundrbolt-backend:sha)')
param backendImage string = 'ghcr.io/jeanesdev/fundrbolt-backend:latest'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('Custom domain (e.g., fundrbolt.com)')
param customDomain string = 'fundrbolt.com'

@description('Monthly budget in USD')
param monthlyBudget int = 50

@description('Email addresses for budget and alert notifications')
param alertEmailAddresses array = []

@description('Tags applied to all resources')
param tags object = {
  Environment: 'production'
  Project: 'fundrbolt-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'operations'
}

// ── Naming convention ──────────────────────────────────────────────────────
var env = 'production'
var resourceGroupName = '${appName}-${env}-rg'
var logAnalyticsName = '${appName}-${env}-logs'
var appInsightsName = '${appName}-${env}-insights'
var postgresServerName = '${appName}-${env}-db'
var redisCacheName = '${appName}-${env}-redis'
var keyVaultName = '${appName}-${env}-kv'
var storageAccountName = take(replace('${appName}${env}storage', '-', ''), 24)
var containerAppsEnvName = '${appName}-${env}-cae'
var apiAppName = '${appName}-${env}-api'
var workerAppName = '${appName}-${env}-worker'
var beatAppName = '${appName}-${env}-beat'
var adminWebAppName = '${appName}-${env}-admin'
var donorWebAppName = '${appName}-${env}-donor'
var landingWebAppName = '${appName}-${env}-landing'

// ── Resource Group ─────────────────────────────────────────────────────────
module resourceGroup './modules/resource-group.bicep' = {
  name: 'resourceGroup'
  params: {
    resourceGroupName: resourceGroupName
    location: location
    tags: tags
  }
}

// ── Log Analytics Workspace ────────────────────────────────────────────────
module logAnalytics './modules/log-analytics.bicep' = {
  name: 'logAnalytics'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    workspaceName: logAnalyticsName
    location: location
    environment: env
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Application Insights ───────────────────────────────────────────────────
module appInsights './modules/monitoring.bicep' = {
  name: 'appInsights'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appInsightsName: appInsightsName
    location: location
    environment: env
    workspaceId: logAnalytics.outputs.workspaceId
    backendApiUrl: 'https://api.${customDomain}'
    frontendUrl: 'https://app.${customDomain}'
    alertEmailAddresses: alertEmailAddresses
    tags: tags
  }
  dependsOn: [logAnalytics]
}

// ── PostgreSQL Flexible Server ─────────────────────────────────────────────
// NOTE: eastus is restricted for PostgreSQL Flexible Server on this subscription.
// Deploy to eastus2 while keeping all other resources in eastus.
module postgres './modules/database.bicep' = {
  name: 'postgres'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    postgresServerName: postgresServerName
    location: 'eastus2'
    environment: env
    administratorPassword: postgresAdminPassword
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Azure Cache for Redis ──────────────────────────────────────────────────
module redis './modules/redis.bicep' = {
  name: 'redis'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    redisCacheName: redisCacheName
    location: location
    environment: env
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Azure Blob Storage ─────────────────────────────────────────────────────
module storage './modules/storage.bicep' = {
  name: 'storage'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    storageAccountName: storageAccountName
    location: location
    environment: env
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Key Vault ──────────────────────────────────────────────────────────────
// Deployed before Container Apps; role assignments are added after apps are created.
module keyVault './modules/key-vault.bicep' = {
  name: 'keyVault'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    keyVaultName: keyVaultName
    location: location
    environment: env
    tags: tags
    // principalId wired up separately below after Container Apps are known
  }
  dependsOn: [resourceGroup]
}

// ── Container Apps Environment ─────────────────────────────────────────────
module containerAppsEnv './modules/container-apps-env.bicep' = {
  name: 'containerAppsEnv'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    envName: containerAppsEnvName
    location: location
    logAnalyticsWorkspaceClientId: logAnalytics.outputs.workspaceCustomerId
    logAnalyticsWorkspaceKey: logAnalytics.outputs.workspaceSharedKey
    tags: tags
  }
  dependsOn: [logAnalytics]
}

// ── Common environment variables shared by all three Container Apps ─────────
// Secret env vars reference Key Vault; plain env vars are inlined.
var commonEnvVars = [
  { name: 'ENVIRONMENT', value: 'production' }
  { name: 'LOG_LEVEL', value: 'INFO' }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.outputs.appInsightsConnectionString }
]

var commonSecretEnvVars = [
  {
    name: 'database-url'
    envName: 'DATABASE_URL'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/DATABASE-URL'
  }
  {
    name: 'redis-url'
    envName: 'REDIS_URL'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/REDIS-URL'
  }
  {
    name: 'celery-broker-url'
    envName: 'CELERY_BROKER_URL'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/REDIS-URL'
  }
  {
    name: 'celery-result-backend'
    envName: 'CELERY_RESULT_BACKEND'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/REDIS-URL'
  }
  {
    name: 'secret-key'
    envName: 'JWT_SECRET_KEY'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/SECRET-KEY'
  }
  {
    name: 'azure-storage-connection-string'
    envName: 'AZURE_STORAGE_CONNECTION_STRING'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/AZURE-STORAGE-CONNECTION-STRING'
  }
  {
    name: 'azure-communication-connection-string'
    envName: 'AZURE_COMMUNICATION_CONNECTION_STRING'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/AZURE-COMMUNICATION-CONNECTION-STRING'
  }
  {
    name: 'sentry-dsn'
    envName: 'SENTRY_DSN'
    keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/SENTRY-DSN'
  }
]

// ── Container App: API ─────────────────────────────────────────────────────
module apiApp './modules/container-app.bicep' = {
  name: 'apiApp'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appName: apiAppName
    location: location
    containerAppsEnvId: containerAppsEnv.outputs.envId
    image: backendImage
    command: [] // Default CMD: uvicorn
    minReplicas: 0
    maxReplicas: 3
    cpu: '0.5'
    memory: '1Gi'
    externalIngress: true
    targetPort: 8000
    stickySessionsEnabled: true // Required for Socket.IO
    envVars: concat(commonEnvVars, [
      { name: 'FRONTEND_ADMIN_URL', value: 'https://app.${customDomain}' }
      { name: 'FRONTEND_DONOR_URL', value: 'https://give.${customDomain}' }
      {
        name: 'CORS_ORIGINS'
        value: 'https://app.${customDomain},https://give.${customDomain},https://${customDomain},https://www.${customDomain}'
      }
    ])
    secretEnvVars: commonSecretEnvVars
    tags: tags
  }
  dependsOn: [containerAppsEnv, keyVault, appInsights]
}

// ── Container App: Celery Worker ───────────────────────────────────────────
module workerApp './modules/container-app.bicep' = {
  name: 'workerApp'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appName: workerAppName
    location: location
    containerAppsEnvId: containerAppsEnv.outputs.envId
    image: backendImage
    command: ['celery', '-A', 'app.celery_app', 'worker', '--loglevel=info', '-Q', 'default,notifications']
    minReplicas: 0
    maxReplicas: 2
    cpu: '0.5'
    memory: '1Gi'
    externalIngress: false
    envVars: commonEnvVars
    secretEnvVars: commonSecretEnvVars
    tags: tags
  }
  dependsOn: [containerAppsEnv, keyVault, appInsights]
}

// ── Container App: Celery Beat (singleton) ─────────────────────────────────
module beatApp './modules/container-app.bicep' = {
  name: 'beatApp'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appName: beatAppName
    location: location
    containerAppsEnvId: containerAppsEnv.outputs.envId
    image: backendImage
    command: ['celery', '-A', 'app.celery_app', 'beat', '--loglevel=info']
    minReplicas: 1 // FR-009: beat must always run exactly 1 instance
    maxReplicas: 1
    cpu: '0.25'
    memory: '0.5Gi'
    externalIngress: false
    envVars: commonEnvVars
    secretEnvVars: commonSecretEnvVars
    tags: tags
  }
  dependsOn: [containerAppsEnv, keyVault, appInsights]
}

// ── Key Vault RBAC: grant all three container apps secret read access ───────
// Role assignments scoped to a resource must live in a resource-group-scope module.
module kvRbac './modules/kv-rbac.bicep' = {
  name: 'kvRbac'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    keyVaultName: keyVaultName
    apiPrincipalId: apiApp.outputs.principalId
    workerPrincipalId: workerApp.outputs.principalId
    beatPrincipalId: beatApp.outputs.principalId
  }
  dependsOn: [keyVault, apiApp, workerApp, beatApp]
}

// ── Static Web App: Admin PWA ──────────────────────────────────────────────
module adminStaticWebApp './modules/static-web-app.bicep' = {
  name: 'adminStaticWebApp'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    staticWebAppName: adminWebAppName
    location: 'eastus2'
    environment: env
    skuOverride: 'Free' // Budget-optimised: Free tier sufficient for beta
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Static Web App: Donor PWA ──────────────────────────────────────────────
module donorStaticWebApp './modules/donor-static-web-app.bicep' = {
  name: 'donorStaticWebApp'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    staticWebAppName: donorWebAppName
    location: 'eastus2'
    environment: env
    skuOverride: 'Free' // Budget-optimised: Free tier sufficient for beta
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Static Web App: Landing Site ───────────────────────────────────────────
module landingStaticWebApp './modules/static-web-app.bicep' = {
  name: 'landingStaticWebApp'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    staticWebAppName: landingWebAppName
    location: 'eastus2'
    environment: env
    skuOverride: 'Free' // Budget-optimised: Free tier sufficient for beta
    appLocation: '/frontend/landing-site'
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── DNS Zone ───────────────────────────────────────────────────────────────
module dnsZone './modules/dns.bicep' = {
  name: 'dnsZone'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    domainName: customDomain
    tags: tags
  }
  dependsOn: [resourceGroup]
}

// ── Azure Communication Services (email) ──────────────────────────────────
module communicationServices './modules/communication.bicep' = {
  name: 'communicationServices'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: env
    emailDomain: customDomain
    tags: tags
  }
  dependsOn: [resourceGroup, dnsZone]
}

// ── Cost Budget ────────────────────────────────────────────────────────────
module budget './modules/budget.bicep' = {
  name: 'budget'
  params: {
    environment: env
    budgetAmount: monthlyBudget
    alertEmailAddresses: alertEmailAddresses
    resourceGroupName: resourceGroupName
  }
  dependsOn: [resourceGroup]
}

// ── Resource Locks (production) ────────────────────────────────────────────
module postgresLock './modules/resource-lock.bicep' = {
  name: 'postgresLock'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: env
    targetResourceName: postgresServerName
    lockNotes: 'Critical database — contains all application data'
  }
  dependsOn: [postgres]
}

module redisLock './modules/resource-lock.bicep' = {
  name: 'redisLock'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: env
    targetResourceName: redisCacheName
    lockNotes: 'Critical cache — contains session data'
  }
  dependsOn: [redis]
}

module keyVaultLock './modules/resource-lock.bicep' = {
  name: 'keyVaultLock'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: env
    targetResourceName: keyVaultName
    lockNotes: 'Critical secrets store'
  }
  dependsOn: [keyVault]
}

module storageLock './modules/resource-lock.bicep' = {
  name: 'storageLock'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    environment: env
    targetResourceName: storageAccountName
    lockNotes: 'Critical storage — media and backups'
  }
  dependsOn: [storage]
}

// ── Outputs ────────────────────────────────────────────────────────────────
output resourceGroupName string = resourceGroupName
output apiAppFqdn string = apiApp.outputs.fqdn
output adminWebAppHostname string = adminStaticWebApp.outputs.staticWebAppDefaultHostname
output donorWebAppHostname string = donorStaticWebApp.outputs.donorStaticWebAppDefaultHostname
output landingWebAppHostname string = landingStaticWebApp.outputs.staticWebAppDefaultHostname
output keyVaultUri string = keyVault.outputs.keyVaultUri
output containerAppsEnvDefaultDomain string = containerAppsEnv.outputs.envDefaultDomain
