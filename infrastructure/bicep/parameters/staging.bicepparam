// Staging environment parameters for Fundrbolt Platform
using '../main.bicep'

param environment = 'staging'
param location = 'eastus'
param appName = 'fundrbolt'

// PostgreSQL admin password (retrieve from environment variable or Key Vault)
// Usage: az deployment sub create --parameters staging.bicepparam --parameters postgresAdminPassword=$POSTGRES_PASSWORD
param postgresAdminPassword = ''

param tags = {
  Environment: 'staging'
  Project: 'fundrbolt-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'engineering'
  Owner: 'devops-team'
}

// Cost management
param monthlyBudget = 300 // $300/month for staging environment
param alertEmailAddresses = [
  'ops@fundrbolt.com'
  'devops@fundrbolt.com'
]
