/**
 * SOAR Playbook Templates
 *
 * Pre-built response playbooks for common security incidents.
 * Each playbook contains:
 *   - Trigger conditions
 *   - Step-by-step actions
 *   - Automation hooks
 *   - Evidence collection guidance
 */

export const PLAYBOOK_CATEGORIES = {
  RANSOMWARE: 'ransomware',
  MALWARE: 'malware',
  PHISHING: 'phishing',
  CREDENTIAL: 'credential_compromise',
  NETWORK: 'network_intrusion',
  DATA_EXFIL: 'data_exfiltration',
  INSIDER: 'insider_threat',
  VULNERABILITY: 'vulnerability_response'
}

export const SEVERITY_LEVELS = {
  CRITICAL: { value: 1, label: 'Critical', color: '#dc2626', sla: '1 hour' },
  HIGH: { value: 2, label: 'High', color: '#f97316', sla: '4 hours' },
  MEDIUM: { value: 3, label: 'Medium', color: '#eab308', sla: '24 hours' },
  LOW: { value: 4, label: 'Low', color: '#22c55e', sla: '72 hours' }
}

export const PLAYBOOKS = [
  // =====================================================
  // RANSOMWARE RESPONSE
  // =====================================================
  {
    id: 'ransomware-initial-response',
    name: 'Ransomware Initial Response',
    category: PLAYBOOK_CATEGORIES.RANSOMWARE,
    severity: SEVERITY_LEVELS.CRITICAL,
    description: 'Immediate response actions when ransomware activity is detected or suspected.',
    triggerConditions: [
      'Ransomware variant detected by EDR/AV',
      'User reports encrypted files',
      'Ransom note discovered',
      'Mass file encryption observed',
      'Known ransomware C2 communication detected'
    ],
    steps: [
      {
        order: 1,
        title: 'Isolate Affected Systems',
        description: 'Immediately isolate infected systems from the network to prevent lateral movement.',
        actions: [
          { type: 'manual', action: 'Disconnect network cable or disable WiFi' },
          { type: 'automation', action: 'quarantine_host', platform: 'crowdstrike' },
          { type: 'automation', action: 'isolate_endpoint', platform: 'sentinelone' },
          { type: 'automation', action: 'block_host', platform: 'firewall' }
        ],
        evidence: ['Screenshot of isolation confirmation', 'Network disconnect timestamp'],
        sla: '15 minutes'
      },
      {
        order: 2,
        title: 'Preserve Evidence',
        description: 'Capture volatile evidence before it is lost.',
        actions: [
          { type: 'manual', action: 'Do NOT power off systems - preserve memory' },
          { type: 'automation', action: 'memory_dump', platform: 'velociraptor' },
          { type: 'automation', action: 'collect_artifacts', platform: 'kape' }
        ],
        evidence: ['Memory dump files', 'Process list', 'Network connections', 'Running services'],
        sla: '30 minutes'
      },
      {
        order: 3,
        title: 'Identify Ransomware Variant',
        description: 'Determine the ransomware family to understand capabilities and potential decryption options.',
        actions: [
          { type: 'manual', action: 'Collect ransom note text' },
          { type: 'manual', action: 'Identify encrypted file extension' },
          { type: 'automation', action: 'submit_sample', platform: 'virustotal' },
          { type: 'reference', action: 'Check ID Ransomware (id-ransomware.malwarehunterteam.com)' }
        ],
        evidence: ['Ransom note copy', 'Sample encrypted file', 'File extension pattern'],
        sla: '1 hour'
      },
      {
        order: 4,
        title: 'Assess Scope of Impact',
        description: 'Determine how many systems and what data has been affected.',
        actions: [
          { type: 'manual', action: 'Query EDR for related detections' },
          { type: 'automation', action: 'search_iocs', platform: 'siem' },
          { type: 'manual', action: 'Check shared drives and network storage' }
        ],
        evidence: ['List of affected systems', 'Affected data inventory', 'Impact timeline'],
        sla: '2 hours'
      },
      {
        order: 5,
        title: 'Notify Stakeholders',
        description: 'Escalate to appropriate parties based on impact.',
        actions: [
          { type: 'manual', action: 'Notify Security leadership' },
          { type: 'manual', action: 'Notify IT leadership' },
          { type: 'manual', action: 'Consider legal/compliance notification requirements' },
          { type: 'manual', action: 'Engage incident response retainer if needed' }
        ],
        evidence: ['Stakeholder notification log', 'Decision documentation'],
        sla: '2 hours'
      },
      {
        order: 6,
        title: 'Begin Containment',
        description: 'Prevent further spread while preserving business operations.',
        actions: [
          { type: 'automation', action: 'block_iocs', platform: 'firewall' },
          { type: 'automation', action: 'disable_compromised_accounts', platform: 'ad' },
          { type: 'manual', action: 'Segment affected network zones' }
        ],
        evidence: ['Blocked IOCs list', 'Disabled accounts', 'Network changes'],
        sla: '4 hours'
      }
    ],
    automationHooks: {
      onTrigger: ['slack_alert', 'pagerduty_page', 'create_ticket'],
      onComplete: ['generate_report', 'update_metrics']
    },
    references: [
      { name: 'CISA Ransomware Guide', url: 'https://www.cisa.gov/stopransomware' },
      { name: 'No More Ransom', url: 'https://www.nomoreransom.org' }
    ],
    mitreTechniques: ['T1486', 'T1490', 'T1489']
  },

  // =====================================================
  // PHISHING RESPONSE
  // =====================================================
  {
    id: 'phishing-response',
    name: 'Phishing Email Response',
    category: PLAYBOOK_CATEGORIES.PHISHING,
    severity: SEVERITY_LEVELS.MEDIUM,
    description: 'Response procedure for reported or detected phishing emails.',
    triggerConditions: [
      'User reports suspicious email',
      'Email gateway detects phishing',
      'URL detected as malicious post-delivery',
      'Credential harvesting page identified'
    ],
    steps: [
      {
        order: 1,
        title: 'Analyze Email Headers',
        description: 'Examine email metadata to understand delivery path and authenticity.',
        actions: [
          { type: 'manual', action: 'Extract full email headers' },
          { type: 'automation', action: 'parse_headers', platform: 'email_security' },
          { type: 'reference', action: 'Check SPF, DKIM, DMARC results' }
        ],
        evidence: ['Full email headers', 'Authentication results'],
        sla: '30 minutes'
      },
      {
        order: 2,
        title: 'Extract and Analyze IOCs',
        description: 'Identify malicious indicators in the email.',
        actions: [
          { type: 'manual', action: 'Extract sender address, reply-to, URLs, attachments' },
          { type: 'automation', action: 'detonate_url', platform: 'urlscan' },
          { type: 'automation', action: 'analyze_attachment', platform: 'sandbox' }
        ],
        evidence: ['URL analysis results', 'Attachment analysis', 'IOC list'],
        sla: '1 hour'
      },
      {
        order: 3,
        title: 'Determine Scope',
        description: 'Find all recipients of the phishing email.',
        actions: [
          { type: 'automation', action: 'search_message_trace', platform: 'email_gateway' },
          { type: 'manual', action: 'Query email logs for subject/sender' }
        ],
        evidence: ['Recipient list', 'Delivery timeline'],
        sla: '1 hour'
      },
      {
        order: 4,
        title: 'Remediate',
        description: 'Remove malicious email from all mailboxes.',
        actions: [
          { type: 'automation', action: 'delete_emails', platform: 'o365' },
          { type: 'automation', action: 'block_sender', platform: 'email_gateway' },
          { type: 'automation', action: 'block_urls', platform: 'proxy' }
        ],
        evidence: ['Deletion confirmation', 'Block rules added'],
        sla: '2 hours'
      },
      {
        order: 5,
        title: 'Check for Compromised Users',
        description: 'Identify if any users clicked links or entered credentials.',
        actions: [
          { type: 'automation', action: 'search_proxy_logs', platform: 'proxy' },
          { type: 'manual', action: 'Interview reported clickers' },
          { type: 'manual', action: 'Check for credential reuse' }
        ],
        evidence: ['Click logs', 'User interviews', 'Compromise assessment'],
        sla: '4 hours'
      },
      {
        order: 6,
        title: 'Reset Credentials if Needed',
        description: 'Force password reset for compromised or potentially compromised accounts.',
        actions: [
          { type: 'automation', action: 'reset_password', platform: 'ad' },
          { type: 'automation', action: 'revoke_sessions', platform: 'azure_ad' },
          { type: 'manual', action: 'Notify affected users' }
        ],
        evidence: ['Password reset confirmation', 'User notification'],
        sla: '2 hours'
      }
    ],
    automationHooks: {
      onTrigger: ['create_ticket', 'slack_alert'],
      onComplete: ['update_threat_intel', 'user_awareness_tracking']
    },
    references: [
      { name: 'NIST Phishing Guidance', url: 'https://www.nist.gov/phishing' }
    ],
    mitreTechniques: ['T1566.001', 'T1566.002', 'T1598']
  },

  // =====================================================
  // MALWARE INFECTION RESPONSE
  // =====================================================
  {
    id: 'malware-infection',
    name: 'Malware Infection Response',
    category: PLAYBOOK_CATEGORIES.MALWARE,
    severity: SEVERITY_LEVELS.HIGH,
    description: 'Response procedure for confirmed malware infections.',
    triggerConditions: [
      'EDR detects malware execution',
      'AV quarantines malicious file',
      'Suspicious process behavior detected',
      'C2 communication identified'
    ],
    steps: [
      {
        order: 1,
        title: 'Verify Detection',
        description: 'Confirm the detection is a true positive.',
        actions: [
          { type: 'manual', action: 'Review EDR alert details' },
          { type: 'automation', action: 'get_detection_context', platform: 'edr' },
          { type: 'automation', action: 'check_hash_reputation', platform: 'virustotal' }
        ],
        evidence: ['Detection details', 'Hash analysis', 'File metadata'],
        sla: '15 minutes'
      },
      {
        order: 2,
        title: 'Contain Threat',
        description: 'Prevent malware from spreading or communicating.',
        actions: [
          { type: 'automation', action: 'kill_process', platform: 'edr' },
          { type: 'automation', action: 'quarantine_file', platform: 'edr' },
          { type: 'automation', action: 'block_c2', platform: 'firewall' }
        ],
        evidence: ['Process termination log', 'Quarantine confirmation', 'Firewall rules'],
        sla: '30 minutes'
      },
      {
        order: 3,
        title: 'Collect Forensic Artifacts',
        description: 'Gather evidence for analysis and potential legal proceedings.',
        actions: [
          { type: 'automation', action: 'collect_artifacts', platform: 'edr' },
          { type: 'manual', action: 'Preserve original malware sample' },
          { type: 'automation', action: 'timeline_analysis', platform: 'velociraptor' }
        ],
        evidence: ['Malware sample', 'Execution timeline', 'Registry changes', 'File system changes'],
        sla: '2 hours'
      },
      {
        order: 4,
        title: 'Determine Entry Vector',
        description: 'Identify how the malware entered the environment.',
        actions: [
          { type: 'manual', action: 'Review recent email attachments' },
          { type: 'manual', action: 'Check download history' },
          { type: 'automation', action: 'correlate_events', platform: 'siem' }
        ],
        evidence: ['Entry vector determination', 'Initial access timeline'],
        sla: '4 hours'
      },
      {
        order: 5,
        title: 'Hunt for Related Activity',
        description: 'Search for indicators of compromise across the environment.',
        actions: [
          { type: 'automation', action: 'ioc_sweep', platform: 'edr' },
          { type: 'automation', action: 'search_related_hashes', platform: 'siem' }
        ],
        evidence: ['Hunt results', 'Additional affected systems'],
        sla: '8 hours'
      },
      {
        order: 6,
        title: 'Eradicate and Recover',
        description: 'Remove all traces of malware and restore normal operations.',
        actions: [
          { type: 'automation', action: 'full_scan', platform: 'edr' },
          { type: 'manual', action: 'Verify system integrity' },
          { type: 'manual', action: 'Restore from known-good backup if needed' }
        ],
        evidence: ['Clean scan results', 'Recovery documentation'],
        sla: '24 hours'
      }
    ],
    automationHooks: {
      onTrigger: ['create_ticket', 'slack_alert', 'enrich_iocs'],
      onComplete: ['block_iocs_globally', 'generate_report']
    },
    references: [
      { name: 'NIST Malware Incident Handling', url: 'https://csrc.nist.gov/publications/detail/sp/800-83/rev-1/final' }
    ],
    mitreTechniques: ['T1059', 'T1055', 'T1071']
  },

  // =====================================================
  // CREDENTIAL COMPROMISE
  // =====================================================
  {
    id: 'credential-compromise',
    name: 'Credential Compromise Response',
    category: PLAYBOOK_CATEGORIES.CREDENTIAL,
    severity: SEVERITY_LEVELS.HIGH,
    description: 'Response when user credentials are confirmed or suspected compromised.',
    triggerConditions: [
      'Credentials found in breach database',
      'Impossible travel alert',
      'Suspicious authentication patterns',
      'User reports unauthorized access',
      'Credential stuffing attack detected'
    ],
    steps: [
      {
        order: 1,
        title: 'Verify Compromise',
        description: 'Confirm credentials are actually compromised.',
        actions: [
          { type: 'manual', action: 'Review authentication logs' },
          { type: 'automation', action: 'check_haveibeenpwned', platform: 'hibp' },
          { type: 'manual', action: 'Interview user if applicable' }
        ],
        evidence: ['Auth logs', 'Breach check results', 'User statement'],
        sla: '30 minutes'
      },
      {
        order: 2,
        title: 'Disable/Reset Credentials',
        description: 'Immediately prevent further unauthorized access.',
        actions: [
          { type: 'automation', action: 'reset_password', platform: 'ad' },
          { type: 'automation', action: 'revoke_all_sessions', platform: 'azure_ad' },
          { type: 'automation', action: 'revoke_oauth_tokens', platform: 'identity' }
        ],
        evidence: ['Reset confirmation', 'Session revocation log'],
        sla: '15 minutes'
      },
      {
        order: 3,
        title: 'Review Account Activity',
        description: 'Determine what actions were taken with the compromised credentials.',
        actions: [
          { type: 'automation', action: 'get_auth_history', platform: 'siem' },
          { type: 'automation', action: 'get_email_rules', platform: 'o365' },
          { type: 'manual', action: 'Check for data access/exfiltration' }
        ],
        evidence: ['Activity timeline', 'Email rule audit', 'Data access logs'],
        sla: '2 hours'
      },
      {
        order: 4,
        title: 'Check for Persistence',
        description: 'Look for attacker persistence mechanisms.',
        actions: [
          { type: 'automation', action: 'check_mfa_devices', platform: 'azure_ad' },
          { type: 'manual', action: 'Review app passwords' },
          { type: 'manual', action: 'Check OAuth app consents' }
        ],
        evidence: ['MFA device list', 'App consent audit'],
        sla: '2 hours'
      },
      {
        order: 5,
        title: 'Notify and Educate User',
        description: 'Inform user and provide guidance.',
        actions: [
          { type: 'manual', action: 'Call/email user directly' },
          { type: 'manual', action: 'Provide new credentials securely' },
          { type: 'manual', action: 'Recommend password manager' }
        ],
        evidence: ['User notification record', 'New credential delivery confirmation'],
        sla: '4 hours'
      }
    ],
    automationHooks: {
      onTrigger: ['create_ticket', 'disable_account_temporary'],
      onComplete: ['update_user_risk_score', 'security_awareness_flag']
    },
    mitreTechniques: ['T1078', 'T1110', 'T1556']
  },

  // =====================================================
  // VULNERABILITY RESPONSE
  // =====================================================
  {
    id: 'critical-vulnerability',
    name: 'Critical Vulnerability Response',
    category: PLAYBOOK_CATEGORIES.VULNERABILITY,
    severity: SEVERITY_LEVELS.CRITICAL,
    description: 'Response procedure for critical vulnerabilities added to CISA KEV or with active exploitation.',
    triggerConditions: [
      'Vulnerability added to CISA KEV',
      'Active exploitation reported',
      'CVSS 9.0+ with public exploit',
      'Zero-day disclosed'
    ],
    steps: [
      {
        order: 1,
        title: 'Assess Exposure',
        description: 'Determine if vulnerable systems exist in the environment.',
        actions: [
          { type: 'automation', action: 'scan_for_vulnerability', platform: 'vuln_scanner' },
          { type: 'automation', action: 'query_asset_inventory', platform: 'cmdb' },
          { type: 'manual', action: 'Identify internet-facing vulnerable systems' }
        ],
        evidence: ['Scan results', 'Affected asset list', 'Exposure assessment'],
        sla: '2 hours'
      },
      {
        order: 2,
        title: 'Prioritize Assets',
        description: 'Rank affected systems by criticality and exposure.',
        actions: [
          { type: 'manual', action: 'Categorize by business criticality' },
          { type: 'manual', action: 'Identify internet-exposed systems' },
          { type: 'manual', action: 'Determine data sensitivity' }
        ],
        evidence: ['Prioritized remediation list'],
        sla: '4 hours'
      },
      {
        order: 3,
        title: 'Apply Mitigations',
        description: 'Implement temporary mitigations if patches unavailable.',
        actions: [
          { type: 'manual', action: 'Disable vulnerable service if possible' },
          { type: 'automation', action: 'deploy_firewall_rules', platform: 'firewall' },
          { type: 'manual', action: 'Implement network segmentation' }
        ],
        evidence: ['Mitigation documentation', 'Firewall rules'],
        sla: '8 hours'
      },
      {
        order: 4,
        title: 'Deploy Patches',
        description: 'Apply vendor patches in priority order.',
        actions: [
          { type: 'automation', action: 'deploy_patch', platform: 'sccm' },
          { type: 'manual', action: 'Test in staging first for critical systems' },
          { type: 'manual', action: 'Coordinate maintenance windows' }
        ],
        evidence: ['Patch deployment logs', 'Post-patch verification'],
        sla: '72 hours for critical, 2 weeks for others'
      },
      {
        order: 5,
        title: 'Verify Remediation',
        description: 'Confirm vulnerabilities are resolved.',
        actions: [
          { type: 'automation', action: 'rescan_systems', platform: 'vuln_scanner' },
          { type: 'manual', action: 'Validate service functionality' }
        ],
        evidence: ['Clean scan results', 'Validation checklist'],
        sla: '24 hours post-patch'
      },
      {
        order: 6,
        title: 'Hunt for Exploitation',
        description: 'Check if vulnerability was exploited before patching.',
        actions: [
          { type: 'automation', action: 'search_exploit_indicators', platform: 'siem' },
          { type: 'manual', action: 'Review logs for exploitation patterns' }
        ],
        evidence: ['Hunt results', 'Exploitation assessment'],
        sla: '48 hours'
      }
    ],
    automationHooks: {
      onTrigger: ['create_ticket', 'notify_asset_owners', 'create_change_request'],
      onComplete: ['update_vuln_metrics', 'generate_report']
    },
    references: [
      { name: 'CISA KEV Catalog', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' }
    ],
    mitreTechniques: ['T1190', 'T1210']
  }
]

/**
 * Get playbook by ID
 */
export function getPlaybook(id) {
  return PLAYBOOKS.find(p => p.id === id)
}

/**
 * Get playbooks by category
 */
export function getPlaybooksByCategory(category) {
  return PLAYBOOKS.filter(p => p.category === category)
}

/**
 * Get all playbooks sorted by severity
 */
export function getAllPlaybooks() {
  return [...PLAYBOOKS].sort((a, b) => a.severity.value - b.severity.value)
}

/**
 * Search playbooks by keyword
 */
export function searchPlaybooks(query) {
  const q = query.toLowerCase()
  return PLAYBOOKS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.triggerConditions.some(tc => tc.toLowerCase().includes(q))
  )
}

export default PLAYBOOKS
