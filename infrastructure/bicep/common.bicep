// Common parameter definitions and types for Fundrbolt Platform infrastructure

@description('Environment name (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Common tags to apply to all resources')
param tags object = {
  Environment: environment
  Project: 'Fundrbolt'
  ManagedBy: 'Bicep'
}

@description('Naming prefix for resources')
param resourcePrefix string = 'fundrbolt'

// Output common values
output environment string = environment
output location string = location
output tags object = tags
output resourcePrefix string = resourcePrefix
