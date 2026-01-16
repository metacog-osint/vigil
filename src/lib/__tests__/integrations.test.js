/**
 * Unit tests for integrations.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  INTEGRATION_TYPES,
  NOTIFICATION_EVENTS,
  slack,
  teams,
  jira,
  siemFormats,
  integrations,
} from '../integrations'

// Mock supabase
const mockSelectOrder = vi.fn(() => Promise.resolve({
  data: [{ id: 'int-1', integration_type: 'slack' }],
  error: null
}))
const mockSelectSingle = vi.fn(() => Promise.resolve({
  data: { id: 'int-1', integration_type: 'slack', config: {} },
  error: null
}))
const mockUpsertSingle = vi.fn(() => Promise.resolve({
  data: { id: 'int-1', integration_type: 'slack' },
  error: null
}))
const mockUpdateSingle = vi.fn(() => Promise.resolve({
  data: { id: 'int-1', is_enabled: true },
  error: null
}))
const mockDelete = vi.fn(() => Promise.resolve({ error: null }))
const mockLogInsert = vi.fn(() => Promise.resolve({ error: null }))

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'integration_logs') {
        return { insert: mockLogInsert }
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockSelectOrder,
            eq: vi.fn(() => ({
              single: mockSelectSingle,
            })),
            single: mockSelectSingle,
          })),
        })),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockUpsertSingle,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: mockUpdateSingle,
              })),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: mockDelete,
          })),
        })),
      }
    }),
  },
}))

describe('integrations CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all integrations for user', async () => {
      const result = await integrations.getAll('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].integration_type).toBe('slack')
    })

    it('should return empty array when no integrations', async () => {
      mockSelectOrder.mockResolvedValueOnce({ data: null, error: null })

      const result = await integrations.getAll('user-123')

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      mockSelectOrder.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(integrations.getAll('user-123')).rejects.toThrow()
    })
  })

  describe('get', () => {
    it('should return specific integration', async () => {
      const result = await integrations.get('user-123', 'slack')

      expect(result).toBeDefined()
      expect(result.integration_type).toBe('slack')
    })

    it('should return null when not found (PGRST116)', async () => {
      mockSelectSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const result = await integrations.get('user-123', 'unknown')

      expect(result).toBeNull()
    })

    it('should throw on other database errors', async () => {
      mockSelectSingle.mockResolvedValueOnce({ data: null, error: { code: 'OTHER', message: 'Error' } })

      await expect(integrations.get('user-123', 'slack')).rejects.toThrow()
    })
  })

  describe('upsert', () => {
    it('should create or update integration', async () => {
      const config = { webhook_url: 'https://hooks.slack.com/...' }
      const result = await integrations.upsert('user-123', 'slack', config)

      expect(result).toBeDefined()
      expect(result.integration_type).toBe('slack')
    })

    it('should include notify_on when provided', async () => {
      const config = { webhook_url: 'https://hooks.slack.com/...' }
      const notifyOn = ['critical_incidents', 'high_incidents']
      const result = await integrations.upsert('user-123', 'slack', config, notifyOn)

      expect(result).toBeDefined()
    })

    it('should throw on database error', async () => {
      mockUpsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(integrations.upsert('user-123', 'slack', {})).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('should update integration settings', async () => {
      const result = await integrations.update('user-123', 'slack', { is_enabled: true })

      expect(result).toBeDefined()
      expect(result.is_enabled).toBe(true)
    })

    it('should throw on database error', async () => {
      mockUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(integrations.update('user-123', 'slack', {})).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete integration', async () => {
      const result = await integrations.delete('user-123', 'slack')

      expect(result).toBe(true)
    })

    it('should throw on database error', async () => {
      mockDelete.mockResolvedValueOnce({ error: { message: 'Error' } })

      await expect(integrations.delete('user-123', 'slack')).rejects.toThrow()
    })
  })

  describe('toggle', () => {
    it('should toggle integration enabled state', async () => {
      const result = await integrations.toggle('user-123', 'slack', true)

      expect(result).toBeDefined()
    })
  })

  describe('test', () => {
    it('should return success for unknown integration type', async () => {
      const result = await integrations.test('servicenow', {})

      expect(result.success).toBe(true)
      expect(result.message).toBe('Configuration saved')
    })
  })

  describe('log', () => {
    it('should log integration activity', async () => {
      await integrations.log('int-1', 'user-123', 'incident_sent', { id: '123' })

      expect(mockLogInsert).toHaveBeenCalled()
    })

    it('should handle log error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockLogInsert.mockResolvedValueOnce({ error: { message: 'Log error' } })

      await integrations.log('int-1', 'user-123', 'error', {}, 'error', 'Failed')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

describe('INTEGRATION_TYPES', () => {
  it('should define all expected integration types', () => {
    const expectedTypes = ['slack', 'teams', 'jira', 'servicenow', 'pagerduty', 'webhook', 'splunk', 'elastic', 'sentinel']
    expectedTypes.forEach(type => {
      expect(INTEGRATION_TYPES[type]).toBeDefined()
    })
  })

  it('should have required fields for each integration', () => {
    Object.entries(INTEGRATION_TYPES).forEach(([type, config]) => {
      expect(config.name).toBeDefined()
      expect(config.description).toBeDefined()
      expect(config.icon).toBeDefined()
      expect(Array.isArray(config.requiredFields)).toBe(true)
      expect(config.requiredFields.length).toBeGreaterThan(0)
    })
  })

  it('should have webhook_url as required for Slack', () => {
    expect(INTEGRATION_TYPES.slack.requiredFields).toContain('webhook_url')
  })

  it('should have webhook_url as required for Teams', () => {
    expect(INTEGRATION_TYPES.teams.requiredFields).toContain('webhook_url')
  })

  it('should have correct required fields for Jira', () => {
    const jiraRequired = INTEGRATION_TYPES.jira.requiredFields
    expect(jiraRequired).toContain('site_url')
    expect(jiraRequired).toContain('email')
    expect(jiraRequired).toContain('api_token')
    expect(jiraRequired).toContain('project_key')
  })
})

describe('NOTIFICATION_EVENTS', () => {
  it('should define expected notification events', () => {
    expect(NOTIFICATION_EVENTS.critical_incidents).toBeDefined()
    expect(NOTIFICATION_EVENTS.high_incidents).toBeDefined()
    expect(NOTIFICATION_EVENTS.watchlist_updates).toBeDefined()
    expect(NOTIFICATION_EVENTS.new_kevs).toBeDefined()
    expect(NOTIFICATION_EVENTS.actor_escalations).toBeDefined()
  })
})

describe('slack formatters', () => {
  const mockIncident = {
    id: '123',
    victim_name: 'Acme Corp',
    victim_sector: 'finance',
    victim_country: 'US',
    status: 'Claimed',
    severity: 'high',
    threat_actor: { name: 'LockBit' },
  }

  const mockVuln = {
    cve_id: 'CVE-2024-1234',
    description: 'A critical vulnerability in Example Software',
    cvss_score: 9.8,
    vendor: 'Example Vendor',
  }

  const mockActor = {
    id: '456',
    name: 'LockBit',
    incident_velocity: 3.5,
    incidents_7d: 25,
    target_sectors: ['finance', 'healthcare', 'education'],
  }

  describe('formatIncident', () => {
    it('should format incident for Slack', () => {
      const result = slack.formatIncident(mockIncident)

      expect(result.blocks).toBeDefined()
      expect(result.attachments).toBeDefined()
      expect(result.blocks.length).toBeGreaterThan(0)
    })

    it('should include header with victim name', () => {
      const result = slack.formatIncident(mockIncident)
      const header = result.blocks.find(b => b.type === 'header')
      expect(header.text.text).toContain('Acme Corp')
    })

    it('should include actor information in fields', () => {
      const result = slack.formatIncident(mockIncident)
      const section = result.blocks.find(b => b.type === 'section' && b.fields)
      expect(section.fields.some(f => f.text.includes('LockBit'))).toBe(true)
    })

    it('should include View in Vigil button', () => {
      const result = slack.formatIncident(mockIncident)
      const actions = result.blocks.find(b => b.type === 'actions')
      expect(actions.elements[0].url).toContain('vigil.theintelligence.company')
      expect(actions.elements[0].url).toContain(mockIncident.id)
    })

    it('should handle missing threat actor', () => {
      const incidentNoActor = { ...mockIncident, threat_actor: null }
      const result = slack.formatIncident(incidentNoActor)
      const section = result.blocks.find(b => b.type === 'section' && b.fields)
      expect(section.fields.some(f => f.text.includes('Unknown'))).toBe(true)
    })

    it('should set color based on severity', () => {
      const result = slack.formatIncident(mockIncident)
      expect(result.attachments[0].color).toBe('#f97316') // high = orange
    })
  })

  describe('formatKEV', () => {
    it('should format KEV for Slack', () => {
      const result = slack.formatKEV(mockVuln)

      expect(result.blocks).toBeDefined()
      expect(result.blocks.length).toBeGreaterThan(0)
    })

    it('should include CVE ID in header', () => {
      const result = slack.formatKEV(mockVuln)
      const header = result.blocks.find(b => b.type === 'header')
      expect(header.text.text).toContain('CVE-2024-1234')
    })

    it('should include CVSS score', () => {
      const result = slack.formatKEV(mockVuln)
      const section = result.blocks.find(b => b.type === 'section' && b.fields)
      expect(section.fields.some(f => f.text.includes('9.8'))).toBe(true)
    })

    it('should truncate long descriptions', () => {
      const longDesc = 'A'.repeat(600)
      const vulnLongDesc = { ...mockVuln, description: longDesc }
      const result = slack.formatKEV(vulnLongDesc)
      const section = result.blocks.find(b => b.type === 'section' && b.text)
      expect(section.text.text.length).toBeLessThanOrEqual(500)
    })
  })

  describe('formatActorEscalation', () => {
    it('should format actor escalation for Slack', () => {
      const result = slack.formatActorEscalation(mockActor)

      expect(result.blocks).toBeDefined()
      expect(result.blocks.length).toBeGreaterThan(0)
    })

    it('should include actor name in header', () => {
      const result = slack.formatActorEscalation(mockActor)
      const header = result.blocks.find(b => b.type === 'header')
      expect(header.text.text).toContain('LockBit')
    })

    it('should include incident velocity', () => {
      const result = slack.formatActorEscalation(mockActor)
      const section = result.blocks.find(b => b.type === 'section' && b.text)
      expect(section.text.text).toContain('3.5')
    })

    it('should include 7-day incident count', () => {
      const result = slack.formatActorEscalation(mockActor)
      const section = result.blocks.find(b => b.type === 'section' && b.fields)
      expect(section.fields.some(f => f.text.includes('25'))).toBe(true)
    })
  })
})

describe('teams formatters', () => {
  const mockIncident = {
    id: '123',
    victim_name: 'Acme Corp',
    victim_sector: 'finance',
    victim_country: 'US',
    status: 'Claimed',
    threat_actor: { name: 'LockBit' },
  }

  const mockVuln = {
    cve_id: 'CVE-2024-1234',
    description: 'A critical vulnerability',
    cvss_score: 9.8,
    vendor: 'Example Vendor',
  }

  describe('formatIncident', () => {
    it('should format incident as Teams MessageCard', () => {
      const result = teams.formatIncident(mockIncident)

      expect(result['@type']).toBe('MessageCard')
      expect(result['@context']).toBe('http://schema.org/extensions')
      expect(result.sections).toBeDefined()
    })

    it('should include victim name in summary', () => {
      const result = teams.formatIncident(mockIncident)
      expect(result.summary).toContain('Acme Corp')
    })

    it('should include facts with actor, sector, country', () => {
      const result = teams.formatIncident(mockIncident)
      const facts = result.sections[0].facts
      expect(facts.some(f => f.name === 'Actor' && f.value === 'LockBit')).toBe(true)
      expect(facts.some(f => f.name === 'Sector' && f.value === 'finance')).toBe(true)
      expect(facts.some(f => f.name === 'Country' && f.value === 'US')).toBe(true)
    })

    it('should include action button', () => {
      const result = teams.formatIncident(mockIncident)
      expect(result.potentialAction).toBeDefined()
      expect(result.potentialAction[0].name).toBe('View in Vigil')
    })
  })

  describe('formatKEV', () => {
    it('should format KEV as Teams MessageCard', () => {
      const result = teams.formatKEV(mockVuln)

      expect(result['@type']).toBe('MessageCard')
      expect(result.summary).toContain('CVE-2024-1234')
    })

    it('should include CVSS in facts', () => {
      const result = teams.formatKEV(mockVuln)
      const facts = result.sections[0].facts
      expect(facts.some(f => f.name === 'CVSS' && f.value === '9.8')).toBe(true)
    })
  })
})

describe('jira formatters', () => {
  const mockIncident = {
    id: '123',
    victim_name: 'Acme Corp',
    victim_sector: 'finance',
    victim_country: 'US',
    status: 'Claimed',
    severity: 'critical',
    discovered_date: '2024-01-15',
    threat_actor: { name: 'LockBit' },
  }

  describe('formatIncident', () => {
    it('should format incident for Jira', () => {
      const result = jira.formatIncident(mockIncident)

      expect(result.summary).toBeDefined()
      expect(result.description).toBeDefined()
      expect(result.priority).toBeDefined()
      expect(result.labels).toBeDefined()
    })

    it('should include [Vigil] prefix in summary', () => {
      const result = jira.formatIncident(mockIncident)
      expect(result.summary).toMatch(/^\[Vigil\]/)
    })

    it('should include victim name in summary', () => {
      const result = jira.formatIncident(mockIncident)
      expect(result.summary).toContain('Acme Corp')
    })

    it('should map severity to Jira priority', () => {
      const criticalResult = jira.formatIncident({ ...mockIncident, severity: 'critical' })
      expect(criticalResult.priority).toBe('Highest')

      const highResult = jira.formatIncident({ ...mockIncident, severity: 'high' })
      expect(highResult.priority).toBe('High')

      const mediumResult = jira.formatIncident({ ...mockIncident, severity: 'medium' })
      expect(mediumResult.priority).toBe('Medium')

      const lowResult = jira.formatIncident({ ...mockIncident, severity: 'low' })
      expect(lowResult.priority).toBe('Low')
    })

    it('should include vigil and ransomware labels', () => {
      const result = jira.formatIncident(mockIncident)
      expect(result.labels).toContain('vigil')
      expect(result.labels).toContain('ransomware')
    })

    it('should include actor name as label', () => {
      const result = jira.formatIncident(mockIncident)
      expect(result.labels).toContain('lockbit')
    })

    it('should include all details in description', () => {
      const result = jira.formatIncident(mockIncident)
      expect(result.description).toContain('LockBit')
      expect(result.description).toContain('Acme Corp')
      expect(result.description).toContain('finance')
      expect(result.description).toContain('US')
    })
  })
})

describe('siemFormats', () => {
  const mockIOCs = [
    {
      created_at: '2024-01-15T10:00:00Z',
      value: '192.168.1.1',
      type: 'ip',
      confidence: 85,
      malware_family: 'Cobalt Strike',
      threat_actor: { name: 'APT29' },
    },
    {
      created_at: '2024-01-14T12:00:00Z',
      value: 'evil.com',
      type: 'domain',
      confidence: 60,
      malware_family: null,
      threat_actor: null,
    },
  ]

  describe('splunkIOCs', () => {
    it('should format IOCs for Splunk HEC', () => {
      const result = siemFormats.splunkIOCs(mockIOCs)

      expect(result).toHaveLength(2)
      expect(result[0].time).toBeDefined()
      expect(result[0].event).toBeDefined()
    })

    it('should include correct event fields', () => {
      const result = siemFormats.splunkIOCs(mockIOCs)

      expect(result[0].event.type).toBe('ioc')
      expect(result[0].event.value).toBe('192.168.1.1')
      expect(result[0].event.ioc_type).toBe('ip')
      expect(result[0].event.confidence).toBe(85)
      expect(result[0].event.malware_family).toBe('Cobalt Strike')
      expect(result[0].event.actor).toBe('APT29')
      expect(result[0].event.source).toBe('vigil')
    })

    it('should convert timestamp to Unix epoch', () => {
      const result = siemFormats.splunkIOCs(mockIOCs)
      const expectedTime = new Date('2024-01-15T10:00:00Z').getTime() / 1000
      expect(result[0].time).toBe(expectedTime)
    })
  })

  describe('elasticIOCs', () => {
    it('should format IOCs for Elasticsearch', () => {
      const result = siemFormats.elasticIOCs(mockIOCs)

      expect(result).toHaveLength(2)
      expect(result[0]['@timestamp']).toBeDefined()
      expect(result[0].event).toBeDefined()
      expect(result[0].threat).toBeDefined()
    })

    it('should use ECS-compliant schema', () => {
      const result = siemFormats.elasticIOCs(mockIOCs)

      expect(result[0].event.kind).toBe('enrichment')
      expect(result[0].event.category).toBe('threat')
      expect(result[0].threat.indicator.type).toBe('ip')
      expect(result[0].threat.indicator.provider).toBe('vigil')
    })

    it('should map confidence to High/Medium/Low', () => {
      const result = siemFormats.elasticIOCs(mockIOCs)

      expect(result[0].threat.indicator.confidence).toBe('High') // 85 > 75
      expect(result[1].threat.indicator.confidence).toBe('Medium') // 60 > 50
    })

    it('should include malware family as software', () => {
      const result = siemFormats.elasticIOCs(mockIOCs)

      expect(result[0].threat.software.name).toBe('Cobalt Strike')
      expect(result[1].threat.software).toBeUndefined()
    })
  })

  describe('sentinelIOCs', () => {
    it('should format IOCs for Microsoft Sentinel', () => {
      const result = siemFormats.sentinelIOCs(mockIOCs)

      expect(result).toHaveLength(2)
      expect(result[0].TimeGenerated).toBeDefined()
      expect(result[0].IndicatorType).toBeDefined()
      expect(result[0].IndicatorValue).toBeDefined()
    })

    it('should include required Sentinel fields', () => {
      const result = siemFormats.sentinelIOCs(mockIOCs)

      expect(result[0].IndicatorType).toBe('ip')
      expect(result[0].IndicatorValue).toBe('192.168.1.1')
      expect(result[0].Confidence).toBe(85)
      expect(result[0].ThreatType).toBe('Cobalt Strike')
      expect(result[0].SourceSystem).toBe('Vigil')
    })

    it('should set expiration date 30 days in future', () => {
      const result = siemFormats.sentinelIOCs(mockIOCs)
      const expiration = new Date(result[0].ExpirationDateTime)
      const now = new Date()
      const daysDiff = (expiration - now) / (1000 * 60 * 60 * 24)

      expect(daysDiff).toBeGreaterThan(29)
      expect(daysDiff).toBeLessThan(31)
    })

    it('should handle missing malware family', () => {
      const result = siemFormats.sentinelIOCs(mockIOCs)
      expect(result[1].ThreatType).toBe('Unknown')
    })
  })
})
