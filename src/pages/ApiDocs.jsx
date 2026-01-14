/**
 * API Documentation Page
 * Interactive API reference for Vigil REST API
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { canAccess } from '../lib/features'
import { useAuth } from '../hooks/useAuth'

const API_BASE = 'https://vigil.theintelligence.company/api/v1'

const ENDPOINTS = [
  {
    id: 'actors',
    name: 'Threat Actors',
    description: 'Access threat actor intelligence data',
    method: 'GET',
    path: '/actors',
    params: [
      { name: 'id', type: 'uuid', description: 'Get a specific actor by ID' },
      { name: 'search', type: 'string', description: 'Search by name or alias' },
      { name: 'trend_status', type: 'string', description: 'Filter by trend: ESCALATING, STABLE, DECLINING' },
      { name: 'country', type: 'string', description: 'Filter by attributed country' },
      { name: 'sector', type: 'string', description: 'Filter by target sector' },
      { name: 'page', type: 'integer', description: 'Page number (default: 1)' },
      { name: 'limit', type: 'integer', description: 'Results per page (max: 100, default: 50)' },
      { name: 'sort_by', type: 'string', description: 'Field to sort by (default: last_seen)' },
      { name: 'sort_order', type: 'string', description: 'Sort direction: asc or desc' },
    ],
    response: `{
  "data": [
    {
      "id": "uuid",
      "name": "LockBit",
      "aliases": ["LockBit 3.0", "LockBit Black"],
      "description": "...",
      "trend_status": "ESCALATING",
      "incident_velocity": 2.5,
      "target_sectors": ["healthcare", "finance"],
      "attributed_countries": ["Russia"],
      "first_seen": "2019-09-01",
      "last_seen": "2024-01-15"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "pages": 5
  }
}`
  },
  {
    id: 'incidents',
    name: 'Incidents',
    description: 'Access ransomware and cyber attack incidents',
    method: 'GET',
    path: '/incidents',
    params: [
      { name: 'id', type: 'uuid', description: 'Get a specific incident by ID' },
      { name: 'actor_id', type: 'uuid', description: 'Filter by threat actor' },
      { name: 'search', type: 'string', description: 'Search by victim name' },
      { name: 'sector', type: 'string', description: 'Filter by victim sector' },
      { name: 'country', type: 'string', description: 'Filter by victim country' },
      { name: 'status', type: 'string', description: 'Filter by status: claimed, confirmed, leaked' },
      { name: 'date_from', type: 'date', description: 'Filter incidents after date (YYYY-MM-DD)' },
      { name: 'date_to', type: 'date', description: 'Filter incidents before date (YYYY-MM-DD)' },
      { name: 'page', type: 'integer', description: 'Page number (default: 1)' },
      { name: 'limit', type: 'integer', description: 'Results per page (max: 100, default: 50)' },
    ],
    response: `{
  "data": [
    {
      "id": "uuid",
      "victim_name": "Acme Corp",
      "victim_sector": "technology",
      "victim_country": "United States",
      "discovered_date": "2024-01-15",
      "status": "claimed",
      "threat_actor": {
        "id": "uuid",
        "name": "LockBit"
      }
    }
  ],
  "pagination": { ... }
}`
  },
  {
    id: 'iocs',
    name: 'IOCs',
    description: 'Access indicators of compromise',
    method: 'GET',
    path: '/iocs',
    params: [
      { name: 'id', type: 'uuid', description: 'Get a specific IOC by ID' },
      { name: 'value', type: 'string', description: 'Lookup by IOC value (IP, domain, hash)' },
      { name: 'type', type: 'string', description: 'Filter by type: ip, domain, url, hash, email' },
      { name: 'actor_id', type: 'uuid', description: 'Filter by associated actor' },
      { name: 'source', type: 'string', description: 'Filter by data source' },
      { name: 'malware_family', type: 'string', description: 'Filter by malware family' },
      { name: 'min_confidence', type: 'integer', description: 'Minimum confidence score (0-100)' },
      { name: 'date_from', type: 'date', description: 'Filter IOCs after date' },
      { name: 'date_to', type: 'date', description: 'Filter IOCs before date' },
      { name: 'page', type: 'integer', description: 'Page number' },
      { name: 'limit', type: 'integer', description: 'Results per page' },
    ],
    response: `{
  "data": [
    {
      "id": "uuid",
      "value": "192.168.1.1",
      "type": "ip",
      "confidence": 90,
      "malware_family": "Emotet",
      "source": "abuse.ch",
      "threat_actor": {
        "id": "uuid",
        "name": "TA505"
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}`
  },
  {
    id: 'vulnerabilities',
    name: 'Vulnerabilities',
    description: 'Access CVE and vulnerability data',
    method: 'GET',
    path: '/vulnerabilities',
    params: [
      { name: 'id', type: 'uuid', description: 'Get a specific vulnerability by ID' },
      { name: 'cve', type: 'string', description: 'Lookup by CVE ID (e.g., CVE-2024-1234)' },
      { name: 'search', type: 'string', description: 'Search CVE ID or description' },
      { name: 'kev_only', type: 'boolean', description: 'Only return CISA KEV entries' },
      { name: 'min_cvss', type: 'number', description: 'Minimum CVSS score' },
      { name: 'max_cvss', type: 'number', description: 'Maximum CVSS score' },
      { name: 'severity', type: 'string', description: 'Filter by severity: critical, high, medium, low' },
      { name: 'vendor', type: 'string', description: 'Filter by vendor name' },
      { name: 'product', type: 'string', description: 'Filter by product name' },
      { name: 'has_exploit', type: 'boolean', description: 'Only vulnerabilities with public exploits' },
      { name: 'date_from', type: 'date', description: 'Published after date' },
      { name: 'date_to', type: 'date', description: 'Published before date' },
    ],
    response: `{
  "data": [
    {
      "id": "uuid",
      "cve_id": "CVE-2024-1234",
      "description": "Remote code execution vulnerability...",
      "cvss_score": 9.8,
      "is_kev": true,
      "vendor": "Microsoft",
      "product": "Exchange Server",
      "has_public_exploit": true,
      "published_date": "2024-01-10"
    }
  ],
  "pagination": { ... }
}`
  }
]

function CodeBlock({ children, language = 'json' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-gray-300">{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function EndpointCard({ endpoint }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded">
            {endpoint.method}
          </span>
          <span className="font-mono text-white">{endpoint.path}</span>
          <span className="text-gray-400 text-sm">{endpoint.name}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 py-4 border-t border-gray-700 space-y-6">
          <p className="text-gray-400">{endpoint.description}</p>

          {/* Parameters */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Query Parameters</h4>
            <div className="space-y-2">
              {endpoint.params.map((param) => (
                <div key={param.name} className="flex items-start gap-4 text-sm">
                  <code className="px-2 py-0.5 bg-gray-900 text-cyan-400 rounded font-mono">
                    {param.name}
                  </code>
                  <span className="text-gray-500">{param.type}</span>
                  <span className="text-gray-400 flex-1">{param.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Example Request */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Example Request</h4>
            <CodeBlock language="bash">
{`curl -X GET "${API_BASE}${endpoint.path}?limit=10" \\
  -H "Authorization: Bearer vgl_your_api_key"`}
            </CodeBlock>
          </div>

          {/* Response */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Response</h4>
            <CodeBlock>{endpoint.response}</CodeBlock>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApiDocs() {
  const { user } = useAuth()
  // For demo purposes, assume free tier - in production this would come from user's subscription
  const userTier = 'free'
  const hasApiAccess = canAccess(userTier, 'api_access')

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">API Documentation</h1>
        <p className="text-gray-400 mt-1">
          Programmatic access to Vigil threat intelligence data
        </p>
      </div>

      {/* Access Notice */}
      {!hasApiAccess && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-yellow-400 font-medium">API Access Required</h3>
              <p className="text-gray-400 text-sm mt-1">
                REST API access is available on Team and Enterprise plans.{' '}
                <Link to="/pricing" className="text-cyan-400 hover:underline">
                  Upgrade your plan
                </Link>{' '}
                to get programmatic access to Vigil data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Quick Start</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">1. Get your API Key</h3>
            <p className="text-gray-400 text-sm">
              Generate an API key from your{' '}
              <Link to="/settings" className="text-cyan-400 hover:underline">
                Settings page
              </Link>
              . Keys are prefixed with <code className="text-cyan-400">vgl_</code>.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">2. Make your first request</h3>
            <CodeBlock language="bash">
{`curl -X GET "${API_BASE}/actors?limit=5" \\
  -H "Authorization: Bearer vgl_your_api_key"`}
            </CodeBlock>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">3. Handle the response</h3>
            <p className="text-gray-400 text-sm">
              All responses are JSON with a consistent structure. List endpoints include
              pagination metadata.
            </p>
          </div>
        </div>
      </section>

      {/* Authentication */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Authentication</h2>
        <p className="text-gray-400 text-sm mb-4">
          All API requests require authentication using a Bearer token in the Authorization header.
        </p>
        <CodeBlock language="bash">
{`Authorization: Bearer vgl_your_api_key_here`}
        </CodeBlock>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Rate Limits</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>60 requests per minute</li>
              <li>10,000 requests per day</li>
            </ul>
          </div>
          <div className="bg-gray-900 rounded p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Response Codes</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li><code className="text-green-400">200</code> - Success</li>
              <li><code className="text-yellow-400">401</code> - Invalid API key</li>
              <li><code className="text-yellow-400">403</code> - Insufficient permissions</li>
              <li><code className="text-yellow-400">429</code> - Rate limited</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Endpoints</h2>
        <div className="space-y-4">
          {ENDPOINTS.map((endpoint) => (
            <EndpointCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      </section>

      {/* SDKs & Examples */}
      <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Code Examples</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Python</h3>
            <CodeBlock language="python">
{`import requests

API_KEY = "vgl_your_api_key"
BASE_URL = "${API_BASE}"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Get escalating actors
response = requests.get(
    f"{BASE_URL}/actors",
    headers=headers,
    params={"trend_status": "ESCALATING", "limit": 10}
)

actors = response.json()["data"]
for actor in actors:
    print(f"{actor['name']}: {actor['trend_status']}")`}
            </CodeBlock>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">JavaScript</h3>
            <CodeBlock language="javascript">
{`const API_KEY = "vgl_your_api_key";
const BASE_URL = "${API_BASE}";

async function getActors() {
  const response = await fetch(
    \`\${BASE_URL}/actors?trend_status=ESCALATING&limit=10\`,
    {
      headers: {
        "Authorization": \`Bearer \${API_KEY}\`
      }
    }
  );

  const { data } = await response.json();
  return data;
}

getActors().then(actors => {
  actors.forEach(a => console.log(a.name));
});`}
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="text-center py-8">
        <p className="text-gray-400">
          Need help with the API?{' '}
          <a href="mailto:support@theintelligence.company" className="text-cyan-400 hover:underline">
            Contact support
          </a>
        </p>
      </section>
    </div>
  )
}
