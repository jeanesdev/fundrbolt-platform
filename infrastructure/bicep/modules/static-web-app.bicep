// Static Web App module for FundrBolt Platform

@description('Name of the Static Web App')
param staticWebAppName string

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

@description('GitHub repository URL')
param repositoryUrl string = 'https://github.com/jeanesdev/fundrbolt-platform'

@description('GitHub branch')
param branch string = 'main'

@description('App source location within the repository (relative path)')
param appLocation string = '/frontend/fundrbolt-admin'

@description('SKU override. When empty, uses environment-based default (Standard for production, Free otherwise). Use Free for cost-constrained beta environments.')
param skuOverride string = ''

// SKU configuration based on environment (can be overridden)
var skuConfig = !empty(skuOverride) ? skuOverride : (environment == 'production' ? 'Standard' : 'Free')

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: skuConfig
    tier: skuConfig
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    buildProperties: {
      appLocation: appLocation
      apiLocation: '' // API hosted separately in App Service
      outputLocation: 'dist'
    }
  }
}

output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
