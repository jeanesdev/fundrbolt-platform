// Production Beta deployment parameters for FundrBolt Platform
// Usage:
//   az deployment sub create \
//     --location eastus \
//     --template-file infrastructure/bicep/main-beta.bicep \
//     --parameters infrastructure/bicep/parameters/production-beta.bicepparam
using '../main-beta.bicep'

param location = 'eastus'

param appName = 'fundrbolt'

// Container image — updated automatically by backend-deploy.yml CI/CD workflow
// Override at deploy time: --parameters backendImage='ghcr.io/jeanesdev/fundrbolt-backend:sha-abc123'
param backendImage = 'ghcr.io/jeanesdev/fundrbolt-backend:latest'

// Set via --parameters postgresAdminPassword='...' at deploy time
// Never store passwords in this file
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD', '')

param customDomain = 'fundrbolt.com'

param monthlyBudget = 50

param alertEmailAddresses = [
  'ops@fundrbolt.com'
]

param tags = {
  Environment: 'production'
  Project: 'fundrbolt-platform'
  Owner: 'ops@fundrbolt.com'
  ManagedBy: 'Bicep'
  CostCenter: 'operations'
}
