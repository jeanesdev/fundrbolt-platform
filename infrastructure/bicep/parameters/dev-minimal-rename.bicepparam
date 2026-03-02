// Minimal deployment parameters for Fundrbolt rename (dev environment)
using '../main-minimal-rename.bicep'

param environment = 'dev'
param location = 'eastus'
param appName = 'fundrbolt'

param tags = {
  Environment: 'dev'
  Project: 'fundrbolt-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'engineering'
  Owner: 'devops-team'
}

param alertEmailAddresses = [
  'devops@fundrbolt.app'
]
