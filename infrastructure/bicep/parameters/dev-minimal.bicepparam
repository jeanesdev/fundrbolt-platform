// Minimal development environment parameters
using '../main-minimal.bicep'

param environment = 'dev'
param location = 'eastus'
param appName = 'fundrbolt'
param customDomain = 'fundrbolt.com'
param enableDns = true

param tags = {
  Environment: 'dev'
  Project: 'fundrbolt-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'development'
  Owner: 'devops-team'
  Purpose: 'local-development-with-dns'
}
