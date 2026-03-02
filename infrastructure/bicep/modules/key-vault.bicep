// Azure Key Vault module for Fundrbolt Platform

@description('Name of the Key Vault')
param keyVaultName string

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Azure AD Tenant ID')
param tenantId string = subscription().tenantId

@description('App Service principal ID for Key Vault access')
param appServicePrincipalId string = ''

@description('Tags for the resource')
param tags object = {}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenantId
    enableRbacAuthorization: true // Use RBAC instead of access policies
    enableSoftDelete: true // Always enable soft delete
    softDeleteRetentionInDays: 90
    // Only set purgeProtection for production (omit property for dev/staging)
    enablePurgeProtection: environment == 'production' ? true : null
    publicNetworkAccess: 'Enabled' // TODO: Change to 'Disabled' when VNet integration is ready
    networkAcls: {
      defaultAction: 'Allow' // TODO: Change to 'Deny' when VNet integration is ready
      bypass: 'AzureServices'
    }
  }
}

// Grant App Service managed identity access to secrets (only if appServicePrincipalId is provided)
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(appServicePrincipalId)) {
  name: guid(keyVault.id, appServicePrincipalId, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
