// Container Apps Environment for FundrBolt Platform
// Provides the shared network boundary and Log Analytics integration
// for all Container Apps (api, worker, beat).

@description('Name of the Container Apps Environment')
param envName string

@description('Azure region')
param location string = resourceGroup().location

@description('Log Analytics workspace client ID (customerId)')
param logAnalyticsWorkspaceClientId string

@description('Log Analytics workspace shared key')
@secure()
param logAnalyticsWorkspaceKey string

@description('Tags for the resource')
param tags object = {}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspaceClientId
        sharedKey: logAnalyticsWorkspaceKey
      }
    }
    zoneRedundant: false // Single-zone for cost at beta scale
    workloadProfiles: [
      {
        // Consumption profile: pay-per-use, scales to zero
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

output envId string = containerAppsEnv.id
output envName string = containerAppsEnv.name
output envDefaultDomain string = containerAppsEnv.properties.defaultDomain
output envStaticIp string = containerAppsEnv.properties.staticIp
