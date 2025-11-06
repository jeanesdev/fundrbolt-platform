// Development-only minimal infrastructure deployment
// This deploys only free/minimal-cost resources for local development
targetScope = 'subscription'

@description('Environment name')
param environment string = 'dev'

@description('Azure region')
param location string = 'eastus'

@description('Application name prefix')
param appName string = 'augeo'

@description('Custom domain name for DNS zone')
param customDomain string = 'augeo.app'

@description('Enable DNS zone deployment')
param enableDns bool = true

@description('Tags for all resources')
param tags object = {
  Environment: environment
  Project: 'augeo-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'development'
  Owner: 'devops-team'
}

// Naming convention
var resourceGroupName = '${appName}-${environment}-rg'
var keyVaultName = '${appName}-${environment}-kv'
var logAnalyticsName = '${appName}-${environment}-logs'
var appInsightsName = '${appName}-${environment}-insights'
var storageAccountName = replace('${appName}${environment}st', '-', '')

// Deploy Resource Group
module resourceGroup './modules/resource-group.bicep' = {
  name: 'resourceGroup-${environment}'
  params: {
    resourceGroupName: resourceGroupName
    location: location
    tags: tags
  }
}

// Deploy Log Analytics Workspace (5GB/month free)
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

// Deploy Application Insights (5GB/month free)
module appInsights './modules/monitoring.bicep' = {
  name: 'appInsights-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    appInsightsName: appInsightsName
    location: location
    environment: environment
    workspaceId: logAnalytics.outputs.workspaceId
    backendApiUrl: 'http://localhost:8000'
    frontendUrl: 'http://localhost:5173'
    alertEmailAddresses: []
    enableAvailabilityTests: false // Skip availability tests for localhost URLs
    tags: tags
  }
}

// Deploy Key Vault (minimal cost: ~$0.03 per 10k operations)
module keyVault './modules/key-vault.bicep' = {
  name: 'keyVault-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    keyVaultName: keyVaultName
    location: location
    environment: environment
    appServicePrincipalId: '' // No App Service in minimal deployment
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Deploy Storage Account (first 5GB ~$0.10/month)
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

// Deploy DNS Zone (optional, ~$0.50/month + $0.40 per million queries)
module dns './modules/dns.bicep' = if (enableDns) {
  name: 'dns-${environment}'
  scope: az.resourceGroup(resourceGroupName)
  params: {
    domainName: customDomain
    tags: tags
  }
  dependsOn: [
    resourceGroup
  ]
}

// Outputs
output resourceGroupName string = resourceGroup.outputs.resourceGroupName
output resourceGroupId string = resourceGroup.outputs.resourceGroupId
output location string = location
output environment string = environment

// Key Vault outputs
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri

// Monitoring outputs
output appInsightsName string = appInsights.outputs.appInsightsName
output appInsightsConnectionString string = appInsights.outputs.appInsightsConnectionString
output appInsightsInstrumentationKey string = appInsights.outputs.appInsightsInstrumentationKey

// Storage outputs
output storageAccountName string = storage.outputs.storageAccountName

// DNS outputs (if enabled)
output dnsZoneId string = enableDns ? dns.outputs.dnsZoneId : ''
output dnsZoneName string = enableDns ? dns.outputs.dnsZoneName : ''
output nameServers array = enableDns ? dns.outputs.nameServers : []

output instructions string = enableDns ? '''
Minimal Development Resources Deployed (with DNS)!

DNS Nameservers (configure at Namecheap):
${join(dns.outputs.nameServers, '\n')}

Next Steps:
1. Configure nameservers at Namecheap:
   - Login to Namecheap account
   - Go to Domain List → Manage augeo.app
   - Find NAMESERVERS section → Select Custom DNS
   - Add all 4 Azure nameservers listed above
   - Save (propagation takes 24-48 hours)

2. Store secrets in Key Vault:
   make configure-secrets ENV=dev

3. Start local services (PostgreSQL + Redis):
   docker-compose up -d

4. Run backend locally:
   make dev-backend

5. Run frontend locally (in another terminal):
   make dev-frontend

6. Verify DNS propagation:
   dig NS augeo.app

Cost: ~$1.50/month (DNS $0.50 + storage $0.10 + Key Vault operations ~$0.03)
''' : '''
Minimal Development Resources Deployed!

Next Steps:
1. Store secrets in Key Vault:
   make configure-secrets ENV=dev

2. Start local services (PostgreSQL + Redis):
   docker-compose up -d

3. Run backend locally:
   make dev-backend

4. Run frontend locally (in another terminal):
   make dev-frontend

5. Access Application Insights connection string:
   az monitor app-insights component show --app ${appInsightsName} --resource-group ${resourceGroupName} --query connectionString -o tsv

Note: This deployment costs less than $1/month (mostly storage and Key Vault operations)
'''
