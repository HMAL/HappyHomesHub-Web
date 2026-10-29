import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../../components/shared/Footer';
import HHLogo from '../../components/brand/HHLogo';

const EFFECTIVE = 'June 13, 2026';
const COMPANY   = 'HappyHomesHub';
const EMAIL     = 'support@happyhomeshub.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <HHLogo variant="full" theme="light" size={44} />
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Legal</p>
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Effective date: {EFFECTIVE}</p>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          {COMPANY} ("we," "us," or "our") operates HappyHomesHub. This Privacy Policy explains how
          we collect, use, disclose, and protect your personal information when you use our platform.
          By using HappyHomesHub, you agree to the practices described in this policy.
        </p>

        <Section title="1. Information We Collect">
          <p><strong>Information you provide directly:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: name, email address, phone number</li>
            <li>Profile information: role (landlord/tenant/handyman), profile photo</li>
            <li>Property information: address, unit details, lease terms</li>
            <li>Rental application data: employment, income, references, background check consent</li>
            <li>Payment information: processed by Stripe — we do not store raw card numbers</li>
            <li>Communications: messages sent through the platform</li>
            <li>Documents: lease agreements, inspection reports, and other uploaded files</li>
          </ul>

          <p><strong>Information collected automatically:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Usage data: pages viewed, features used, session duration</li>
            <li>Device information: browser type, operating system, IP address</li>
            <li>Cookies and similar tracking technologies (see Section 6)</li>
            <li>Analytics data via Google Analytics (anonymized)</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide, operate, and maintain the platform</li>
            <li>Authenticate your identity and secure your account</li>
            <li>Facilitate connections between landlords, tenants, and handymen</li>
            <li>Process subscription payments via Stripe</li>
            <li>Send transactional emails (password reset, invite notifications)</li>
            <li>Respond to support requests and inquiries</li>
            <li>Analyze platform usage to improve features</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>
            We do not sell your personal information to third parties. We do not use your data for
            advertising or share it with data brokers.
          </p>
        </Section>

        <Section title="3. How We Share Your Information">
          <p>We share your information only in these limited circumstances:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Between platform participants:</strong> Landlords see their tenants' profiles
              and application data. Tenants see their landlord's name and contact details. Handymen
              see job details submitted by landlords/tenants.
            </li>
            <li>
              <strong>Service providers:</strong> We use Supabase (database/auth), Stripe (payments),
              and Google Analytics (usage analytics). Each is bound by their own privacy policies.
            </li>
            <li>
              <strong>Legal requirements:</strong> We may disclose your information if required by
              law, court order, or to protect the rights and safety of our users or others.
            </li>
            <li>
              <strong>Business transfers:</strong> If we are acquired or merge with another company,
              your data may be transferred as part of that transaction.
            </li>
          </ul>
        </Section>

        <Section title="4. Applicant Screening Data (TransUnion SmartCheck)">
          <p>
            When an applicant purchases a screening package, we use TransUnion SmartCheck to obtain a
            credit report, criminal background check, eviction history, income insights, and identity
            verification on their behalf. This is governed by the Fair Credit Reporting Act (FCRA).
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Screening is only initiated after the applicant provides explicit written consent via the application form</li>
            <li>TransUnion SmartCheck processes the screening directly and returns results to HappyHomesHub</li>
            <li>Screening results (score, recommendation, report status) are stored in our database and accessible
                only to the applicant and landlords to whom the applicant has applied</li>
            <li>Raw report data (full credit report PDF) is accessible via a secure link and is not stored permanently on our servers</li>
            <li>Screening records are retained for the duration of the 90-day validity period, then for up to
                7 years as required by FCRA record-keeping obligations</li>
            <li>If a landlord takes adverse action based on a screening report, they are responsible for
                providing the required FCRA adverse action notice to the applicant</li>
          </ul>
          <p>
            TransUnion SmartCheck is subject to its own privacy policy. For questions about your TransUnion
            consumer file, visit{' '}
            <a href="https://www.transunion.com/consumer-privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              TransUnion's Consumer Privacy page
            </a>.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain your personal information for as long as your account is active or as needed
            to provide the service. If you close your account, we delete your personal data within
            90 days, except where we are required by law to retain it longer.
          </p>
          <p>
            Certain aggregated, anonymized data may be retained indefinitely for analytical purposes.
          </p>
        </Section>

        <Section title="6. Data Security">
          <p>
            We implement industry-standard security measures including:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>TLS/HTTPS encryption for all data in transit</li>
            <li>Row Level Security (RLS) enforced at the database layer — users can only access
                their own data</li>
            <li>Passwords are never stored in plaintext (handled by Supabase Auth)</li>
            <li>Regular security audits of our infrastructure</li>
          </ul>
          <p>
            No method of transmission over the internet or electronic storage is 100% secure. We
            cannot guarantee absolute security, but we are committed to protecting your data using
            commercially reasonable means.
          </p>
        </Section>

        <Section title="7. Cookies & Tracking">
          <p>
            We use cookies and similar technologies for:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Authentication:</strong> Keeping you logged in (stored in localStorage via Supabase)</li>
            <li><strong>Analytics:</strong> Google Analytics uses cookies to understand how visitors
                use our site. IP addresses are anonymized. You can opt out via
                {' '}<a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google's opt-out tool</a>.
            </li>
          </ul>
          <p>
            You can control cookies through your browser settings. Disabling cookies may limit
            platform functionality.
          </p>
        </Section>

        <Section title="8. Your Rights">
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
            <li><strong>Correction:</strong> Update inaccurate or incomplete information via your account settings</li>
            <li><strong>Deletion:</strong> Request that we delete your account and personal data</li>
            <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
            <li><strong>Opt-out:</strong> Unsubscribe from marketing communications at any time</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">{EMAIL}</a>.
            We will respond within 30 days.
          </p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>
            HappyHomesHub is not directed at or intended for children under 18 years of age. We do
            not knowingly collect personal information from minors. If you believe a minor has
            provided us with personal information, please contact us immediately.
          </p>
        </Section>

        <Section title="10. Third-Party Links">
          <p>
            Our platform may contain links to third-party websites. We are not responsible for the
            privacy practices of those sites and encourage you to review their privacy policies.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the new policy on this page and updating the effective date. Your
            continued use of the platform after changes are posted constitutes your acceptance.
          </p>
        </Section>

        <Section title="12. Contact Us">
          <p>
            If you have questions or concerns about this Privacy Policy, please contact us:
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mt-2">
            <p className="font-semibold text-gray-800">{COMPANY}</p>
            <p>Email: <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">{EMAIL}</a></p>
          </div>
        </Section>

        <div className="border-t border-gray-100 pt-6 mt-6">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/legal/terms" className="hover:text-gray-700 underline">Terms of Service</Link>
            <Link to="/" className="hover:text-gray-700">← Back to Home</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
