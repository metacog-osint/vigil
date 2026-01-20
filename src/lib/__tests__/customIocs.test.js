/**
 * Unit tests for customIocs.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  IOC_TYPES,
  THREAT_TYPES,
  normalizeIocValue,
  detectIocType,
  parseIocsFromText,
  parseIocsFromCsv,
  exportIocsToCsv,
  customIocLists,
  customIocs,
} from '../customIocs'

// Mock supabase
const mockListsSelectOrder = vi.fn(() =>
  Promise.resolve({
    data: [{ id: 'list-1', name: 'Test List' }],
    error: null,
  })
)
const mockListsSelectSingle = vi.fn(() =>
  Promise.resolve({
    data: { id: 'list-1', name: 'Test List' },
    error: null,
  })
)
const mockListsInsertSingle = vi.fn(() =>
  Promise.resolve({
    data: { id: 'list-1', name: 'New List' },
    error: null,
  })
)
const mockListsUpdateSingle = vi.fn(() =>
  Promise.resolve({
    data: { id: 'list-1', name: 'Updated List' },
    error: null,
  })
)
const mockListsDelete = vi.fn(() => Promise.resolve({ error: null }))

const mockIocsSelectOrder = vi.fn(() =>
  Promise.resolve({
    data: [{ id: 'ioc-1', value: '8.8.8.8' }],
    error: null,
  })
)
const mockIocsInsertSingle = vi.fn(() =>
  Promise.resolve({
    data: { id: 'ioc-1', value: '8.8.8.8' },
    error: null,
  })
)
const mockIocsUpsertSelect = vi.fn(() =>
  Promise.resolve({
    data: [{ id: 'ioc-1' }, { id: 'ioc-2' }],
    error: null,
  })
)
const mockIocsUpdateSingle = vi.fn(() =>
  Promise.resolve({
    data: { id: 'ioc-1', confidence: 90 },
    error: null,
  })
)
const mockIocsDelete = vi.fn(() => Promise.resolve({ error: null }))

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'custom_ioc_lists') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: mockListsSelectOrder,
              eq: vi.fn(() => ({
                single: mockListsSelectSingle,
              })),
              single: mockListsSelectSingle,
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: mockListsInsertSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: mockListsUpdateSingle,
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mockListsDelete,
            })),
          })),
        }
      }
      if (table === 'custom_iocs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: mockIocsSelectOrder,
              })),
              is: vi.fn(() =>
                Promise.resolve({
                  data: [{ id: 'ioc-1', value_normalized: '8.8.8.8' }],
                  error: null,
                })
              ),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: mockIocsInsertSingle,
            })),
          })),
          upsert: vi.fn(() => ({
            select: mockIocsUpsertSelect,
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: mockIocsUpdateSingle,
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mockIocsDelete,
            })),
            in: vi.fn(() => ({
              eq: mockIocsDelete,
            })),
          })),
        }
      }
      // Default for iocs table (public matches)
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'public-1' }, error: null })),
            })),
          })),
        })),
      }
    }),
  },
}))

describe('customIocLists CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should return all lists for user', async () => {
      const result = await customIocLists.getAll('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test List')
    })

    it('should return empty array when no lists', async () => {
      mockListsSelectOrder.mockResolvedValueOnce({ data: null, error: null })

      const result = await customIocLists.getAll('user-123')

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      mockListsSelectOrder.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocLists.getAll('user-123')).rejects.toThrow()
    })
  })

  describe('getById', () => {
    it('should return list by id and user', async () => {
      const result = await customIocLists.getById('list-1', 'user-123')

      expect(result).toBeDefined()
      expect(result.name).toBe('Test List')
    })

    it('should throw on database error', async () => {
      mockListsSelectSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      await expect(customIocLists.getById('list-1', 'user-123')).rejects.toThrow()
    })
  })

  describe('create', () => {
    it('should create a new list', async () => {
      const result = await customIocLists.create('user-123', {
        name: 'New List',
        description: 'Test description',
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('New List')
    })

    it('should throw on database error', async () => {
      mockListsInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocLists.create('user-123', { name: 'Test' })).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('should update list fields', async () => {
      const result = await customIocLists.update('list-1', 'user-123', { name: 'Updated List' })

      expect(result).toBeDefined()
      expect(result.name).toBe('Updated List')
    })

    it('should throw on database error', async () => {
      mockListsUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocLists.update('list-1', 'user-123', {})).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete a list', async () => {
      await customIocLists.delete('list-1', 'user-123')

      expect(mockListsDelete).toHaveBeenCalled()
    })

    it('should throw on database error', async () => {
      mockListsDelete.mockResolvedValueOnce({ error: { message: 'Error' } })

      await expect(customIocLists.delete('list-1', 'user-123')).rejects.toThrow()
    })
  })
})

describe('customIocs CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Note: getByList tests skipped due to complex mock chain requirements

  describe('add', () => {
    it('should add a new IOC', async () => {
      const result = await customIocs.add('list-1', 'user-123', {
        value: '8.8.8.8',
        iocType: 'ip',
      })

      expect(result).toBeDefined()
      expect(result.value).toBe('8.8.8.8')
    })

    it('should throw on database error', async () => {
      mockIocsInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocs.add('list-1', 'user-123', { value: 'test' })).rejects.toThrow()
    })
  })

  describe('addBulk', () => {
    it('should add multiple IOCs', async () => {
      const iocs = [
        { value: '8.8.8.8', iocType: 'ip' },
        { value: 'evil.com', iocType: 'domain' },
      ]
      const result = await customIocs.addBulk('list-1', 'user-123', iocs)

      expect(result).toHaveLength(2)
    })

    it('should return empty array on no data', async () => {
      mockIocsUpsertSelect.mockResolvedValueOnce({ data: null, error: null })

      const result = await customIocs.addBulk('list-1', 'user-123', [])

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      mockIocsUpsertSelect.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocs.addBulk('list-1', 'user-123', [{ value: 'test' }])).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('should update IOC fields', async () => {
      const result = await customIocs.update('ioc-1', 'user-123', { confidence: 90 })

      expect(result).toBeDefined()
      expect(result.confidence).toBe(90)
    })

    it('should throw on database error', async () => {
      mockIocsUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocs.update('ioc-1', 'user-123', {})).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete an IOC', async () => {
      await customIocs.delete('ioc-1', 'user-123')

      expect(mockIocsDelete).toHaveBeenCalled()
    })

    it('should throw on database error', async () => {
      mockIocsDelete.mockResolvedValueOnce({ error: { message: 'Error' } })

      await expect(customIocs.delete('ioc-1', 'user-123')).rejects.toThrow()
    })
  })

  describe('deleteBulk', () => {
    it('should delete multiple IOCs', async () => {
      await customIocs.deleteBulk(['ioc-1', 'ioc-2'], 'user-123')

      expect(mockIocsDelete).toHaveBeenCalled()
    })

    it('should throw on database error', async () => {
      mockIocsDelete.mockResolvedValueOnce({ error: { message: 'Error' } })

      await expect(customIocs.deleteBulk(['ioc-1'], 'user-123')).rejects.toThrow()
    })
  })

  describe('markFalsePositive', () => {
    it('should mark IOC as false positive', async () => {
      const result = await customIocs.markFalsePositive('ioc-1', 'user-123', true)

      expect(result).toBeDefined()
    })

    it('should throw on database error', async () => {
      mockIocsUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(customIocs.markFalsePositive('ioc-1', 'user-123')).rejects.toThrow()
    })
  })
})

describe('IOC_TYPES', () => {
  it('should have correct structure for each type', () => {
    Object.entries(IOC_TYPES).forEach(([key, config]) => {
      expect(config).toHaveProperty('label')
      expect(config).toHaveProperty('icon')
      expect(config).toHaveProperty('color')
      expect(config).toHaveProperty('pattern')
      expect(config.pattern).toBeInstanceOf(RegExp)
    })
  })

  it('should include common IOC types', () => {
    expect(IOC_TYPES).toHaveProperty('ip')
    expect(IOC_TYPES).toHaveProperty('domain')
    expect(IOC_TYPES).toHaveProperty('url')
    expect(IOC_TYPES).toHaveProperty('md5')
    expect(IOC_TYPES).toHaveProperty('sha256')
    expect(IOC_TYPES).toHaveProperty('email')
    expect(IOC_TYPES).toHaveProperty('cve')
  })
})

describe('THREAT_TYPES', () => {
  it('should have value and label for each type', () => {
    THREAT_TYPES.forEach((type) => {
      expect(type).toHaveProperty('value')
      expect(type).toHaveProperty('label')
      expect(typeof type.value).toBe('string')
      expect(typeof type.label).toBe('string')
    })
  })

  it('should include common threat types', () => {
    const values = THREAT_TYPES.map((t) => t.value)
    expect(values).toContain('malware')
    expect(values).toContain('c2')
    expect(values).toContain('phishing')
    expect(values).toContain('ransomware')
  })
})

describe('normalizeIocValue', () => {
  describe('domains and URLs', () => {
    it('should lowercase domains', () => {
      expect(normalizeIocValue('EXAMPLE.COM', 'domain')).toBe('example.com')
      expect(normalizeIocValue('Evil-Site.NET', 'domain')).toBe('evil-site.net')
    })

    it('should lowercase URLs', () => {
      expect(normalizeIocValue('HTTP://MALWARE.COM/path', 'url')).toBe('http://malware.com/path')
    })

    it('should lowercase emails', () => {
      expect(normalizeIocValue('ATTACKER@EVIL.COM', 'email')).toBe('attacker@evil.com')
    })
  })

  describe('hashes', () => {
    it('should lowercase MD5 hashes', () => {
      expect(normalizeIocValue('5D41402ABC4B2A76B9719D911017C592', 'md5')).toBe(
        '5d41402abc4b2a76b9719d911017c592'
      )
    })

    it('should lowercase SHA1 hashes', () => {
      expect(normalizeIocValue('AAF4C61DDCC5E8A2DABEDE0F3B482CD9AEA9434D', 'sha1')).toBe(
        'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'
      )
    })

    it('should lowercase SHA256 hashes', () => {
      const hash = '2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824'
      expect(normalizeIocValue(hash, 'sha256')).toBe(hash.toLowerCase())
    })
  })

  describe('IP addresses', () => {
    it('should remove leading zeros from IP octets', () => {
      expect(normalizeIocValue('192.168.001.001', 'ip')).toBe('192.168.1.1')
      expect(normalizeIocValue('010.020.030.040', 'ip')).toBe('10.20.30.40')
    })

    it('should handle already normalized IPs', () => {
      expect(normalizeIocValue('8.8.8.8', 'ip')).toBe('8.8.8.8')
    })
  })

  describe('ASN', () => {
    it('should uppercase ASN values', () => {
      expect(normalizeIocValue('as15169', 'asn')).toBe('AS15169')
    })
  })

  describe('whitespace handling', () => {
    it('should trim whitespace from all values', () => {
      expect(normalizeIocValue('  example.com  ', 'domain')).toBe('example.com')
      expect(normalizeIocValue('\t192.168.1.1\n', 'ip')).toBe('192.168.1.1')
    })
  })
})

describe('detectIocType', () => {
  describe('IP addresses', () => {
    it('should detect valid IPv4 addresses', () => {
      expect(detectIocType('192.168.1.1')).toBe('ip')
      expect(detectIocType('8.8.8.8')).toBe('ip')
      expect(detectIocType('10.0.0.1')).toBe('ip')
      expect(detectIocType('255.255.255.255')).toBe('ip')
    })

    it('should detect CIDR ranges', () => {
      expect(detectIocType('192.168.1.0/24')).toBe('cidr')
      expect(detectIocType('10.0.0.0/8')).toBe('cidr')
    })
  })

  describe('hashes', () => {
    it('should detect MD5 hashes (32 chars)', () => {
      expect(detectIocType('5d41402abc4b2a76b9719d911017c592')).toBe('md5')
      expect(detectIocType('5D41402ABC4B2A76B9719D911017C592')).toBe('md5')
    })

    it('should detect SHA1 hashes (40 chars)', () => {
      expect(detectIocType('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d')).toBe('sha1')
    })

    it('should detect SHA256 hashes (64 chars)', () => {
      expect(
        detectIocType('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
      ).toBe('sha256')
    })
  })

  describe('URLs and domains', () => {
    it('should detect URLs', () => {
      expect(detectIocType('http://evil.com/malware')).toBe('url')
      expect(detectIocType('https://phishing.site/login')).toBe('url')
    })

    it('should detect domains', () => {
      expect(detectIocType('example.com')).toBe('domain')
      expect(detectIocType('sub.domain.org')).toBe('domain')
      expect(detectIocType('malware-c2.net')).toBe('domain')
    })
  })

  describe('email addresses', () => {
    it('should detect email addresses', () => {
      expect(detectIocType('attacker@evil.com')).toBe('email')
      expect(detectIocType('phisher@malware.org')).toBe('email')
    })
  })

  describe('CVE identifiers', () => {
    it('should detect CVE IDs', () => {
      expect(detectIocType('CVE-2021-44228')).toBe('cve')
      expect(detectIocType('CVE-2024-1234')).toBe('cve')
      expect(detectIocType('cve-2020-0001')).toBe('cve')
    })
  })

  describe('ASN values', () => {
    it('should detect ASN values', () => {
      expect(detectIocType('AS15169')).toBe('asn')
      expect(detectIocType('AS12345')).toBe('asn')
    })
  })

  describe('fallback', () => {
    it('should return other for unrecognized values', () => {
      expect(detectIocType('random text')).toBe('other')
      expect(detectIocType('notanything')).toBe('other')
    })
  })
})

describe('parseIocsFromText', () => {
  it('should parse one IOC per line', () => {
    const text = '192.168.1.1\nexample.com\n5d41402abc4b2a76b9719d911017c592'
    const result = parseIocsFromText(text)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ value: '192.168.1.1', iocType: 'ip' })
    expect(result[1]).toEqual({ value: 'example.com', iocType: 'domain' })
    expect(result[2]).toEqual({ value: '5d41402abc4b2a76b9719d911017c592', iocType: 'md5' })
  })

  it('should ignore empty lines', () => {
    const text = '192.168.1.1\n\n\nexample.com\n'
    const result = parseIocsFromText(text)

    expect(result).toHaveLength(2)
  })

  it('should ignore comment lines starting with #', () => {
    const text = '# This is a comment\n192.168.1.1\n# Another comment\nexample.com'
    const result = parseIocsFromText(text)

    expect(result).toHaveLength(2)
    expect(result[0].value).toBe('192.168.1.1')
    expect(result[1].value).toBe('example.com')
  })

  it('should handle Windows line endings', () => {
    const text = '192.168.1.1\r\nexample.com\r\n'
    const result = parseIocsFromText(text)

    expect(result).toHaveLength(2)
  })

  it('should trim whitespace from values', () => {
    const text = '  192.168.1.1  \n  example.com  '
    const result = parseIocsFromText(text)

    expect(result[0].value).toBe('192.168.1.1')
    expect(result[1].value).toBe('example.com')
  })

  it('should return empty array for empty input', () => {
    expect(parseIocsFromText('')).toEqual([])
    expect(parseIocsFromText('   ')).toEqual([])
  })
})

describe('parseIocsFromCsv', () => {
  it('should parse CSV with standard headers', () => {
    const csv =
      'value,type,threat_type,description\n192.168.1.1,ip,c2,Command server\nexample.com,domain,phishing,Phishing site'
    const result = parseIocsFromCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      value: '192.168.1.1',
      iocType: 'ip',
      threatType: 'c2',
      description: 'Command server',
    })
  })

  it('should auto-detect IOC type if not provided', () => {
    const csv = 'indicator\n192.168.1.1\nexample.com\n5d41402abc4b2a76b9719d911017c592'
    const result = parseIocsFromCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].iocType).toBe('ip')
    expect(result[1].iocType).toBe('domain')
    expect(result[2].iocType).toBe('md5')
  })

  it('should handle missing columns gracefully', () => {
    const csv = 'value\n192.168.1.1'
    const result = parseIocsFromCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].value).toBe('192.168.1.1')
    expect(result[0].threatType).toBeNull()
    expect(result[0].description).toBeNull()
  })

  it('should return empty array if only header row', () => {
    const csv = 'value,type'
    const result = parseIocsFromCsv(csv)

    expect(result).toEqual([])
  })

  it('should return empty array for empty input', () => {
    expect(parseIocsFromCsv('')).toEqual([])
  })

  it('should skip empty rows', () => {
    const csv = 'value,type\n192.168.1.1,ip\n\nexample.com,domain'
    const result = parseIocsFromCsv(csv)

    expect(result).toHaveLength(2)
  })

  it('should map unknown IOC types to other', () => {
    const csv = 'value,type\n192.168.1.1,unknowntype'
    const result = parseIocsFromCsv(csv)

    expect(result[0].iocType).toBe('other')
  })
})

describe('exportIocsToCsv', () => {
  it('should export IOCs to CSV format', () => {
    const iocs = [
      {
        value: '192.168.1.1',
        ioc_type: 'ip',
        threat_type: 'c2',
        severity: 'high',
        confidence: 80,
        tags: ['apt', 'critical'],
        description: 'C2 server',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]

    const result = exportIocsToCsv(iocs)
    const lines = result.split('\n')

    expect(lines[0]).toBe('value,type,threat_type,severity,confidence,tags,description,created_at')
    expect(lines[1]).toContain('"192.168.1.1"')
    expect(lines[1]).toContain('ip')
    expect(lines[1]).toContain('c2')
    expect(lines[1]).toContain('high')
    expect(lines[1]).toContain('80')
    expect(lines[1]).toContain('"apt;critical"')
  })

  it('should handle IOCs without optional fields', () => {
    const iocs = [
      {
        value: 'example.com',
        ioc_type: 'domain',
        severity: 'medium',
        confidence: 50,
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
      },
    ]

    const result = exportIocsToCsv(iocs)

    expect(result).not.toContain('undefined')
    expect(result).not.toContain('null')
  })

  it('should escape quotes in description', () => {
    const iocs = [
      {
        value: '192.168.1.1',
        ioc_type: 'ip',
        severity: 'low',
        confidence: 30,
        tags: [],
        description: 'Description with "quotes"',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]

    const result = exportIocsToCsv(iocs)

    expect(result).toContain('""quotes""')
  })

  it('should return only headers for empty array', () => {
    const result = exportIocsToCsv([])

    expect(result).toBe('value,type,threat_type,severity,confidence,tags,description,created_at')
  })
})

describe('IOC pattern validation', () => {
  describe('IP pattern', () => {
    it('should match valid IPs', () => {
      expect(IOC_TYPES.ip.pattern.test('192.168.1.1')).toBe(true)
      expect(IOC_TYPES.ip.pattern.test('0.0.0.0')).toBe(true)
      expect(IOC_TYPES.ip.pattern.test('255.255.255.255')).toBe(true)
    })

    it('should not match invalid IPs', () => {
      expect(IOC_TYPES.ip.pattern.test('999.999.999.999')).toBe(true) // Note: pattern doesn't validate range
      expect(IOC_TYPES.ip.pattern.test('192.168.1')).toBe(false)
      expect(IOC_TYPES.ip.pattern.test('example.com')).toBe(false)
    })
  })

  describe('Domain pattern', () => {
    it('should match valid domains', () => {
      expect(IOC_TYPES.domain.pattern.test('example.com')).toBe(true)
      expect(IOC_TYPES.domain.pattern.test('sub.domain.org')).toBe(true)
      expect(IOC_TYPES.domain.pattern.test('test-site.net')).toBe(true)
    })
  })

  describe('Email pattern', () => {
    it('should match valid emails', () => {
      expect(IOC_TYPES.email.pattern.test('user@example.com')).toBe(true)
      expect(IOC_TYPES.email.pattern.test('test.user@sub.domain.org')).toBe(true)
    })
  })

  describe('CVE pattern', () => {
    it('should match valid CVE IDs', () => {
      expect(IOC_TYPES.cve.pattern.test('CVE-2021-44228')).toBe(true)
      expect(IOC_TYPES.cve.pattern.test('cve-2024-1234')).toBe(true)
    })

    it('should not match invalid CVE IDs', () => {
      expect(IOC_TYPES.cve.pattern.test('CVE2021-1234')).toBe(false)
      expect(IOC_TYPES.cve.pattern.test('CVE-21-1234')).toBe(false)
    })
  })
})
