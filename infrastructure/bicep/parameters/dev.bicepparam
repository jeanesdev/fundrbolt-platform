// Development environment parameters for Fundrbolt Platform
using '../main.bicep'

param environment = 'dev'
param location = 'eastus'
param appName = 'fundrbolt'

// PostgreSQL admin password (retrieve from environment variable or Key Vault)
// Usage: az deployment sub create --parameters dev.bicepparam --parameters postgresAdminPassword=$POSTGRES_PASSWORD
param postgresAdminPassword = ''

param tags = {
  Environment: 'dev'
  Project: 'fundrbolt-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'engineering'
  Owner: 'devops-team'
}

// Cost management
param monthlyBudget = 100 // $100/month for dev environment
param alertEmailAddresses = [
  'devops@fundrbolt.com'
]
