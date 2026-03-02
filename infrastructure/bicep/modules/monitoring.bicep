// Application Insights module for Fundrbolt Platform

@description('Name of the Application Insights instance')
param appInsightsName string

@description('Azure region')
param location string = resourceGroup().location

@description('Environment (dev, staging, production)')
@allowed([
  'dev'
  'staging'
  'production'
])
param environment string

@description('Log Analytics Workspace ID')
param workspaceId string

@description('Tags for the resource')
param tags object = {}

@description('Backend API URL for availability tests')
param backendApiUrl string

@description('Frontend URL for availability tests')
param frontendUrl string

@description('Alert notification email addresses')
param alertEmailAddresses array = []

@description('Enable availability tests (should be false for localhost URLs)')
param enableAvailabilityTests bool = true

// Sampling configuration based on environment
var samplingPercentage = environment == 'production' ? 10 : 100

// Daily cap configuration based on environment (GB per day)
var dailyCapGB = environment == 'dev' ? 0 : environment == 'staging' ? 1 : 5

// Test locations for availability tests
var testLocations = [
  {
    Id: 'us-va-ash-azr' // East US
  }
  {
    Id: 'us-ca-sjc-azr' // West US
  }
  {
    Id: 'emea-nl-ams-azr' // North Europe
  }
]

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspaceId
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    SamplingPercentage: samplingPercentage
    IngestionMode: 'LogAnalytics'
    DisableIpMasking: false
    Request_Source: 'rest'
  }
}

// Configure daily cap (if specified)
resource dailyCap 'Microsoft.Insights/components/pricingPlans@2017-10-01' = if (dailyCapGB > 0) {
  parent: appInsights
  name: 'current'
  properties: {
    cap: dailyCapGB
    stopSendNotificationWhenHitCap: false
  }
}

// Action Group for alert notifications
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (length(alertEmailAddresses) > 0) {
  name: '${appInsightsName}-alerts'
  location: 'Global'
  tags: tags
  properties: {
    groupShortName: substring('${environment}-alert', 0, min(length('${environment}-alert'), 12))
    enabled: true
    emailReceivers: [
      for (email, i) in alertEmailAddresses: {
        name: 'Email${i}'
        emailAddress: email
        useCommonAlertSchema: true
      }
    ]
  }
}

// Availability Test - Backend Health Endpoint
resource backendAvailabilityTest 'Microsoft.Insights/webtests@2022-06-15' = if (enableAvailabilityTests) {
  name: '${appInsightsName}-backend-health'
  location: location
  tags: union(tags, {
    'hidden-link:${appInsights.id}': 'Resource'
  })
  properties: {
    SyntheticMonitorId: '${appInsightsName}-backend-health'
    Name: 'Backend Health Check'
    Enabled: true
    Frequency: 300 // 5 minutes
    Timeout: 30
    Kind: 'ping'
    Locations: testLocations
    Configuration: {
      WebTest: '<WebTest Name="Backend Health" Id="${guid(appInsightsName, 'backend')}" Enabled="True" Timeout="30" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Items><Request Method="GET" Guid="${guid(backendApiUrl)}" Version="1.1" Url="${backendApiUrl}/health" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" /></Items></WebTest>'
    }
  }
}

// Availability Test - Frontend Homepage
resource frontendAvailabilityTest 'Microsoft.Insights/webtests@2022-06-15' = if (enableAvailabilityTests) {
  name: '${appInsightsName}-frontend-home'
  location: location
  tags: union(tags, {
    'hidden-link:${appInsights.id}': 'Resource'
  })
  properties: {
    SyntheticMonitorId: '${appInsightsName}-frontend-home'
    Name: 'Frontend Homepage Check'
    Enabled: true
    Frequency: 300 // 5 minutes
    Timeout: 30
    Kind: 'ping'
    Locations: testLocations
    Configuration: {
      WebTest: '<WebTest Name="Frontend Homepage" Id="${guid(appInsightsName, 'frontend')}" Enabled="True" Timeout="30" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Items><Request Method="GET" Guid="${guid(frontendUrl)}" Version="1.1" Url="${frontendUrl}" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" /></Items></WebTest>'
    }
  }
}

// Alert - Backend Availability Failure
resource backendAvailabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (enableAvailabilityTests && length(alertEmailAddresses) > 0) {
  name: '${appInsightsName}-backend-availability'
  location: 'Global'
  tags: tags
  properties: {
    description: 'Backend health endpoint is failing'
    severity: 1 // Critical
    enabled: true
    scopes: [
      appInsights.id
      backendAvailabilityTest.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: backendAvailabilityTest.id
      componentId: appInsights.id
      failedLocationCount: 2
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert Rule - Frontend Availability
resource frontendAvailabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (enableAvailabilityTests && length(alertEmailAddresses) > 0) {
  name: '${appInsightsName}-frontend-availability'
  location: 'Global'
  tags: tags
  properties: {
    description: 'Frontend homepage is failing'
    severity: 1 // Critical
    enabled: true
    scopes: [
      appInsights.id
      frontendAvailabilityTest.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: frontendAvailabilityTest.id
      componentId: appInsights.id
      failedLocationCount: 2
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert Rule - High Error Rate
resource highErrorRateAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = if (length(alertEmailAddresses) > 0) {
  name: '${appInsightsName}-high-error-rate'
  location: location
  tags: tags
  properties: {
    description: 'Error rate exceeded 5% for 5 minutes'
    severity: 1 // Critical
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      appInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: 'requests | where success == false | summarize errorCount = count() by bin(timestamp, 1m) | extend totalRequests = toscalar(requests | summarize count() by bin(timestamp, 1m) | summarize sum(count_)) | extend errorRate = (errorCount * 100.0) / totalRequests | where errorRate > 5'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 5
            minFailingPeriodsToAlert: 5
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroup.id
      ]
    }
  }
}

// Alert Rule - High Latency (P95)
resource highLatencyAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = if (length(alertEmailAddresses) > 0) {
  name: '${appInsightsName}-high-latency'
  location: location
  tags: tags
  properties: {
    description: 'P95 latency exceeded 500ms for 5 minutes'
    severity: 1 // Critical
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      appInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: 'requests | summarize p95 = percentile(duration, 95) by bin(timestamp, 1m) | where p95 > 500'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 5
            minFailingPeriodsToAlert: 5
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroup.id
      ]
    }
  }
}

output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output actionGroupId string = length(alertEmailAddresses) > 0 ? actionGroup.id : ''
output backendAvailabilityTestId string = enableAvailabilityTests ? backendAvailabilityTest.id : ''
output frontendAvailabilityTestId string = enableAvailabilityTests ? frontendAvailabilityTest.id : ''
