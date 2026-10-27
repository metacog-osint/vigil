import { Link } from 'react-router-dom'

export const REPO_URL = 'https://github.com/metacog-osint/vigil'
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`

/**
 * The credits the data's licences require wherever the data is shown.
 *
 * Not courtesy: CC BY 4.0 (RansomLook, DB-IP, the Ransomwhere archive) needs
 * credit where the data appears, ransomware.live's terms (section 6) require it
 * to be named and linked, and MITRE's ATT&CK terms require its copyright
 * designation to travel with the content. The Sources page carries the full
 * list from `source_licences`; this is the short form on every page.
 */
export const DATA_CREDITS = [
  {
    label: 'Leak-site claims',
    sources: [
      { name: 'RansomLook', url: 'https://www.ransomlook.io/', licence: 'CC BY 4.0' },
      {
        name: 'Ransomware.live',
        url: 'https://www.ransomware.live/',
        licence: 'non-commercial use',
      },
      {
        name: 'Ransomwatch',
        url: 'https://github.com/joshhighet/ransomwatch',
        licence: 'Unlicense',
      },
    ],
  },
  {
    label: 'Victim country',
    sources: [
      {
        name: 'ThreatCluster',
        url: 'https://github.com/Jam0k/Ransomware-Intel',
        licence: 'TLP:CLEAR',
      },
    ],
  },
  {
    label: 'IP location',
    sources: [{ name: 'DB-IP', url: 'https://db-ip.com/', licence: 'CC BY 4.0' }],
  },
  {
    label: 'Ransom payments',
    sources: [
      {
        name: 'Ransomwhere',
        url: 'https://doi.org/10.5281/zenodo.6512122',
        licence: 'CC BY 4.0',
      },
    ],
  },
]

const linkClass = 'text-gray-400 hover:text-cyan-400 underline-offset-2 hover:underline'

/**
 * A project of The Intelligence Company: where the code is, under what
 * licence, and whose data this is. The code is AGPL-3.0; the data is not ours
 * to license, and each source keeps its own terms.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-800 px-4 lg:px-6 py-4 text-xs text-gray-500 space-y-2">
      <p>
        A project of The Intelligence Company.{' '}
        <a href={REPO_URL} className={linkClass} target="_blank" rel="noopener noreferrer">
          Source code
        </a>{' '}
        (
        <a href={LICENSE_URL} className={linkClass} target="_blank" rel="noopener noreferrer">
          AGPL-3.0
        </a>
        ).{' '}
        <Link to="/terms" className={linkClass}>
          Terms of use
        </Link>
        .{' '}
        <Link to="/privacy" className={linkClass}>
          Privacy
        </Link>
        .
      </p>
      <p>
        {DATA_CREDITS.map((group) => (
          <span key={group.label}>
            {group.label}:{' '}
            {group.sources.map((s, i) => (
              <span key={s.name}>
                {i > 0 && ', '}
                <a href={s.url} className={linkClass} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>{' '}
                ({s.licence})
              </span>
            ))}
            .{' '}
          </span>
        ))}
        ATT&amp;CK® © The MITRE Corporation, reproduced with permission. The code licence does not
        cover the data. Every source and its licence:{' '}
        <Link to="/sources" className={linkClass}>
          Sources
        </Link>
        .
      </p>
    </footer>
  )
}
