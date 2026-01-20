/**
 * Terms of Service Page
 */

import { Link } from 'react-router-dom'

export default function Terms() {
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
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last updated: January 19, 2026</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Vigil, a
              threat intelligence platform operated by The Intelligence Company, LLC
              (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By
              accessing or using Vigil, you agree to be bound by these Terms.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Service Description</h2>
            <p className="text-gray-300 leading-relaxed">
              Vigil is a cyber threat intelligence platform that aggregates, correlates, and
              presents information about threat actors, security incidents, vulnerabilities, and
              indicators of compromise (IOCs) from publicly available sources. The service is
              intended for security professionals, researchers, and organizations seeking to enhance
              their threat awareness.
            </p>
          </section>

          {/* Account Terms */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Account Terms</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>To use Vigil, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be at least 18 years of age</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </div>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Acceptable Use</h2>
            <div className="text-gray-300 leading-relaxed space-y-3">
              <p>You agree NOT to use Vigil to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Conduct or facilitate illegal activities</li>
                <li>Harass, threaten, or harm any individual or organization</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Resell or redistribute our data without authorization</li>
                <li>Use automated systems to scrape or collect data beyond API limits</li>
                <li>Interfere with or disrupt the service or its infrastructure</li>
              </ul>
            </div>
          </section>

          {/* CRITICAL: Data Accuracy Disclaimer */}
          <section className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-400 mb-4">
              5. Data Accuracy and Limitations Disclaimer
            </h2>
            <div className="text-gray-300 leading-relaxed space-y-4">
              <p className="font-medium text-yellow-200">
                THIS IS A CRITICAL SECTION. PLEASE READ CAREFULLY.
              </p>
              <p>
                <strong>No Guarantee of Completeness:</strong> Vigil aggregates threat intelligence
                from publicly available sources. We do NOT guarantee that our data represents all
                existing threats, threat actors, vulnerabilities, or indicators of compromise.
                Threats may exist that are not reflected in our platform.
              </p>
              <p>
                <strong>No Guarantee of Accuracy:</strong> While we strive for accuracy, threat
                intelligence data is inherently uncertain. Attributions may be incorrect,
                correlations may be speculative, and information may be outdated. You should
                independently verify critical information before taking action.
              </p>
              <p>
                <strong>Not a Substitute for Security Controls:</strong> Vigil is an informational
                tool only. It is NOT a security product and does NOT protect your systems. It should
                supplement, not replace, proper security controls, incident response procedures, and
                professional security assessments.
              </p>
              <p>
                <strong>No Liability for Missed Threats:</strong> The Company shall NOT be liable
                for any damages, losses, or harm resulting from threats, attacks, or incidents that
                were not identified, reported, or correlated by our platform. You acknowledge that
                no threat intelligence service can identify all threats.
              </p>
              <p>
                <strong>No Liability for Incorrect Correlations:</strong> Threat intelligence
                involves probabilistic analysis. The Company shall NOT be liable for any damages
                resulting from incorrect attributions, false correlations, or misidentified threat
                actors.
              </p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed">
              The Vigil platform, including its design, code, and proprietary analysis, is owned by
              The Intelligence Company, LLC. Threat data aggregated from public sources remains
              subject to its original licensing. Your use of Vigil does not grant you ownership of
              any intellectual property rights in our service or content.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4">7. Limitation of Liability</h2>
            <div className="text-gray-300 leading-relaxed space-y-4">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE INTELLIGENCE COMPANY, LLC SHALL NOT BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Loss of profits, revenue, or data</li>
                <li>Business interruption</li>
                <li>Security breaches or cyber attacks</li>
                <li>Costs of procuring substitute services</li>
                <li>Any damages resulting from reliance on our data</li>
              </ul>
              <p>
                OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM YOUR USE OF VIGIL SHALL NOT EXCEED
                THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
              </p>
            </div>
          </section>

          {/* Disclaimer of Warranties */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-gray-300 leading-relaxed">
              VIGIL IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
              WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY
              SECURE.
            </p>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Indemnification</h2>
            <p className="text-gray-300 leading-relaxed">
              You agree to indemnify, defend, and hold harmless The Intelligence Company, LLC and
              its officers, directors, employees, and agents from any claims, damages, losses, or
              expenses (including reasonable attorney fees) arising from your use of Vigil,
              violation of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We may suspend or terminate your access to Vigil at any time, with or without cause,
              with or without notice. Upon termination, your right to use the service ceases
              immediately. Provisions that by their nature should survive termination shall survive,
              including limitations of liability and indemnification.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the
              State of [YOUR STATE], without regard to its conflict of law provisions. Any disputes
              arising from these Terms shall be resolved in the state or federal courts located in
              [YOUR STATE].
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">12. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of
              material changes via email or prominent notice on our platform. Your continued use of
              Vigil after such modifications constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">13. Contact Information</h2>
            <p className="text-gray-300 leading-relaxed">
              For questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 text-gray-300">
              <p>The Intelligence Company, LLC</p>
              <p>Email: legal@theintelligence.company</p>
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6">
          <Link to="/privacy" className="text-cyber-accent hover:underline">
            Privacy Policy
          </Link>
          <Link to="/" className="text-gray-400 hover:text-white">
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}
