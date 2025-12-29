// Production environment parameters for Fundrbolt Platform
using '../main.bicep'

param environment = 'production'
param location = 'eastus'
param appName = 'fundrbolt'

// PostgreSQL admin password (retrieve from environment variable or Key Vault)
// Usage: az deployment sub create --parameters production.bicepparam --parameters postgresAdminPassword=$POSTGRES_PASSWORD
param postgresAdminPassword = ''

// Custom domain configuration (Phase 5)
param customDomain = 'fundrbolt.com'
param enableCustomDomain = true

// Alert notification emails (Phase 8)
param alertEmailAddresses = [
  'ops@fundrbolt.com'
  'engineering@fundrbolt.com'
]

param tags = {
  Environment: 'production'
  Project: 'fundrbolt-platform'
  ManagedBy: 'Bicep'
  CostCenter: 'operations'
  Compliance: 'required'
  Owner: 'platform-team'
}

// Cost management (Phase 9)
param monthlyBudget = 1000 // $1000/month for production environment
