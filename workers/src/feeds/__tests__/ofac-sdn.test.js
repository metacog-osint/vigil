import { describe, it, expect } from 'vitest'

// ?raw so the fixture loads the same way under any test environment; the tests run
// under jsdom, where import.meta.url is not a file:// URL.
import XML from './fixtures/sdn-sample.xml?raw'
import { parseEntries } from '../ofac-sdn.js'

/**
 * The OFAC parser reads a 29 MB document by regex against a streamed buffer, which
 * works until Treasury changes the shape of an element. This replays a trimmed copy
 * of that shape so a format change fails here rather than as a quiet drop in the
 * number of sanctioned addresses - the kind of failure that looks like "OFAC
 * delisted some people" and is the last thing a sanctions claim should be built on.
 *
 * The fixture's addresses are synthetic. See the note inside it.
 */

/**
 * Serves the document in small pieces, so entries straddle chunk boundaries the way
 * they do against the real 29 MB response. A parser that only works when each read
 * happens to contain whole entries passes on one big chunk and fails in production.
 */
function streamOf(text, chunkSize) {
  const bytes = new TextEncoder().encode(text)
  let offset = 0

  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close()
        return
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    },
  })
}

describe('OFAC SDN parser', () => {
  it('keeps only entries that carry a digital currency address', async () => {
    const rows = await parseEntries(streamOf(XML, 64))

    // Four entries in the fixture; two of them have addresses, one of those has two.
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.entity_name).sort()).toEqual([
      'EXAMPLE THREAT GROUP',
      'EXAMPLEPERSON, PAT',
      'EXAMPLEPERSON, PAT',
    ])
  })

  it('reads an entity entry whole: address, currency, programs and aliases', async () => {
    const rows = await parseEntries(streamOf(XML, 64))
    const group = rows.find(r => r.entity_name === 'EXAMPLE THREAT GROUP')

    expect(group).toMatchObject({
      address: '1ExampleDoNotUseAAAAAAAAAAAAAAAAAA',
      currency: 'XBT',
      entity_uid: '900001',
    })
    expect(group.programs).toEqual(['CYBER2', 'DPRK3'])
    expect(group.aliases).toEqual(expect.arrayContaining(['EXAMPLE GROUP', 'SAMPLE COLLECTIVE']))
  })

  it('returns one row per address when an entry holds several', async () => {
    const rows = await parseEntries(streamOf(XML, 64))
    const person = rows.filter(r => r.entity_name === 'EXAMPLEPERSON, PAT')

    expect(person.map(r => r.currency).sort()).toEqual(['ETH', 'XBT'])
    expect(person.map(r => r.address)).toEqual(
      expect.arrayContaining([
        '0xExampleDoNotUse0000000000000000000000ff',
        'bc1qexampledonotuse00000000000000000000000',
      ])
    )
  })

  it('ignores identifiers that are not currency addresses', async () => {
    const rows = await parseEntries(streamOf(XML, 64))

    // The same entry carries a passport number and a vessel IMO elsewhere.
    expect(rows.map(r => r.address)).not.toContain('X0000000')
    expect(rows.some(r => r.entity_name.includes('SHIPPING'))).toBe(false)
  })

  it('drops an address it cannot attribute to a name', async () => {
    const rows = await parseEntries(streamOf(XML, 64))

    expect(rows.map(r => r.address)).not.toContain('1OrphanExampleDoNotUseAAAAAAAAAAAA')
  })

  it('reads the same rows whatever the chunk boundaries fall on', async () => {
    const sizes = [1, 7, 64, 512, XML.length]
    const results = await Promise.all(sizes.map(size => parseEntries(streamOf(XML, size))))

    for (const rows of results) {
      expect(rows).toEqual(results[0])
    }
  })
})
