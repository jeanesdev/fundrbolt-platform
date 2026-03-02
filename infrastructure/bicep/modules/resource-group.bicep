// Resource Group module for Fundrbolt Platform
targetScope = 'subscription'

@description('Name of the resource group')
param resourceGroupName string

@description('Azure region')
param location string

@description('Tags to apply to the resource group')
param tags object = {}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

output resourceGroupName string = resourceGroup.name
output resourceGroupId string = resourceGroup.id
output location string = resourceGroup.location
