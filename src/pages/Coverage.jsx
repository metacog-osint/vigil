import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BUILD_INFO, describeInterval } from '../lib/buildInfo'

/**
 * What Vigil does not cover, area by area: what Vigil reads, then what that
 * leaves out.
 *
 * Each source names the feed-registry job that reads it (`job`), and the
 * cadence shown beside it comes from the registry in this build, so the page
 * cannot claim a schedule the registry does not have. Coverage.test.jsx fails
 * if a job named here is not in the registry.
 */
export const COVERAGE = [
  {
    id: 'claims',
    title: 'Ransomware and extortion claims',
    reads: [
      {
        name: 'RansomLook',
        job: 'ransomlook',
        what: 'the posts ransomware and extortion groups make on their own leak sites',
      },
      {
        name: 'ThreatCluster',
        job: 'threatcluster',
        what: 'victim country, from its free file of the last seven days',
      },
      {
        name: 'Ransomware.live',
        job: 'ransomware.live',
        what: 'group profiles only (techniques, tools, leak-site addresses), not claims',
      },
    ],
    gaps: [
      'A ransomware claim is a claim, never a confirmed breach. Vigil does not verify claims, and a filing about the same organisation does not turn the claim into a confirmed breach.',
      'Vigil holds only the attacks a group chose to post. An attack that was never posted, or a post removed before Vigil read it, is not in Vigil, whatever the reason.',
      'Intrusions by actors who do not extort in public, such as most state espionage, do not appear as claims. Some appear in the government advisories below.',
      'RansomLook publishes no victim country. Country comes from ThreatCluster, and for older claims from Ransomware.live, which stopped supplying it in May 2026. Since 22 November 2026 ThreatCluster’s free file covers only the last seven days, so a claim it did not list has no country. Counts by country count only the claims that have one.',
      'Sector is guessed from words in the victim’s name. A name that does not say what the organisation does leaves the sector blank or wrong.',
    ],
  },
  {
    id: 'disclosures',
    title: 'Breaches a victim reported',
    reads: [
      {
        name: 'SEC Form 8-K, Item 1.05',
        job: 'sec-edgar',
        what: 'material cybersecurity incidents that SEC registrants report',
      },
      {
        name: 'State attorney general registries',
        job: 'state-breach-notices',
        what: 'California, Washington, Oregon, Vermont, Montana, South Carolina, Idaho and Delaware',
      },
      {
        name: 'Washington Attorney General open data',
        job: 'wa-breach-causes',
        what: 'the cause Washington records for each of its notices',
      },
      {
        name: 'HHS Office for Civil Rights breach portal',
        job: 'hhs-ocr-breaches',
        what: 'HIPAA breaches affecting 500 or more people',
      },
    ],
    gaps: [
      'Only those eight states. Notices filed in any other state, and with any regulator outside the United States, are not in Vigil.',
      'Each source has its own rule for what must be reported: the SEC asks only for incidents a registrant judges material, HHS publishes only breaches affecting 500 or more people, and states set different thresholds. Counts are not comparable between sources or between states.',
      'A notice appears when the registry posts it, which can be weeks or months after the breach.',
      'Vigil gives no single total of people affected. Notices count people differently and the same breach can be filed in several places.',
    ],
  },
  {
    id: 'government',
    title: 'Government attribution, advisories and sanctions',
    reads: [
      {
        name: 'CISA joint advisories',
        job: 'cisa-advisories',
        what: 'activity CISA and its partners attribute',
      },
      { name: 'NCSC-UK', job: 'ncsc-advisories', what: 'the UK’s own attributions and news items' },
      {
        name: 'CISA ICS advisories',
        job: 'cisa-ics',
        what: 'industrial control system advisories',
      },
      { name: 'CERT-FR', job: 'certfr-alerts', what: 'CERT-FR’s alerts to act now' },
      { name: 'FinCEN', job: 'fincen-advisories', what: 'FinCEN’s alerts and advisories' },
      { name: 'OFAC', job: 'ofac-sdn', what: 'the Specially Designated Nationals list' },
    ],
    gaps: [
      'Attributions by other governments are not read unless they co-sign a CISA or NCSC-UK publication.',
      'Every attribution in Vigil is a source’s claim, shown with that source. Vigil makes no attribution of its own.',
    ],
  },
  {
    id: 'research',
    title: 'Vendor threat research',
    reads: [
      {
        name: 'Eight vendor blogs',
        job: 'vendor-research',
        what: 'GreyNoise, Acronis, ESET, Palo Alto Networks Unit 42, Cisco Talos, Microsoft Security, Kaspersky Securelist and Check Point Research',
      },
    ],
    gaps: [
      'Other vendors’ research, and any report behind a paywall or a sign-in, is not read.',
      'An actor named in a report is not linked to that actor until a person has read the report and ruled on it.',
    ],
  },
  {
    id: 'vulnerabilities',
    title: 'Vulnerabilities and exploitation',
    reads: [
      { name: 'NVD', job: 'nvd', what: 'CVE records' },
      { name: 'CISA KEV', job: 'cisa-kev', what: 'CISA’s Known Exploited Vulnerabilities catalog' },
      { name: 'EPSS', job: 'epss', what: 'FIRST’s exploit prediction scores' },
      { name: 'CISA Vulnrichment', job: 'cisa-vulnrichment', what: 'CISA’s SSVC assessments' },
      {
        name: 'Android and Mozilla',
        job: 'vendor-exploited',
        what: 'the vendors’ own statements that a flaw was or may be exploited',
      },
      {
        name: 'CIRCL sightings',
        job: 'circl-sightings',
        what: 'reported exploitation, from an allow-list of CIRCL’s sources',
      },
    ],
    gaps: [
      'Exploitation is known only from these sources. A CVE missing from KEV and from the rest is not shown to be unexploited.',
      'Microsoft’s exploited flag, Google Project Zero’s in-the-wild list, and the advisories of Apple, Cisco, Fortinet, Ivanti and Oracle are not read: their terms do not allow republishing, or state no licence.',
      'EPSS is a probability that a flaw will be exploited, not a report that it was.',
      'No source of public proof-of-concept or exploit code is read on a schedule.',
    ],
  },
  {
    id: 'indicators',
    title: 'Indicators of compromise',
    reads: [
      { name: 'ThreatFox', job: 'threatfox', what: 'IPs, domains, URLs and hashes' },
      { name: 'URLhaus', job: 'urlhaus', what: 'URLs serving malware' },
      { name: 'Feodo Tracker', job: 'feodo', what: 'botnet command-and-control IPs' },
      { name: 'MalwareBazaar', job: 'malwarebazaar', what: 'malware samples' },
      { name: 'Pulsedive', job: 'pulsedive', what: 'community indicators' },
      { name: 'Tor Project', job: 'tor-exits', what: 'Tor exit addresses' },
      { name: 'DB-IP', job: 'ioc-geo', what: 'the location of each IP' },
      { name: 'Censys', job: 'censys', what: 'host details, a small batch of IPs a day' },
    ],
    gaps: [
      'These are lists people submit. An address or file that is not listed is not shown to be safe, and a listed one may since have been cleaned or reassigned.',
      'Vigil runs no sandbox, sensor or honeypot of its own, and reads no passive DNS or certificate logs.',
    ],
  },
  {
    id: 'actors',
    title: 'Threat actors',
    reads: [
      { name: 'MITRE ATT&CK', job: 'mitre', what: 'groups, techniques and campaigns' },
      { name: 'MITRE ATLAS', job: 'mitre-atlas', what: 'techniques against AI systems' },
      { name: 'Malpedia', job: 'malpedia', what: 'actors and malware families' },
      { name: 'MISP Galaxy', job: 'misp-galaxy', what: 'actor clusters' },
      { name: 'ETDA', job: 'etda-actors', what: 'actor origin countries' },
    ],
    gaps: [
      'A group none of these catalogues lists has no profile, even if it posts claims.',
      'Where a group is from is what these sources say, with their own confidence. It is a claim, not an observation.',
    ],
  },
  {
    id: 'payments',
    title: 'Ransom payments',
    reads: [
      {
        name: 'Ransomwhere',
        job: 'ransomwhere',
        what: 'its published archive of reported ransom addresses',
      },
    ],
    gaps: [
      'The archive holds only the addresses people submitted. A payment to an address nobody reported is not here, so every figure is a floor.',
      'The archive changes only when a new version is published, so its newest payment can be well behind today.',
    ],
  },
]

/** Areas no source in Vigil covers. */
export const NOT_COVERED = [
  'Dark-web forums, marketplaces and Telegram channels. CIRCL can report a sighting made on Telegram, without the post.',
  'News reporting. Vigil reads no news outlets.',
  'DDoS attacks, business email compromise and fraud reports, insider incidents and influence operations.',
  'Threats specific to mobile devices, the Internet of Things or a cloud provider’s own platform.',
]

const JOBS_BY_ID = Object.fromEntries((BUILD_INFO.registry?.jobs || []).map((job) => [job.id, job]))

function Cadence({ job }) {
  const entry = JOBS_BY_ID[job]
  if (!entry) return null
  return (
    <span className="text-gray-500">
      {' '}
      ({entry.paused ? 'paused' : describeInterval(entry.intervalMinutes)})
    </span>
  )
}

export default function Coverage() {
  useEffect(() => {
    document.title = 'What Vigil does not cover | Vigil'
  }, [])

  return (
    // A div, not <main>: signed in, this renders inside the app's own <main>.
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-gray-300">
      <header className="space-y-3">
        <h1 id="coverage-heading" className="text-2xl font-semibold text-white">
          What Vigil does not cover
        </h1>
        <p>
          Vigil reads a fixed set of public sources on a schedule. This page lists them by area, and
          then what they leave out. When Vigil shows nothing, its sources hold nothing; it does not
          mean nothing happened.
        </p>
        <p className="text-sm text-gray-400">
          A ransomware claim is a claim, never a confirmed breach. The cadence beside each source is
          how often its job is due in the feed registry this site was built with; a job can run
          later than due. Each source&apos;s licence is on the{' '}
          <Link to="/sources" className="text-cyan-400 hover:underline">
            Sources
          </Link>{' '}
          page.
        </p>
      </header>

      {COVERAGE.map((area) => (
        <section key={area.id} aria-labelledby={`coverage-${area.id}`} className="space-y-3">
          <h2 id={`coverage-${area.id}`} className="text-lg font-semibold text-white">
            {area.title}
          </h2>
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">What Vigil reads</h3>
            <ul className="text-sm space-y-1 list-disc pl-5">
              {area.reads.map((source) => (
                <li key={source.name}>
                  <span className="text-white">{source.name}</span>: {source.what}
                  <Cadence job={source.job} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">What it does not cover</h3>
            <ul className="text-sm space-y-1 list-disc pl-5">
              {area.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section aria-labelledby="coverage-none" className="space-y-3">
        <h2 id="coverage-none" className="text-lg font-semibold text-white">
          Not covered by any source
        </h2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          {NOT_COVERED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="coverage-timing" className="space-y-3">
        <h2 id="coverage-timing" className="text-lg font-semibold text-white">
          Timing
        </h2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>
            The most frequent jobs are due once an hour, so anything on this site can be an hour or
            more behind its source.
          </li>
          <li>
            The ingestion worker is deployed separately from this site, so the worker running now
            may hold an earlier feed registry than the one this page was built with.
          </li>
        </ul>
      </section>
    </div>
  )
}
