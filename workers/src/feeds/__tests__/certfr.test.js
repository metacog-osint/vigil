/**
 * Reading CERT-FR's alerts (188). The fixture is CERTFR-2024-ALE-006 as
 * CERT-FR serves it (Licence Ouverte 2.0), trimmed.
 */
import { describe, it, expect } from 'vitest'
import { readCertfrAlert, readCertfrList } from '../../../../supabase/functions/_shared/certfr.ts'

const ALE_006 = {
  reference: 'CERTFR-2024-ALE-006',
  title: '[MàJ] Vulnérabilité dans Palo Alto Networks GlobalProtect',
  closed_at: '2024-07-01',
  cves: [{ name: 'CVE-2024-3400', url: 'https://www.cve.org/CVERecord?id=CVE-2024-3400' }],
  affected_systems: [
    {
      description: 'PAN-OS 10.2.x',
      product: { name: 'N/A', vendor: { name: 'Palo Alto Networks' } },
    },
    {
      description: 'PAN-OS 11.0.x',
      product: { name: 'N/A', vendor: { name: 'Palo Alto Networks' } },
    },
  ],
  risks: [{ description: 'Exécution de code arbitraire à distance' }],
  revisions: [
    {
      description: 'Ajout de nouvelles versions correctives',
      revision_date: '2024-04-17T00:00:00.000000',
    },
    { description: 'Version initiale', revision_date: '2024-04-12T00:00:00.000000' },
  ],
  summary:
    '<strong>\\[Mise à jour du 10 mai 2024\\]</strong>\nLe CERT-FR est intervenu pour le traitement\nd&#39;une compromission.',
}

describe('readCertfrAlert', () => {
  it('keeps CERT-FR’s own fields, dates from its revisions, the alert as served', () => {
    const row = readCertfrAlert(ALE_006)
    expect(row).toMatchObject({
      reference: 'CERTFR-2024-ALE-006',
      title: '[MàJ] Vulnérabilité dans Palo Alto Networks GlobalProtect',
      url: 'https://cert.cyber.gouv.fr/alerte/CERTFR-2024-ALE-006/',
      first_published: '2024-04-12',
      last_revision: '2024-04-17',
      closed_at: '2024-07-01',
      cve_ids: ['CVE-2024-3400'],
      vendors: ['Palo Alto Networks'],
      risks: ['Exécution de code arbitraire à distance'],
    })
    expect(row.summary).toBe(
      "[Mise à jour du 10 mai 2024] Le CERT-FR est intervenu pour le traitement d'une compromission."
    )
    expect(row.raw).toBe(ALE_006)
  })

  it('keeps an alert with no CVE, still open', () => {
    const row = readCertfrAlert({
      ...ALE_006,
      reference: 'CERTFR-2026-ALE-012',
      cves: [],
      closed_at: null,
      summary: '',
    })
    expect(row).toMatchObject({ cve_ids: [], closed_at: null, summary: null })
  })

  it('refuses a reference that is not an alert, and drops a malformed CVE', () => {
    expect(readCertfrAlert({ ...ALE_006, reference: 'CERTFR-2024-AVI-0001' })).toBeNull()
    expect(readCertfrAlert({ ...ALE_006, cves: [{ name: 'CVE-24-1' }] }).cve_ids).toEqual([])
  })
})

describe('readCertfrList', () => {
  it('keeps only alert entries', () => {
    expect(
      readCertfrList([
        {
          reference: 'CERTA-2000-ALE-003',
          json_url: '/alerte/CERTA-2000-ALE-003/json/',
          last_revision_date: '2000-05-26T00:00:00',
        },
        {
          reference: 'CERTFR-2024-AVI-0001',
          json_url: '/avis/x/json/',
          last_revision_date: '2024-01-01',
        },
        { nope: true },
      ]).map((x) => x.reference)
    ).toEqual(['CERTA-2000-ALE-003'])
    expect(readCertfrList({ not: 'a list' })).toEqual([])
  })
})
