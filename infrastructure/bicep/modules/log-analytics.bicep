// Log Analytics Workspace module for Fundrbolt Platform

@description('Name of the Log Analytics Workspace')
param workspaceName string

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Tags for the resource')
param tags object = {}

// Retention configuration based on environment
var retentionInDays = environment == 'production' ? 90 : 30

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = logAnalyticsWorkspace.id
output workspaceName string = logAnalyticsWorkspace.name
output workspaceCustomerId string = logAnalyticsWorkspace.properties.customerId
