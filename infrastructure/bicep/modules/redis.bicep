// Azure Cache for Redis module for Fundrbolt Platform

@description('Name of the Redis cache')
param redisCacheName string

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

// SKU configuration based on environment
var skuConfigs = {
  dev: {
    name: 'Basic'
    family: 'C'
    capacity: 0 // C0 = 250 MB
  }
  staging: {
    name: 'Standard'
    family: 'C'
    capacity: 1 // C1 = 1 GB
  }
  production: {
    name: 'Standard'
    family: 'C'
    capacity: 1 // C1 = 1 GB
  }
}

var config = skuConfigs[environment]

resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisCacheName
  location: location
  tags: tags
  properties: {
    sku: {
      name: config.name
      family: config.family
      capacity: config.capacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled' // Note (Phase 9 - T154): Change to 'Disabled' with VNet integration or private endpoint
    redisConfiguration: environment == 'production' ? {
      'maxmemory-policy': 'allkeys-lru'
      'aof-backup-enabled': 'true' // AOF persistence for production
    } : {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

output redisCacheId string = redisCache.id
output redisCacheName string = redisCache.name
output redisCacheHostname string = redisCache.properties.hostName
output redisCachePort int = redisCache.properties.sslPort
