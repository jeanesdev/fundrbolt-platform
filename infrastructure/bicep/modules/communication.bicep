// Azure Communication Services Module
// Provides email sending capabilities with custom domain support

@description('Environment name')
param environment string

@description('Custom domain for email (e.g., fundrbolt.com)')
param emailDomain string

@description('Resource tags')
param tags object = {}

// Communication Services Resource
resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: 'fundrbolt-${environment}-acs'
  location: 'global' // ACS is a global service
  tags: tags
  properties: {
    dataLocation: 'United States' // Data residency
  }
}

// Email Services Resource
resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: 'fundrbolt-${environment}-email'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

// Email Domain Configuration
// Note: Custom domain must be verified before it can be used
// This creates the domain resource but verification happens via DNS
resource emailDomainConfig 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (environment == 'production') {
  parent: emailService
  name: emailDomain
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Enabled' // Track opens and clicks
  }
}

// For non-production, use Azure-provided domain
resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = if (environment != 'production') {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Enabled'
  }
}

// Link Email Service to Communication Service
resource emailServiceLink 'Microsoft.Communication/communicationServices/domains@2023-04-01' = {
  parent: communicationService
  name: environment == 'production' ? emailDomain : 'AzureManagedDomain'
  properties: {
    domainResourceId: environment == 'production' ? emailDomainConfig.id : azureManagedDomain.id
  }
}

// Sender addresses configuration
var senderAddresses = [
  {
    address: 'noreply@${emailDomain}'
    displayName: 'Fundrbolt Platform'
  }
  {
    address: 'support@${emailDomain}'
    displayName: 'Fundrbolt Support'
  }
  {
    address: 'billing@${emailDomain}'
    displayName: 'Fundrbolt Billing'
  }
  {
    address: 'notifications@${emailDomain}'
    displayName: 'Fundrbolt Notifications'
  }
]

// Outputs
output communicationServiceId string = communicationService.id
output communicationServiceName string = communicationService.name
output communicationServiceEndpoint string = communicationService.properties.hostName
output communicationServiceConnectionString string = communicationService.listKeys().primaryConnectionString

output emailServiceId string = emailService.id
output emailServiceName string = emailService.name

output emailDomainId string = environment == 'production' ? emailDomainConfig.id : azureManagedDomain.id
output emailDomainName string = environment == 'production' ? emailDomain : azureManagedDomain.name
output emailDomainStatus string = environment == 'production'
  ? emailDomainConfig.properties.verificationStates.Domain.status
  : 'Verified'

// DNS records required for custom domain verification and authentication
output dnsRecordsRequired object = environment == 'production'
  ? {
      verification: {
        type: 'TXT'
        name: '@'
        value: emailDomainConfig.properties.verificationStates.Domain.verificationToken
        ttl: 3600
      }
      spf: {
        type: 'TXT'
        name: '@'
        value: 'v=spf1 include:spf.protection.outlook.com include:spf.azurecomm.net ~all'
        ttl: 3600
      }
      dmarc: {
        type: 'TXT'
        name: '_dmarc'
        value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@${emailDomain}; pct=100; fo=1'
        ttl: 3600
      }
      dkim1: {
        type: 'CNAME'
        name: 'selector1-azurecomm-prod-net._domainkey'
        value: emailDomainConfig.properties.verificationStates.DKIM.domainKey1
        ttl: 3600
      }
      dkim2: {
        type: 'CNAME'
        name: 'selector2-azurecomm-prod-net._domainkey'
        value: emailDomainConfig.properties.verificationStates.DKIM.domainKey2
        ttl: 3600
      }
    }
  : {}

output senderAddresses array = senderAddresses

output configurationInstructions string = environment == 'production'
  ? '''
Azure Communication Services Email Domain Configuration:

1. Add DNS Records (required for verification and authentication):
   - TXT @ : ${emailDomainConfig.properties.verificationStates.Domain.verificationToken}
   - TXT @ : v=spf1 include:spf.azurecomm.net ~all
   - TXT _dmarc : v=DMARC1; p=quarantine; rua=mailto:dmarc@${emailDomain}
   - CNAME selector1-azurecomm-prod-net._domainkey : ${emailDomainConfig.properties.verificationStates.DKIM.domainKey1}
   - CNAME selector2-azurecomm-prod-net._domainkey : ${emailDomainConfig.properties.verificationStates.DKIM.domainKey2}

2. Wait 15-30 minutes for DNS propagation

3. Verify domain in Azure Portal:
   Navigate to Email Services → Domains → Verify

4. Test email delivery:
   Send test email from noreply@${emailDomain}
   Check mail-tester.com for authentication score

5. Configure sender addresses in application
'''
  : 'Using Azure-managed domain for non-production environment'
