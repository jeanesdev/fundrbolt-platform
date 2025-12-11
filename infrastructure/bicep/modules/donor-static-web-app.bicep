// Static Web App module for Donor PWA

@description('Name of the Donor Static Web App')
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
param repositoryUrl string = 'https://github.com/jeanesdev/augeo-platform'

@description('GitHub branch')
param branch string = 'main'

// SKU configuration based on environment
var skuConfig = environment == 'production' ? 'Standard' : 'Free'

resource donorStaticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
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
      appLocation: '/frontend/donor-pwa'
      apiLocation: '' // API hosted separately in App Service
      outputLocation: 'dist'
    }
  }
}

output donorStaticWebAppId string = donorStaticWebApp.id
output donorStaticWebAppName string = donorStaticWebApp.name
output donorStaticWebAppDefaultHostname string = donorStaticWebApp.properties.defaultHostname
