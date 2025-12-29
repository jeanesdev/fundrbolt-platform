// App Service Plan module for Fundrbolt Platform

@description('Name of the App Service Plan')
param appServicePlanName string

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
    tier: 'Basic'
    name: 'B1'
    capacity: 1
  }
  staging: {
    tier: 'Standard'
    name: 'S1'
    capacity: 1
  }
  production: {
    tier: 'Standard'
    name: 'S1'
    capacity: 2 // Initial capacity, autoscale configured separately
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: skuConfigs[environment]
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux
    perSiteScaling: false
  }
}

// Auto-scaling configuration (Phase 9)
var autoScaleConfigs = {
  dev: {
    enabled: false
    minCapacity: 1
    maxCapacity: 2
  }
  staging: {
    enabled: true
    minCapacity: 1
    maxCapacity: 5
  }
  production: {
    enabled: true
    minCapacity: 2
    maxCapacity: 10
  }
}

resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (autoScaleConfigs[environment].enabled) {
  name: '${appServicePlanName}-autoscale'
  location: location
  tags: tags
  properties: {
    enabled: true
    targetResourceUri: appServicePlan.id
    profiles: [
      {
        name: 'Auto-scale based on CPU'
        capacity: {
          minimum: string(autoScaleConfigs[environment].minCapacity)
          maximum: string(autoScaleConfigs[environment].maxCapacity)
          default: string(autoScaleConfigs[environment].minCapacity)
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 30
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
    notifications: []
  }
}

output appServicePlanId string = appServicePlan.id
output appServicePlanName string = appServicePlan.name
output appServicePlanSku string = appServicePlan.sku.name
output autoScaleEnabled bool = autoScaleConfigs[environment].enabled
output autoScaleMinCapacity int = autoScaleConfigs[environment].minCapacity
output autoScaleMaxCapacity int = autoScaleConfigs[environment].maxCapacity
