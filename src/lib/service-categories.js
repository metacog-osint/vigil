// Service Categories Taxonomy
// Maps CVE affected products to service categories for the Targeted Services widget
// This helps users understand which types of services are being actively targeted

export const SERVICE_CATEGORIES = {
  vpn_remote: {
    id: 'vpn_remote',
    name: 'VPN / Remote Access',
    shortName: 'VPN',
    icon: 'shield',
    color: '#ef4444', // red
    description: 'VPN gateways, remote desktop, and remote access tools',
    keywords: [
      'vpn',
      'anyconnect',
      'globalprotect',
      'pulse secure',
      'pulse connect',
      'fortigate',
      'fortios',
      'forticlient',
      'ssl vpn',
      'ipsec',
      'citrix gateway',
      'netscaler',
      'adc',
      'sonicwall',
      'zyxel',
      'openvpn',
      'wireguard',
      'remote desktop',
      'rdp',
      'rdweb',
      'remote access',
      'ivanti',
      'connect secure',
      'policy secure',
      'f5 big-ip',
      'access policy manager',
      'apm',
      'juniper',
      'palo alto',
      'prisma access',
      'checkpoint',
      'mobile access',
    ],
    vendors: [
      'cisco',
      'fortinet',
      'palo alto',
      'pulse secure',
      'citrix',
      'sonicwall',
      'ivanti',
      'f5',
      'juniper',
      'checkpoint',
    ],
  },
  email: {
    id: 'email',
    name: 'Email Services',
    shortName: 'Email',
    icon: 'mail',
    color: '#f97316', // orange
    description: 'Email servers, clients, and security gateways',
    keywords: [
      'exchange',
      'outlook',
      'owa',
      'office 365',
      'microsoft 365',
      'm365',
      'zimbra',
      'postfix',
      'sendmail',
      'exim',
      'dovecot',
      'roundcube',
      'proofpoint',
      'mimecast',
      'barracuda email',
      'email gateway',
      'smtp',
      'imap',
      'pop3',
      'mail server',
      'email security',
      'gmail',
      'google workspace',
      'mail transfer agent',
      'mta',
    ],
    vendors: ['microsoft', 'zimbra', 'proofpoint', 'mimecast', 'barracuda', 'google'],
  },
  cloud: {
    id: 'cloud',
    name: 'Cloud Platforms',
    shortName: 'Cloud',
    icon: 'cloud',
    color: '#3b82f6', // blue
    description: 'Cloud infrastructure and platform services',
    keywords: [
      'aws',
      'amazon web services',
      'ec2',
      's3',
      'lambda',
      'cloudfront',
      'azure',
      'azure ad',
      'azure active directory',
      'entra',
      'gcp',
      'google cloud',
      'compute engine',
      'cloud storage',
      'kubernetes',
      'k8s',
      'docker',
      'container',
      'eks',
      'aks',
      'gke',
      'terraform',
      'cloudformation',
      'arm template',
      'oracle cloud',
      'oci',
      'ibm cloud',
      'alibaba cloud',
      'vmware cloud',
      'vsphere',
      'vcenter',
      'esxi',
    ],
    vendors: ['amazon', 'microsoft', 'google', 'oracle', 'vmware', 'ibm'],
  },
  identity: {
    id: 'identity',
    name: 'Identity / SSO',
    shortName: 'Identity',
    icon: 'user',
    color: '#a855f7', // purple
    description: 'Identity providers, SSO, and authentication systems',
    keywords: [
      'active directory',
      'ad',
      'ldap',
      'kerberos',
      'ntlm',
      'okta',
      'auth0',
      'ping identity',
      'onelogin',
      'duo',
      'azure ad',
      'entra id',
      'saml',
      'oauth',
      'oidc',
      'openid',
      'sso',
      'single sign-on',
      'mfa',
      'multi-factor',
      '2fa',
      'identity provider',
      'idp',
      'adfs',
      'federation',
      'privileged access',
      'pam',
      'cyberark',
      'beyondtrust',
      'radius',
      'tacacs',
      'certificate authority',
      'pki',
    ],
    vendors: ['microsoft', 'okta', 'ping identity', 'onelogin', 'duo', 'cyberark'],
  },
  web_server: {
    id: 'web_server',
    name: 'Web Servers',
    shortName: 'Web',
    icon: 'globe',
    color: '#06b6d4', // cyan
    description: 'Web servers and application servers',
    keywords: [
      'apache',
      'httpd',
      'nginx',
      'iis',
      'tomcat',
      'jboss',
      'weblogic',
      'websphere',
      'wildfly',
      'glassfish',
      'node.js',
      'express',
      'django',
      'flask',
      'rails',
      'php',
      'wordpress',
      'drupal',
      'joomla',
      'magento',
      'spring',
      'struts',
      'log4j',
      'web application',
      'reverse proxy',
      'load balancer',
      'haproxy',
      'traefik',
    ],
    vendors: ['apache', 'microsoft', 'nginx', 'oracle', 'ibm', 'red hat'],
  },
  database: {
    id: 'database',
    name: 'Databases',
    shortName: 'Database',
    icon: 'database',
    color: '#10b981', // green
    description: 'Database management systems',
    keywords: [
      'sql server',
      'mssql',
      'mysql',
      'mariadb',
      'postgresql',
      'postgres',
      'oracle database',
      'oracle db',
      'mongodb',
      'redis',
      'elasticsearch',
      'cassandra',
      'couchdb',
      'dynamodb',
      'cosmos db',
      'sqlite',
      'access',
      'db2',
      'sybase',
      'informix',
      'sql injection',
      'database',
      'rdbms',
      'nosql',
    ],
    vendors: ['microsoft', 'oracle', 'mysql', 'postgresql', 'mongodb', 'elastic'],
  },
  file_sharing: {
    id: 'file_sharing',
    name: 'File Sharing',
    shortName: 'Files',
    icon: 'folder',
    color: '#eab308', // yellow
    description: 'File sharing and collaboration platforms',
    keywords: [
      'sharepoint',
      'onedrive',
      'dropbox',
      'box',
      'google drive',
      'nextcloud',
      'owncloud',
      'smb',
      'cifs',
      'nfs',
      'ftp',
      'sftp',
      'webdav',
      'file server',
      'nas',
      'network attached storage',
      'synology',
      'qnap',
      'file transfer',
      'managed file transfer',
      'mft',
      'moveit',
      'goanywhere',
      'accellion',
      'kiteworks',
      'aspera',
    ],
    vendors: ['microsoft', 'dropbox', 'box', 'google', 'progress', 'fortra'],
  },
  network: {
    id: 'network',
    name: 'Network Infrastructure',
    shortName: 'Network',
    icon: 'network',
    color: '#64748b', // slate
    description: 'Routers, switches, firewalls, and network equipment',
    keywords: [
      'router',
      'switch',
      'firewall',
      'cisco ios',
      'nexus',
      'fortigate',
      'palo alto',
      'checkpoint',
      'sophos',
      'meraki',
      'ubiquiti',
      'unifi',
      'mikrotik',
      'aruba',
      'juniper',
      'junos',
      'netgear',
      'tp-link',
      'd-link',
      'snmp',
      'bgp',
      'ospf',
      'vlan',
      'acl',
      'nat',
      'ids',
      'ips',
      'intrusion',
      'waf',
      'web application firewall',
    ],
    vendors: ['cisco', 'fortinet', 'palo alto', 'checkpoint', 'juniper', 'sophos'],
  },
  endpoint: {
    id: 'endpoint',
    name: 'Endpoint / EDR',
    shortName: 'Endpoint',
    icon: 'desktop',
    color: '#f43f5e', // rose
    description: 'Endpoint protection and detection response',
    keywords: [
      'windows',
      'macos',
      'linux',
      'endpoint',
      'edr',
      'xdr',
      'crowdstrike',
      'falcon',
      'sentinelone',
      'carbon black',
      'defender',
      'windows defender',
      'symantec',
      'mcafee',
      'trellix',
      'kaspersky',
      'eset',
      'trend micro',
      'sophos endpoint',
      'antivirus',
      'anti-malware',
      'agent',
      'sensor',
    ],
    vendors: ['microsoft', 'crowdstrike', 'sentinelone', 'vmware', 'broadcom', 'trellix'],
  },
  backup: {
    id: 'backup',
    name: 'Backup / Recovery',
    shortName: 'Backup',
    icon: 'archive',
    color: '#8b5cf6', // violet
    description: 'Backup solutions and disaster recovery',
    keywords: [
      'veeam',
      'backup exec',
      'acronis',
      'commvault',
      'veritas',
      'backup',
      'recovery',
      'disaster recovery',
      'dr',
      'arcserve',
      'cohesity',
      'rubrik',
      'dell emc',
      'avamar',
      'netbackup',
      'data protection',
      'snapshot',
      'replication',
    ],
    vendors: ['veeam', 'veritas', 'acronis', 'commvault', 'cohesity', 'rubrik'],
  },
}

// Flatten all keywords for quick lookup
const keywordToCategory = {}
Object.entries(SERVICE_CATEGORIES).forEach(([categoryId, category]) => {
  category.keywords.forEach((keyword) => {
    keywordToCategory[keyword.toLowerCase()] = categoryId
  })
  category.vendors.forEach((vendor) => {
    keywordToCategory[vendor.toLowerCase()] = categoryId
  })
})

/**
 * Classify a CVE or product into a service category
 * @param {Object} params - Classification parameters
 * @param {string} params.product - Product name from CVE
 * @param {string} params.vendor - Vendor name
 * @param {string} params.description - CVE description
 * @returns {string|null} - Category ID or null if no match
 */
export function classifyService({ product = '', vendor = '', description = '' }) {
  const searchText = `${product} ${vendor} ${description}`.toLowerCase()

  // Check each category's keywords
  for (const [categoryId, category] of Object.entries(SERVICE_CATEGORIES)) {
    for (const keyword of category.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return categoryId
      }
    }
  }

  return null
}

/**
 * Get service category statistics from vulnerabilities
 * @param {Array} vulnerabilities - Array of vulnerability objects
 * @returns {Object} - Counts by category
 */
export function getServiceStats(vulnerabilities) {
  const stats = {}

  // Initialize all categories with 0
  Object.keys(SERVICE_CATEGORIES).forEach((id) => {
    stats[id] = { count: 0, cves: [] }
  })
  stats.other = { count: 0, cves: [] }

  vulnerabilities.forEach((vuln) => {
    const category = classifyService({
      product: vuln.affected_products?.join(' ') || '',
      vendor: vuln.affected_vendors?.join(' ') || '',
      description: vuln.description || '',
    })

    if (category && stats[category]) {
      stats[category].count++
      stats[category].cves.push(vuln.cve_id)
    } else {
      stats.other.count++
      stats.other.cves.push(vuln.cve_id)
    }
  })

  return stats
}

/**
 * Get top targeted services sorted by count
 * @param {Array} vulnerabilities - Array of vulnerability objects
 * @param {number} limit - Max number of categories to return
 * @returns {Array} - Sorted array of { id, name, count, color, cves }
 */
export function getTopTargetedServices(vulnerabilities, limit = 5) {
  const stats = getServiceStats(vulnerabilities)

  return Object.entries(stats)
    .filter(([id]) => id !== 'other')
    .map(([id, data]) => ({
      id,
      ...SERVICE_CATEGORIES[id],
      count: data.count,
      cves: data.cves,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export default SERVICE_CATEGORIES
