// DNS Zone Module
// Creates Azure DNS Zone for custom domain management

@description('Custom domain name (e.g., augeo.app)')
param domainName string

@description('Resource tags')
param tags object = {}

// DNS Zone Resource
resource dnsZone 'Microsoft.Network/dnsZones@2023-07-01-preview' = {
  name: domainName
  location: 'global'
  tags: tags
  properties: {
    zoneType: 'Public'
  }
}

// Note: A records, CNAME records, and MX records will be added when
// App Service and Static Web App are deployed. For minimal deployment,
// we only create the DNS zone itself.

// Outputs
output dnsZoneId string = dnsZone.id
output dnsZoneName string = dnsZone.name
output nameServers array = dnsZone.properties.nameServers
output dnsZoneResourceGroup string = resourceGroup().name

// Output instructions for nameserver configuration
output nameServerInstructions string = '''
Configure these nameservers at your domain registrar:
${join(dnsZone.properties.nameServers, '\n')}

After configuring, DNS propagation may take 24-48 hours.
Verify with: dig NS ${domainName}
'''
