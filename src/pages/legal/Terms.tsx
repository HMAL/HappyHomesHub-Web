import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../../components/shared/Footer';
import HHLogo from '../../components/brand/HHLogo';

const EFFECTIVE = 'June 6, 2026';
const COMPANY   = 'HappyHomesHub';
const EMAIL     = 'support@happyhomeshub.com';
const SITE      = 'https://happyhomeshub.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Terms() {
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
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400">Effective date: {EFFECTIVE}</p>
        </div>

        <Section title="1. Agreement to Terms">
          <p>
            By accessing or using HappyHomesHub ("{SITE}"), you agree to be bound by these Terms of
            Service ("Terms"). If you do not agree to all the Terms, you may not access the platform.
            These Terms apply to all visitors, landlords, tenants, handymen, and others who access or
            use the service.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and {COMPANY}
            ("we," "us," or "our"). We reserve the right to modify these Terms at any time.
            Continued use of the platform after changes constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            HappyHomesHub is a property management platform that connects landlords, tenants, and
            handymen. Features include rent tracking, maintenance request management, tenant
            onboarding, inspection reports, expense tracking, document storage, and in-platform
            messaging.
          </p>
          <p>
            The platform is intended for residential property management purposes in the United States.
            Use for any other purpose is subject to our approval.
          </p>
        </Section>

        <Section title="3. User Accounts & Roles">
          <p>
            You must create an account to use most features. You are responsible for maintaining the
            confidentiality of your account credentials and for all activity under your account.
          </p>
          <p>
            The platform supports three roles: <strong>Landlord</strong>, <strong>Tenant</strong>, and
            <strong> Handyman</strong>. A single account may hold multiple roles. Each role has access
            to different features appropriate to that relationship.
          </p>
          <p>
            You must be at least 18 years old to create an account. By creating an account, you
            represent that all information you provide is accurate, current, and complete.
          </p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the platform for any unlawful purpose or in violation of these Terms</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Upload false, misleading, or fraudulent information</li>
            <li>Attempt to gain unauthorized access to any account or system component</li>
            <li>Use automated tools to scrape, crawl, or extract data from the platform</li>
            <li>Violate any applicable federal, state, or local housing laws or regulations</li>
            <li>Discriminate against any person based on race, color, religion, national origin,
                sex, disability, or familial status in violation of the Fair Housing Act</li>
          </ul>
        </Section>

        <Section title="5. Subscription & Pricing">
          <p>
            <strong>Free trial:</strong> New landlord accounts include a 3-month free trial of the
            Super Landlord tier. You will not be charged during the trial and may cancel at any time
            before it ends.
          </p>
          <p>
            <strong>Plans (per property, per month):</strong> After the trial you choose a tier —
            <strong> Landlord</strong> at $7.00 or <strong>Super Landlord</strong> at $10.00 per
            property. Super Landlord additionally includes SMS alerts, extended photo retention,
            expense tracking, in-app handyman payouts and analytics. Promotional codes (such as the
            launch "first property free for 1 year" code) may reduce these amounts. Billing is managed
            through Stripe; you authorize us to charge your payment method monthly once the trial ends,
            until you cancel.
          </p>
          <p>
            <strong>Photo retention:</strong> On the Landlord tier, inspection and maintenance photos
            are retained for 1 month and then automatically deleted. On Super Landlord, they are
            retained until the lease ends plus 3 months, with advance notice before deletion. Lease and
            e-signed documents are retained on both tiers.
          </p>
          <p>
            Subscriptions auto-renew until cancelled. You may cancel at any time from the Billing
            settings page. Cancellation takes effect at the end of the current billing period. No
            partial refunds are provided for unused days.
          </p>
          <p>
            We reserve the right to modify pricing with 30 days' notice. Continued use after the
            notice period constitutes acceptance of the new pricing.
          </p>
        </Section>

        <Section title="6. User-Generated Content">
          <p>
            You retain ownership of all content you upload to the platform (lease documents, photos,
            messages, etc.). By uploading content, you grant us a non-exclusive, royalty-free,
            worldwide license to store, display, and transmit that content solely for the purpose of
            providing the service.
          </p>
          <p>
            You are solely responsible for the accuracy and legality of content you upload. We do not
            review or verify user-uploaded documents and are not responsible for their contents.
          </p>
        </Section>

        <Section title="7. Privacy">
          <p>
            Your use of the platform is also governed by our{' '}
            <Link to="/legal/privacy" className="text-blue-600 underline">Privacy Policy</Link>,
            which is incorporated into these Terms by reference.
          </p>
        </Section>

        <Section title="8. Disclaimers">
          <p>
            The platform is provided "as is" and "as available" without warranties of any kind,
            either express or implied. We do not warrant that the platform will be error-free,
            uninterrupted, or free of viruses or other harmful components.
          </p>
          <p>
            HappyHomesHub is a technology platform and is not a licensed real estate broker, property
            manager, attorney, or financial advisor. Nothing on the platform constitutes legal,
            financial, or real estate advice.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, {COMPANY} shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of the
            platform, even if advised of the possibility of such damages.
          </p>
          <p>
            Our total liability to you for any claims arising under these Terms shall not exceed the
            greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) $50.
          </p>
        </Section>

        <Section title="10. Indemnification">
          <p>
            You agree to indemnify and hold harmless {COMPANY} and its officers, directors, employees,
            and agents from any claims, damages, losses, or expenses (including legal fees) arising
            from your use of the platform, your violation of these Terms, or your violation of any
            third party's rights.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            We may suspend or terminate your account at any time, with or without cause, including
            for violation of these Terms. Upon termination, your right to use the platform ceases
            immediately.
          </p>
          <p>
            You may terminate your account at any time by contacting us at{' '}
            <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">{EMAIL}</a>.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Texas, without regard to its
            conflict of law provisions. Any disputes shall be resolved in the state or federal courts
            located in Texas, and you consent to personal jurisdiction in those courts.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms may be directed to:{' '}
            <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">{EMAIL}</a>
          </p>
        </Section>

        <div className="border-t border-gray-100 pt-6 mt-6">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link to="/legal/privacy" className="hover:text-gray-700 underline">Privacy Policy</Link>
            <Link to="/" className="hover:text-gray-700">← Back to Home</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
