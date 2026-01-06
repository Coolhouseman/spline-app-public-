import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Mundi Collesi. Learn how we handle your data and personal information.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function PrivacyPolicy() {
  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-serif mb-8 text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-12 uppercase tracking-widest">Last Updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">1. Introduction</h2>
            <p>
              Mundi Collesi (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting the personal information 
              that you share with us. This Privacy Policy outlines how we collect, use, and safeguard your data when you visit our 
              website or engage our bespoke design and installation services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">2. Information We Collect</h2>
            <p>We may collect personal information that you voluntarily provide to us, including but not limited to:</p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>Contact information (Name, Email Address).</li>
              <li>Project details, including property location and design preferences.</li>
              <li>Communication history regarding your inquiries and commissions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">3. How We Use Your Information</h2>
            <p>Your information is used solely for the purpose of facilitating our services, which include:</p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>Responding to your inquiries and consultation requests.</li>
              <li>Processing your bespoke wallpaper orders and managing the design process.</li>
              <li>Coordinating installation services.</li>
              <li>Internal record keeping and legal compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">4. Data Protection & Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal identification information to others. We may share your information with 
              trusted third-party service providers (such as specialist installers or logistics partners) only as necessary to complete 
              your commission. All third parties are strictly prohibited from using your personal information for any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4 text-gray-900">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please use our contact form on the website to submit your queries.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
