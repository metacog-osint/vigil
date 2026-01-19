/**
 * API Playground Preview
 *
 * Interactive demo of Vigil API for users without API access.
 * Shows sample requests/responses to demonstrate value.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { TierBadge } from './TierBadge'

const SAMPLE_ENDPOINTS = [
  {
    id: 'actors',
    method: 'GET',
    path: '/api/v1/actors',
    description: 'List threat actors with filters',
    params: [
      { name: 'limit', value: '10', description: 'Results per page' },
      { name: 'trend_status', value: 'ESCALATING', description: 'Filter by trend' },
    ],
    sampleResponse: {
      data: [
        {
          id: 'ta-001',
          name: 'LockBit',
          type: 'ransomware',
          trend_status: 'ESCALATING',
          incidents_7d: 23,
          incidents_30d: 87,
          target_sectors: ['healthcare', 'finance', 'manufacturing'],
          iocs: '████████ [Upgrade for IOC data]',
        },
        {
          id: 'ta-002',
          name: 'BlackCat',
          type: 'ransomware',
          trend_status: 'ESCALATING',
          incidents_7d: 18,
          incidents_30d: 64,
          target_sectors: ['retail', 'healthcare'],
          iocs: '████████ [Upgrade for IOC data]',
        },
      ],
      meta: {
        total: 247,
        page: 1,
        limit: 10,
      },
    },
  },
  {
    id: 'actor-detail',
    method: 'GET',
    path: '/api/v1/actors/:id',
    description: 'Get threat actor details',
    params: [
      { name: 'id', value: 'lockbit', description: 'Actor ID or name' },
    ],
    sampleResponse: {
      id: 'ta-001',
      name: 'LockBit',
      aliases: ['LockBit 3.0', 'LockBit Black'],
      type: 'ransomware',
      description: 'Ransomware-as-a-Service (RaaS) operation active since 2019...',
      trend_status: 'ESCALATING',
      first_seen: '2019-09-01',
      last_seen: '2026-01-18',
      incidents_7d: 23,
      incidents_30d: 87,
      target_sectors: ['healthcare', 'finance', 'manufacturing', 'government'],
      target_countries: ['US', 'GB', 'DE', 'FR', 'CA'],
      ttps: ['T1486', 'T1490', 'T1027', '████ [Upgrade]'],
      iocs: '████████████████ [Upgrade for full IOC list]',
      correlations: '████████ [Upgrade for correlations]',
    },
  },
  {
    id: 'iocs',
    method: 'GET',
    path: '/api/v1/iocs',
    description: 'Search IOC database',
    params: [
      { name: 'type', value: 'ip', description: 'IOC type filter' },
      { name: 'actor', value: 'lockbit', description: 'Associated actor' },
    ],
    sampleResponse: {
      data: [
        {
          value: '192.168.███.███',
          type: 'ip',
          confidence: 'high',
          actor: 'LockBit',
          first_seen: '2026-01-15',
          tags: ['c2', 'ransomware'],
        },
        {
          value: 'malicious-███████.com',
          type: 'domain',
          confidence: 'high',
          actor: 'LockBit',
          first_seen: '2026-01-12',
          tags: ['phishing'],
        },
      ],
      meta: {
        total: '████ [Upgrade]',
        note: 'Sample data - actual values masked',
      },
    },
  },
  {
    id: 'vulnerabilities',
    method: 'GET',
    path: '/api/v1/vulnerabilities',
    description: 'Query CVE database',
    params: [
      { name: 'exploited', value: 'true', description: 'Known exploited only' },
      { name: 'severity', value: 'critical', description: 'CVSS severity' },
    ],
    sampleResponse: {
      data: [
        {
          cve_id: 'CVE-2026-1234',
          description: 'Critical RCE in...',
          cvss_score: 9.8,
          severity: 'critical',
          exploited: true,
          exploited_by: ['LockBit', '████'],
          affected_products: ['████████'],
        },
      ],
      meta: {
        total: 156,
        kev_count: 47,
      },
    },
  },
]

function CodeBlock({ code, language = 'json' }) {
  return (
    <pre className="bg-gray-950 rounded-lg p-4 overflow-x-auto text-sm">
      <code className="text-gray-300 font-mono whitespace-pre">
        {typeof code === 'string' ? code : JSON.stringify(code, null, 2)}
      </code>
    </pre>
  )
}

function EndpointCard({ endpoint, isSelected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(endpoint)}
      className={clsx(
        'w-full text-left p-3 rounded-lg border transition-all',
        isSelected
          ? 'border-cyber-accent bg-cyber-accent/10'
          : 'border-gray-800 hover:border-gray-700 bg-gray-800/30'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx(
          'text-xs font-mono px-1.5 py-0.5 rounded',
          endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
          endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
          'bg-gray-500/20 text-gray-400'
        )}>
          {endpoint.method}
        </span>
        <span className="text-sm text-white font-mono">{endpoint.path}</span>
      </div>
      <p className="text-xs text-gray-500">{endpoint.description}</p>
    </button>
  )
}

function ApiPlayground() {
  const { tier, canAccess } = useSubscription()
  const hasApiAccess = canAccess('api_access')
  const [selectedEndpoint, setSelectedEndpoint] = useState(SAMPLE_ENDPOINTS[0])
  const [activeTab, setActiveTab] = useState('response')

  // If user has API access, redirect to actual API docs
  if (hasApiAccess) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🔌</div>
        <h3 className="text-xl font-semibold text-white mb-2">You have API access!</h3>
        <p className="text-gray-400 mb-6">
          View the full API documentation to start integrating.
        </p>
        <Link
          to="/api-docs"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90"
        >
          View API Docs
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    )
  }

  const curlExample = `curl -X ${selectedEndpoint.method} \\
  "https://api.vigil.theintelligence.company${selectedEndpoint.path}${
    selectedEndpoint.params.length > 0
      ? '?' + selectedEndpoint.params.map(p => `${p.name}=${p.value}`).join('&')
      : ''
  }" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-white">API Playground</h2>
            <TierBadge tier="team" showIcon />
          </div>
          <p className="text-gray-400">
            Try the Vigil API with sample data. Upgrade to Team for full access.
          </p>
        </div>
        <Link
          to="/pricing"
          className="px-4 py-2 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90"
        >
          Unlock API Access
        </Link>
      </div>

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Endpoint list */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Endpoints</h3>
          {SAMPLE_ENDPOINTS.map(endpoint => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              isSelected={selectedEndpoint.id === endpoint.id}
              onSelect={setSelectedEndpoint}
            />
          ))}
        </div>

        {/* Request/Response */}
        <div className="lg:col-span-2 space-y-4">
          {/* Request info */}
          <div className="cyber-card">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Request</h3>

            <div className="flex items-center gap-2 mb-4">
              <span className={clsx(
                'text-sm font-mono px-2 py-1 rounded',
                'bg-green-500/20 text-green-400'
              )}>
                {selectedEndpoint.method}
              </span>
              <code className="text-white font-mono text-sm">
                {selectedEndpoint.path}
              </code>
            </div>

            {/* Parameters */}
            {selectedEndpoint.params.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">Parameters</div>
                <div className="space-y-2">
                  {selectedEndpoint.params.map(param => (
                    <div key={param.name} className="flex items-center gap-3 text-sm">
                      <code className="text-cyan-400 font-mono">{param.name}</code>
                      <span className="text-gray-600">=</span>
                      <code className="text-yellow-400 font-mono">{param.value}</code>
                      <span className="text-gray-500 text-xs">({param.description})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* cURL example */}
            <div>
              <div className="text-xs text-gray-500 mb-2">cURL</div>
              <CodeBlock code={curlExample} language="bash" />
            </div>
          </div>

          {/* Response */}
          <div className="cyber-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Sample Response</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-400">200 OK</span>
              </div>
            </div>

            <CodeBlock code={selectedEndpoint.sampleResponse} />

            {/* Masked data notice */}
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400">⚠️</span>
                <div>
                  <p className="text-sm text-yellow-400">Sample data with masked values</p>
                  <p className="text-xs text-yellow-500/70 mt-1">
                    Upgrade to Team to access real data and full API responses.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* API features list */}
          <div className="cyber-card">
            <h3 className="text-sm font-medium text-gray-400 mb-4">API Features</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: '🔍', text: '16 API endpoints' },
                { icon: '📊', text: 'Bulk IOC lookups (1000/request)' },
                { icon: '🔗', text: 'STIX 2.1 export' },
                { icon: '⚡', text: '10,000+ requests/month' },
                { icon: '🔌', text: 'SIEM/SOAR integrations' },
                { icon: '📡', text: 'Webhooks for real-time alerts' },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{feature.icon}</span>
                  <span className="text-gray-300">{feature.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800">
              <Link
                to="/pricing"
                className="block w-full text-center px-4 py-3 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90"
              >
                Unlock Full API Access - $59/mo
              </Link>
              <p className="text-xs text-gray-500 text-center mt-2">
                Or $129/mo for Team with 5 users
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div className="cyber-card bg-gradient-to-r from-cyber-accent/5 to-transparent">
        <div className="flex items-start gap-4">
          <div className="text-3xl">💬</div>
          <div>
            <p className="text-gray-300 italic mb-2">
              "Vigil's API saved us 10+ hours per week. We automated our IOC ingestion and
              our SIEM now gets fresh indicators every hour without manual work."
            </p>
            <p className="text-sm text-gray-500">
              — Security Engineer, Mid-size MSSP
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiPlayground
