// PostgreSQL Flexible Server module for Fundrbolt Platform

@description('Name of the PostgreSQL server')
param postgresServerName string

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Administrator username')
param administratorLogin string = 'fundrbolt_admin'

@description('Administrator password')
@secure()
param administratorPassword string

@description('Tags for the resource')
param tags object = {}

// SKU configuration based on environment
var skuConfigs = {
  dev: {
    tier: 'Burstable'
    name: 'Standard_B1ms'
    storageSizeGB: 32
    backupRetentionDays: 7
    geoRedundantBackup: false
    highAvailability: false
  }
  staging: {
    tier: 'GeneralPurpose'
    name: 'Standard_D2s_v3'
    storageSizeGB: 128
    backupRetentionDays: 7
    geoRedundantBackup: false
    highAvailability: false
  }
  production: {
    tier: 'GeneralPurpose'
    name: 'Standard_D2s_v3'
    storageSizeGB: 128
    backupRetentionDays: 30
    geoRedundantBackup: true
    highAvailability: true
  }
}

var config = skuConfigs[environment]

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: {
    name: config.name
    tier: config.tier
  }
  properties: {
    version: '15'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: config.storageSizeGB
    }
    backup: {
      backupRetentionDays: config.backupRetentionDays
      geoRedundantBackup: config.geoRedundantBackup ? 'Enabled' : 'Disabled'
    }
    highAvailability: config.highAvailability ? {
      mode: 'ZoneRedundant'
    } : {
      mode: 'Disabled'
    }
  }
}

// Create default database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgresServer
  name: 'fundrbolt'
}

// Firewall rule to allow Azure services
// Note (Phase 9 - T153): In production with VNet integration, this should be removed
// and replaced with private endpoint or VNet service endpoint
// For now, we allow Azure services to access the database
resource firewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output postgresServerId string = postgresServer.id
output postgresServerName string = postgresServer.name
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = postgresDatabase.name
