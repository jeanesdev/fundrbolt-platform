// Key Vault RBAC module — grants Key Vault Secrets User to container app identities.
// Must be deployed at resource-group scope (called as a module from main-beta.bicep).

@description('Name of the Key Vault to scope role assignments to')
param keyVaultName string

@description('Principal ID of the API container app managed identity')
param apiPrincipalId string

@description('Principal ID of the Worker container app managed identity')
param workerPrincipalId string

@description('Principal ID of the Beat container app managed identity')
param beatPrincipalId string

// Key Vault Secrets User built-in role definition ID
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource keyVaultResource 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource apiKvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultResource.id, apiPrincipalId, kvSecretsUserRoleId)
  scope: keyVaultResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource workerKvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultResource.id, workerPrincipalId, kvSecretsUserRoleId)
  scope: keyVaultResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: workerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource beatKvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultResource.id, beatPrincipalId, kvSecretsUserRoleId)
  scope: keyVaultResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: beatPrincipalId
    principalType: 'ServicePrincipal'
  }
}
