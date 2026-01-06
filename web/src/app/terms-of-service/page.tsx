import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Mundi Collesi. Understand our bespoke commission process, lead times, and payment terms.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function TermsOfService() {
  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-serif mb-8 text-gray-900">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-12 uppercase tracking-widest">Effective Date: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">1. Agreement to Terms</h2>
            <p>
              These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&quot;client&quot;), 
              and Mundi Collesi (&quot;we,&quot; &quot;us&quot; or &quot;our&quot;), concerning your access to and use of our bespoke wallpaper design and installation services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">2. Nature of Bespoke Services</h2>
            <p>
              We provide high-end, hand-painted, and customized wallpaper solutions. Due to the artisanal nature of our products:
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li><strong>Variations:</strong> Slight variations in color, texture, and pattern are inherent to hand-painted works and natural materials (such as silk). These are marks of authenticity, not defects.</li>
              <li><strong>Samples:</strong> While we strive for accuracy, final production may differ slightly from initial samples or digital renderings due to dye lot variations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">3. Orders & Lead Times</h2>
            <p>
              <strong>Confirmation:</strong> An order is considered confirmed only upon receipt of the agreed deposit and signed approval of the final design proofs.
            </p>
            <p className="mt-4">
              <strong>Production Timeline:</strong> Our standard production lead time is approximately <strong>90 days</strong> from the date of final design confirmation. This timeline allows for the meticulous hand-painting and drying processes required for our premium materials. While we make every effort to meet these timelines, delays due to unforeseen circumstances or material sourcing will be communicated promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">4. Payment Terms</h2>
            <p>
              All payments are to be made via bank transfer. We do not process payments through online third-party gateways.
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>A non-refundable deposit (typically 50%) is required to commence production.</li>
              <li>The remaining balance is due prior to shipping or scheduling installation.</li>
              <li>Ownership of the goods remains with Mundi Collesi until full payment has been received.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">5. Installation</h2>
            <p>
              We provide professional installation services for our products. 
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li><strong>Site Readiness:</strong> The client is responsible for ensuring the site is ready for installation (walls primed, clean, and dry). Delays caused by site unreadiness may incur additional fees.</li>
              <li><strong>Liability:</strong> While our installers exercise the utmost care, we are not liable for pre-existing structural issues with the walls that may affect the installation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">6. Returns & Cancellations</h2>
            <p>
              As all our products are made-to-order and customized to your specific dimensions and preferences, <strong>all sales are final</strong>. 
              Cancellations cannot be accepted once production has commenced.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">7. Contact Information</h2>
            <p>
              For inquiries regarding these terms, please use our contact form on the website to submit your queries.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
