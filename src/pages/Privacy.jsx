/**
 * Privacy Policy Page
 */

import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/" className="text-2xl font-bold text-cyber-accent">
            VIGIL
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last updated: January 19, 2026</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              The Intelligence Company, LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates Vigil, a cyber threat intelligence
              platform. This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you use our service.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>
            <div className="text-gray-300 leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Account Information</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Email address</li>
                  <li>Name (if provided)</li>
                  <li>Organization name (if provided)</li>
                  <li>Password (stored securely hashed)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Organization Profile Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Industry sector</li>
                  <li>Geographic region</li>
                  <li>Technology vendors and stack (for relevance scoring)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Usage Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Pages visited and features used</li>
                  <li>Search queries within the platform</li>
                  <li>Watchlist and alert preferences</li>
                  <li>API usage (for API customers)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Technical Data</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>Cookies and similar technologies</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              3. How We Use Your Information
            </h2>
            <div className="text-gray-300 leading-relaxed">
              <p className="mb-3">We use collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Personalize threat intelligence based on your organization profile</li>
                <li>Send alerts and notifications you have subscribed to</li>
                <li>Respond to your inquiries and support requests</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>
          </section>

          {/* AI and Machine Learning */}
          <section className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-400 mb-4">4. AI and Machine Learning</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>
                Vigil uses AI to generate summaries and analyze threat patterns. Important
                disclosures:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>We do NOT use your data to train AI models.</strong> Your searches,
                  watchlists, and organization data are never used to train external AI systems.
                </li>
                <li>
                  AI-generated summaries are based on aggregated public threat data, not your
                  private information.
                </li>
                <li>
                  We use third-party AI providers (such as Groq) for text generation. Only
                  anonymized, non-personal threat data is sent to these services.
                </li>
              </ul>
            </div>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              5. Data Sharing and Disclosure
            </h2>
            <div className="text-gray-300 leading-relaxed space-y-4">
              <p>We may share your information with:</p>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Service Providers</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Supabase (database and authentication)</li>
                  <li>Vercel (hosting)</li>
                  <li>Stripe (payment processing)</li>
                  <li>Resend (email delivery)</li>
                  <li>Sentry (error tracking)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Legal Requirements</h3>
                <p>
                  We may disclose information if required by law, court order, or government
                  request, or to protect our rights, property, or safety.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Business Transfers</h3>
                <p>
                  In the event of a merger, acquisition, or sale of assets, user information may be
                  transferred to the acquiring entity.
                </p>
              </div>

              <p className="font-medium text-green-400">
                We do NOT sell your personal information to third parties.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Data Retention</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>We retain your information as follows:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Account data:</strong> Retained while your account is active and for 30
                  days after deletion request
                </li>
                <li>
                  <strong>Usage logs:</strong> Retained for 90 days for analytics, then anonymized
                </li>
                <li>
                  <strong>Support communications:</strong> Retained for 2 years
                </li>
                <li>
                  <strong>Billing records:</strong> Retained for 7 years for legal compliance
                </li>
              </ul>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Your Rights</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of marketing communications</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, contact us at privacy@theintelligence.company
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Cookies and Tracking</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>We use the following types of cookies:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Essential cookies:</strong> Required for authentication and security
                </li>
                <li>
                  <strong>Preference cookies:</strong> Remember your settings (theme, layout)
                </li>
                <li>
                  <strong>Analytics cookies:</strong> Help us understand how you use Vigil
                </li>
              </ul>
              <p>
                You can control cookies through your browser settings. Note that disabling essential
                cookies may prevent you from using the service.
              </p>
            </div>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Data Security</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>We implement industry-standard security measures including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption in transit (TLS 1.3) and at rest</li>
                <li>Secure password hashing (bcrypt)</li>
                <li>Regular security assessments</li>
                <li>Access controls and audit logging</li>
                <li>Incident response procedures</li>
              </ul>
              <p>
                However, no method of transmission over the internet is 100% secure. We cannot
                guarantee absolute security of your data.
              </p>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              10. International Data Transfers
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Our services are hosted in the United States. If you access Vigil from outside the
              U.S., your information will be transferred to and processed in the United States. By
              using our service, you consent to this transfer. For EU users, we rely on Standard
              Contractual Clauses where applicable.
            </p>
          </section>

          {/* Children */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Children&apos;s Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              Vigil is not intended for individuals under 18 years of age. We do not knowingly
              collect personal information from children. If we learn we have collected information
              from a child, we will delete it promptly.
            </p>
          </section>

          {/* California Privacy Rights */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">12. California Privacy Rights</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>
                California residents have additional rights under the California Consumer Privacy
                Act (CCPA):
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Right to know what personal information we collect and how it is used</li>
                <li>Right to delete personal information</li>
                <li>
                  Right to opt out of the sale of personal information (we do not sell your data)
                </li>
                <li>Right to non-discrimination for exercising your rights</li>
              </ul>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">13. Changes to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes
              by posting the new policy on this page and updating the &ldquo;Last updated&rdquo;
              date. Your continued use of Vigil after changes constitutes acceptance of the updated
              policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">14. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              For privacy-related questions or to exercise your rights, contact us at:
            </p>
            <div className="mt-4 text-gray-300">
              <p>The Intelligence Company, LLC</p>
              <p>Email: privacy@theintelligence.company</p>
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6">
          <Link to="/terms" className="text-cyber-accent hover:underline">
            Terms of Service
          </Link>
          <Link to="/" className="text-gray-400 hover:text-white">
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
