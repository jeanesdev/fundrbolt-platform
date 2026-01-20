// Azure CDN Profile and Endpoint for Fundrbolt Branding Assets
// Provides fast, global delivery of logos for email templates and public assets

@description('Name of the CDN Profile')
param cdnProfileName string

@description('Name of the CDN Endpoint')
param cdnEndpointName string

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Storage account name for origin')
param storageAccountName string

@description('Blob container name for branding assets')
param brandingContainerName string = 'branding'

@description('Tags for the resource')
param tags object = {}

// CDN SKU based on environment
var cdnSkuName = environment == 'production' ? 'Standard_Microsoft' : 'Standard_Microsoft'

// CDN Profile
resource cdnProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: cdnProfileName
  location: 'global' // CDN profiles are global resources
  tags: tags
  sku: {
    name: cdnSkuName
  }
  properties: {}
}

// CDN Endpoint
resource cdnEndpoint 'Microsoft.Cdn/profiles/endpoints@2023-05-01' = {
  parent: cdnProfile
  name: cdnEndpointName
  location: 'global'
  tags: tags
  properties: {
    originHostHeader: '${storageAccountName}.blob.core.windows.net'
    origins: [
      {
        name: 'storage-origin'
        properties: {
          hostName: '${storageAccountName}.blob.core.windows.net'
          httpPort: 80
          httpsPort: 443
          priority: 1
          weight: 1000
          enabled: true
        }
      }
    ]
    contentTypesToCompress: [
      'text/plain'
      'text/html'
      'text/css'
      'application/javascript'
      'image/svg+xml'
    ]
    isCompressionEnabled: true
    isHttpAllowed: false // Enforce HTTPS only
    isHttpsAllowed: true
    queryStringCachingBehavior: 'IgnoreQueryString'
    optimizationType: 'GeneralWebDelivery'
    deliveryPolicy: {
      rules: [
        {
          name: 'BrandingAssetsCaching'
          order: 1
          conditions: [
            {
              name: 'UrlPath'
              parameters: {
                '@odata.type': '#Microsoft.Azure.Cdn.Models.DeliveryRuleUrlPathMatchConditionParameters'
                operator: 'BeginsWith'
                matchValues: [
                  '/${brandingContainerName}/'
                ]
                negateCondition: false
                transforms: []
              }
            }
          ]
          actions: [
            {
              name: 'CacheExpiration'
              parameters: {
                '@odata.type': '#Microsoft.Azure.Cdn.Models.DeliveryRuleCacheExpirationActionParameters'
                cacheBehavior: 'SetIfMissing'
                cacheType: 'All'
                cacheDuration: '365.00:00:00' // Cache for 1 year (logos rarely change)
              }
            }
            {
              name: 'ModifyResponseHeader'
              parameters: {
                '@odata.type': '#Microsoft.Azure.Cdn.Models.DeliveryRuleHeaderActionParameters'
                headerAction: 'Append'
                headerName: 'Cache-Control'
                value: 'public, max-age=31536000, immutable'
              }
            }
          ]
        }
      ]
    }
  }
}

output cdnProfileId string = cdnProfile.id
output cdnProfileName string = cdnProfile.name
output cdnEndpointId string = cdnEndpoint.id
output cdnEndpointName string = cdnEndpoint.name
output cdnEndpointHostName string = cdnEndpoint.properties.hostName
output cdnBrandingUrl string = 'https://${cdnEndpoint.properties.hostName}/${brandingContainerName}'
