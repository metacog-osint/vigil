/**
 * Public Landing Page
 *
 * Shown to unauthenticated visitors. Showcases Vigil's value
 * proposition and encourages registration.
 */

import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useDemo } from '../contexts/DemoContext'

const FEATURES = [
  {
    icon: '🎯',
    title: 'Threat Actor Tracking',
    description:
      "Monitor 200+ ransomware groups and APTs. See who's escalating, their targets, and TTPs.",
  },
  {
    icon: '🔴',
    title: 'Real-Time Incidents',
    description: 'Live feed of ransomware attacks worldwide. Know about breaches before the news.',
  },
  {
    icon: '⚠️',
    title: 'Vulnerability Intelligence',
    description: 'CVEs enriched with CISA KEV status, EPSS scores, and known exploiting actors.',
  },
  {
    icon: '🔍',
    title: 'IOC Database',
    description: 'Searchable database of IPs, domains, hashes from ThreatFox, URLhaus, and more.',
  },
  {
    icon: '📊',
    title: 'Trend Analysis',
    description:
      'See which threats are escalating. Week-over-week comparisons and sector breakdowns.',
  },
  {
    icon: '🔔',
    title: 'Smart Alerts',
    description: 'Get notified about threats relevant to your organization, vendors, and sector.',
  },
]

const STATS = [
  { value: '200+', label: 'Threat Actors' },
  { value: '50K+', label: 'Incidents' },
  { value: '1M+', label: 'IOCs' },
  { value: '30+', label: 'Data Sources' },
]

const TESTIMONIALS = [
  {
    quote: 'Vigil gives us threat intel that used to cost $60K/year from enterprise vendors.',
    author: 'Security Director',
    company: 'Mid-size Healthcare Org',
  },
  {
    quote: "We automated our IOC feeds with Vigil's API. Our SIEM is always up to date now.",
    author: 'Security Engineer',
    company: 'MSSP',
  },
  {
    quote: 'The relevance scoring is a game-changer. We only see threats that matter to us.',
    author: 'SOC Manager',
    company: 'Financial Services',
  },
]

const PRICING_PREVIEW = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Full threat actor database',
      'Incident feed',
      'CVE/KEV tracking',
      'IOC search',
      'Trend analysis',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$39',
    period: '/month',
    features: [
      'Everything in Free',
      'Org profile & relevance scoring',
      'Email digests',
      'CSV exports',
      'Watchlists & alerts',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$129',
    period: '/month',
    features: [
      'Everything in Pro',
      'API access (25K req/mo)',
      'STIX exports',
      '5 team members',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
]

const DATA_SOURCES = [
  'CISA KEV',
  'ThreatFox',
  'URLhaus',
  'MalwareBazaar',
  'Ransomwatch',
  'MITRE ATT&CK',
  'NVD',
  'EPSS',
  'GreyNoise',
  'Abuse.ch',
]

function HeroSection() {
  const { enterDemoMode } = useDemo()

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyber-accent/5 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyber-accent/10 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-accent/10 border border-cyber-accent/30 rounded-full text-sm text-cyber-accent mb-8">
          <span className="w-2 h-2 bg-cyber-accent rounded-full animate-pulse" />
          Live threat intelligence
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          Threat Intelligence
          <br />
          <span className="text-cyber-accent">Without the Enterprise Price</span>
        </h1>

        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Track ransomware groups, monitor vulnerabilities, and get alerts that matter. Built for
          security teams who need signal, not noise.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth?mode=register"
            className="w-full sm:w-auto px-8 py-4 bg-cyber-accent text-black font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors text-lg"
          >
            Start Free — No Credit Card
          </Link>
          <button
            onClick={enterDemoMode}
            className="w-full sm:w-auto px-8 py-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-lg border border-gray-700 inline-flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Try Interactive Demo
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          <button onClick={() => {}} className="text-gray-400 hover:text-white transition-colors">
            <Link to="/auth?mode=login">Already have an account? Sign in</Link>
          </button>
        </p>

        <p className="text-sm text-gray-500 mt-2">Join 500+ security teams using Vigil</p>
      </div>
    </section>
  )
}

function StatsSection() {
  return (
    <section className="py-12 border-y border-gray-800 bg-gray-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-cyber-accent mb-1">
                {stat.value}
              </div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything You Need to Track Threats
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Aggregated from 30+ public threat feeds, enriched and correlated for actionable
            intelligence.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PreviewSection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            See What&apos;s Happening Right Now
          </h2>
          <p className="text-lg text-gray-400">
            Real-time dashboard showing global threat activity
          </p>
        </div>

        {/* Dashboard preview mockup */}
        <div className="relative rounded-xl border border-gray-700 bg-gray-900 overflow-hidden shadow-2xl">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-gray-700 rounded px-3 py-1 text-sm text-gray-400 max-w-md mx-auto">
                vigil.theintelligence.company
              </div>
            </div>
          </div>

          {/* Dashboard preview content */}
          <div className="p-6 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Incidents Today', value: '23', color: 'text-red-400' },
                { label: 'Active Actors', value: '47', color: 'text-orange-400' },
                { label: 'New KEVs', value: '3', color: 'text-yellow-400' },
                { label: 'Threat Level', value: '67', color: 'text-cyber-accent' },
              ].map((stat, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                  <div className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Chart placeholder */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-gray-800 rounded-lg p-4 h-48">
                <div className="text-sm text-gray-400 mb-4">Activity Timeline</div>
                <div className="flex items-end gap-1 h-32">
                  {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-cyber-accent/60 rounded-t"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-4">Top Actors</div>
                <div className="space-y-3">
                  {['LockBit', 'BlackCat', 'Cl0p', 'Play'].map((actor, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-red-400">●</span>
                      <span className="text-sm text-gray-300">{actor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Blur overlay */}
            <div className="absolute inset-0 top-16 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent flex items-end justify-center pb-12">
              <Link
                to="/auth?mode=register"
                className="px-6 py-3 bg-cyber-accent text-black font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors"
              >
                Sign Up to See Full Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DataSourcesSection() {
  return (
    <section className="py-16 border-y border-gray-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-8">
          <h3 className="text-lg font-medium text-gray-400">
            Aggregating intelligence from trusted sources
          </h3>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {DATA_SOURCES.map((source, i) => (
            <div
              key={i}
              className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-400"
            >
              {source}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Trusted by Security Teams
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial, i) => (
            <div key={i} className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
              <div className="text-3xl mb-4">💬</div>
              <p className="text-gray-300 mb-4 italic">&ldquo;{testimonial.quote}&rdquo;</p>
              <div>
                <div className="text-white font-medium">{testimonial.author}</div>
                <div className="text-sm text-gray-500">{testimonial.company}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection() {
  return (
    <section className="py-20 lg:py-28 bg-gray-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-400">Start free, upgrade when you need more</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PRICING_PREVIEW.map((plan, i) => (
            <div
              key={i}
              className={clsx(
                'p-6 rounded-xl border transition-all',
                plan.highlighted
                  ? 'bg-cyber-accent/10 border-cyber-accent/50 ring-1 ring-cyber-accent/30'
                  : 'bg-gray-800/50 border-gray-700'
              )}
            >
              {plan.highlighted && (
                <div className="text-xs font-medium text-cyber-accent mb-4">MOST POPULAR</div>
              )}
              <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth?mode=register"
                className={clsx(
                  'block w-full py-3 rounded-lg font-medium text-center transition-colors',
                  plan.highlighted
                    ? 'bg-cyber-accent text-black hover:bg-cyber-accent/90'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link to="/pricing" className="text-cyber-accent hover:underline">
            See full pricing details →
          </Link>
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Ready to Level Up Your Threat Intel?
        </h2>
        <p className="text-lg text-gray-400 mb-8">
          Join hundreds of security teams using Vigil to stay ahead of threats. Free forever, no
          credit card required.
        </p>
        <Link
          to="/auth?mode=register"
          className="inline-flex items-center gap-2 px-8 py-4 bg-cyber-accent text-black font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors text-lg"
        >
          Create Free Account
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-cyber-accent">VIGIL</span>
            <span className="text-gray-500">by The Intelligence Company</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <a
              href="mailto:support@theintelligence.company"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
            <a
              href="https://github.com/theintelligencecompany/vigil"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
          <div className="text-sm text-gray-500">© 2026 The Intelligence Company</div>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-cyber-accent">VIGIL</div>
          <div className="flex items-center gap-4">
            <Link
              to="/auth?mode=login"
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/auth?mode=register"
              className="px-4 py-2 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Add padding for fixed header */}
      <div className="pt-16">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <PreviewSection />
        <DataSourcesSection />
        <TestimonialsSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  )
}
