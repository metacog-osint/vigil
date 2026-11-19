/**
 * Reading HHS OCR's breach portal (192): the CSV export and the form's links.
 *
 * The fixtures copy the shape of the real export of 19 Nov 2026, including its
 * two broken headers (a Java object's name where "Name of Covered Entity" and
 * "Business Associate Present" belong) and a description with \r\n inside
 * quotes.
 */
import { describe, expect, it } from 'vitest'
import {
  HHS_PUBLIC_URL,
  archiveTab,
  assignAccessions,
  cookieHeader,
  csvExportLink,
  hhsDate,
  hipaaListLink,
  mergeCookies,
  parseCsv,
  readHhsCsv,
  viewState,
} from '../../../../supabase/functions/_shared/hhsOcr.ts'

const HEADER =
  '"javax.faces.component.UIPanel@5e239d0","State","Covered Entity Type","Individuals Affected","Breach Submission Date","Type of Breach","Location of Breached Information","javax.faces.component.UIPanel@6829f1d2","Web Description"'

const OPEN = [
  HEADER,
  '"Central Ohio Primary Care Physicians, Inc. (COPC)","OH","Healthcare Provider","1351650","10/16/2026","Hacking/IT Incident","Network Server","No",""',
  '"Lisa Jo Adornetto, DDS, PA","NC","Healthcare Provider","2000","10/15/2026","Unauthorized Access/Disclosure","Email, Other","No",""',
].join('\n')

const ARCHIVE = [
  HEADER,
  '"Altos Inc","CA","Business Associate","2700","08/11/2025","Hacking/IT Incident","Network Server","Yes",""',
  '"Altos Inc","CA","Business Associate","882","08/11/2025","Hacking/IT Incident","Network Server","Yes",""',
  '"Franklin/Fulton Mental Health","PA","Healthcare Provider","640","10/05/2026","Hacking/IT Incident","Email","No","Franklin/Fulton Mental Health  \r\nOCR Transaction Number: 27-707788\r\n\r\nThe covered entity (CE) reported that its ""email environment"" was compromised."',
  '"Valperaiso Fire Department","IN","Health Plan","","09/03/2013","Theft","Laptop","No",""',
  '"No Date Clinic","MN","Healthcare Provider","700","","Loss","Paper/Films","No",""',
].join('\r\n')

describe('parseCsv', () => {
  it('reads quoted commas, doubled quotes and newlines inside a field', () => {
    const rows = parseCsv(ARCHIVE)
    expect(rows).toHaveLength(6)
    expect(rows[3][8]).toContain('its "email environment" was')
    expect(rows[3][8]).toContain('\r\nOCR Transaction Number')
  })

  it('ignores a byte-order mark and a trailing newline', () => {
    expect(parseCsv('﻿"a","b"\n"c","d"\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('refuses an unterminated quote rather than reading the rest as one field', () => {
    expect(() => parseCsv('"a,b\n"c"')).not.toThrow()
    expect(() => parseCsv('"a,b\nc')).toThrow(/unterminated/)
  })
})

describe('readHhsCsv', () => {
  it("keeps HHS's fields as given", () => {
    const { reports, skipped } = readHhsCsv(OPEN, 'under_investigation')
    expect(skipped).toBe(0)
    expect(reports[0]).toEqual({
      company_name: 'Central Ohio Primary Care Physicians, Inc. (COPC)',
      entity_state: 'OH',
      entity_type: 'Healthcare Provider',
      persons_affected: 1351650,
      submitted: '2026-10-16',
      breach_type: 'Hacking/IT Incident',
      locations: ['Network Server'],
      business_associate: false,
      description: null,
      status: 'under_investigation',
      url: HHS_PUBLIC_URL,
    })
    expect(reports[1].locations).toEqual(['Email', 'Other'])
  })

  it("keeps OCR's description verbatim, with its line breaks as \\n, and calls nothing ransomware", () => {
    const { reports, skipped } = readHhsCsv(ARCHIVE, 'archived')
    expect(skipped).toBe(1)
    const ff = reports.find((r) => r.company_name === 'Franklin/Fulton Mental Health')
    expect(ff.description).toBe(
      'Franklin/Fulton Mental Health  \nOCR Transaction Number: 27-707788\n\nThe covered entity (CE) reported that its "email environment" was compromised.'
    )
    expect(ff.breach_type).toBe('Hacking/IT Incident')
    expect(reports.find((r) => r.company_name.startsWith('Valperaiso')).persons_affected).toBe(null)
    expect(JSON.stringify(reports)).not.toMatch(/ransom/i)
  })

  it('refuses an export whose columns moved', () => {
    const moved = OPEN.replace('"State","Covered Entity Type"', '"Covered Entity Type","State"')
    expect(() => readHhsCsv(moved, 'archived')).toThrow(/column 2/)
    expect(() => readHhsCsv('"a","b"\n"c","d"', 'archived')).toThrow(/2 columns/)
  })

  it('reads only MM/DD/YYYY dates that exist', () => {
    expect(hhsDate('10/16/2026')).toBe('2026-10-16')
    expect(hhsDate('2/30/2026')).toBe(null)
    expect(hhsDate('2026-10-16')).toBe(null)
  })
})

describe('assignAccessions', () => {
  const open = readHhsCsv(OPEN, 'under_investigation').reports
  const archive = readHhsCsv(ARCHIVE, 'archived').reports

  it('numbers reports one filer sent on the same day, the same way in any order', () => {
    const a = assignAccessions([...open, ...archive])
    const b = assignAccessions([...archive].reverse().concat(open))
    const altos = (xs) =>
      xs
        .filter((r) => r.company_name === 'Altos Inc')
        .map((r) => [r.accession, r.persons_affected])
        .sort()
    expect(altos(a)).toEqual([
      ['hhs-ocr:altosinc:CA:2025-08-11:1', 882],
      ['hhs-ocr:altosinc:CA:2025-08-11:2', 2700],
    ])
    expect(altos(b)).toEqual(altos(a))
    expect(new Set(a.map((r) => r.accession)).size).toBe(a.length)
  })

  it('gives a report the same accession in either list', () => {
    const [open1] = assignAccessions([open[0]])
    const [closed1] = assignAccessions([{ ...open[0], status: 'archived', description: 'Closed.' }])
    expect(closed1.accession).toBe(open1.accession)
    expect(open1.accession).toBe('hhs-ocr:centralohioprimarycarephysiciansinccopc:OH:2026-10-16:1')
  })
})

describe('the form', () => {
  const FRONT = `<form id="ocrForm"><a href="#" onclick="mojarra.jsfcljs(document.getElementById('ocrForm'),{'ocrForm:j_idt37':'ocrForm:j_idt37'},'');return false">File a HIPAA Breach</a>
    <a href="#" onclick="mojarra.jsfcljs(document.getElementById('ocrForm'),{'ocrForm:j_idt39':'ocrForm:j_idt39'},'');return false">View HIPAA Breach Reports</a>
    <a href="#" onclick="mojarra.jsfcljs(document.getElementById('ocrForm'),{'ocrForm:j_idt53':'ocrForm:j_idt53'},'');return false">View 42 CFR Part 2 Breach Reports</a>
    <input type="hidden" name="javax.faces.ViewState" id="j_id1:javax.faces.ViewState:0" value="835786:615791" autocomplete="off" /></form>`
  const REPORT = `<li><a href="#ocrForm:j_idt31:underInvestigationTab">Under Investigation</a></li><li><a href="#ocrForm:j_idt31:archiveTab" tabindex="-1">Archive</a></li>
    <a href="#" onclick="mojarra.jsfcljs(document.getElementById('ocrForm'),{'ocrForm:j_idt380':'ocrForm:j_idt380'},'');return false"><img id="ocrForm:j_idt381" src="/ocr/images/icons/excel.png" alt="Excel" /></a>
    <a href="#" onclick="mojarra.jsfcljs(document.getElementById('ocrForm'),{'ocrForm:j_idt384':'ocrForm:j_idt384'},'');return false"><img id="ocrForm:j_idt385" src="/ocr/images/icons/csv.png" alt="CSV" /></a>`
  const PARTIAL = `<partial-response id="j_id1"><changes><update id="j_id1:javax.faces.ViewState:0"><![CDATA[-29174:-19038]]></update></changes></partial-response>`

  it('finds the HIPAA list, not the Part 2 one, by what the link says', () => {
    expect(hipaaListLink(FRONT)).toBe('ocrForm:j_idt39')
  })

  it('finds the CSV export and the archive tab', () => {
    expect(csvExportLink(REPORT)).toBe('ocrForm:j_idt384')
    expect(archiveTab(REPORT)).toEqual({
      view: 'ocrForm:j_idt31',
      tab: 'ocrForm:j_idt31:archiveTab',
    })
  })

  it('reads the view state from a page and from a partial response', () => {
    expect(viewState(FRONT)).toBe('835786:615791')
    expect(viewState(PARTIAL)).toBe('-29174:-19038')
  })

  it('keeps the session cookie across responses', () => {
    const jar = new Map()
    mergeCookies(jar, ['JSESSIONID=abc; Path=/ocr; Secure; HttpOnly', 'lb=1; Path=/'])
    mergeCookies(jar, ['JSESSIONID=def; Path=/ocr'])
    expect(cookieHeader(jar)).toBe('JSESSIONID=def; lb=1')
  })
})
