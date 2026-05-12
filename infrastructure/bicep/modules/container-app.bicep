// Reusable Container App module for FundrBolt Platform
// Used for: api (external ingress), worker (no ingress), beat (no ingress, singleton)

@description('Name of the Container App')
param appName string

@description('Azure region')
param location string = resourceGroup().location

@description('Resource ID of the Container Apps Environment')
param containerAppsEnvId string

@description('Full container image reference including tag')
param image string

@description('Command override for the container (determines api / worker / beat role)')
param command array = []

@description('Minimum replicas — set 0 for scale-to-zero, 1 for singleton (beat)')
@minValue(0)
@maxValue(10)
param minReplicas int = 0

@description('Maximum replicas')
@minValue(1)
@maxValue(10)
param maxReplicas int = 3

@description('CPU cores allocated to each replica')
param cpu string = '0.5'

@description('Memory allocated to each replica')
param memory string = '1Gi'

@description('Whether to expose an external HTTPS ingress for this app (api only)')
param externalIngress bool = false

@description('Container port (only relevant when externalIngress=true)')
param targetPort int = 8000

@description('Enable sticky session affinity (needed for Socket.IO)')
param stickySessionsEnabled bool = false

@description('Environment variables (plain-text values)')
param envVars array = []

@description('Secret environment variables sourced from Key Vault references')
param secretEnvVars array = []

@description('Tags for the resource')
param tags object = {}

// Build the secrets array (Key Vault references become Container App secrets)
// Each item in secretEnvVars must have: { name, keyVaultUrl }
var secrets = [for secret in secretEnvVars: {
  name: secret.name
  keyVaultUrl: secret.keyVaultUrl
  identity: 'system'
}]

// Map secret names to env var bindings
var secretEnvBindings = [for secret in secretEnvVars: {
  name: secret.envName
  secretRef: secret.name
}]

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: secrets
      ingress: externalIngress ? {
        external: true
        targetPort: targetPort
        transport: 'http'
        allowInsecure: false
        stickySessions: stickySessionsEnabled ? {
          affinity: 'sticky'
        } : null
        corsPolicy: null
      } : null
    }
    template: {
      containers: [
        {
          name: appName
          image: image
          command: length(command) > 0 ? command : null
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: concat(envVars, secretEnvBindings)
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: externalIngress ? [
          {
            name: 'http-scaler'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ] : []
      }
    }
  }
}

output appId string = containerApp.id
output appName string = containerApp.name
output principalId string = containerApp.identity.principalId
output fqdn string = externalIngress ? containerApp.properties.configuration.ingress.fqdn : ''
output latestRevisionName string = containerApp.properties.latestRevisionName
