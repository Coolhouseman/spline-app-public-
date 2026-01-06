"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ContactFormContent() {
  const searchParams = useSearchParams();
  const initialSubject = searchParams.get("subject") ? `Inquiry: ${searchParams.get("subject")}` : "";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: initialSubject,
    message: "",
  });

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 py-12 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32">
          {/* Contact Info Side */}
          <div className="space-y-12">
            <div>
              <h1 className="text-5xl md:text-6xl font-serif mb-6 text-gray-900">Get in Touch</h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                We invite you to discuss your vision with us. Whether you are looking for a specific collection or a bespoke commission, 
                we are here to guide you through the process.
              </p>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-serif">Mundi Collesi Studio</h3>
              <p className="text-gray-600">
                Auckland, New Zealand<br />
                By Appointment Only
              </p>
            </div>

            <div className="p-6 bg-white border border-gray-200">
              <h4 className="font-serif text-lg mb-2">A Note on Purchasing</h4>
              <p className="text-sm text-gray-500 leading-relaxed">
                As purveyors of bespoke artistry, we do not offer instant online purchasing. Each commission is handled personally. 
                Payments are processed via secure bank transfer upon invoice approval. This ensures that every detail of your order is verified before production begins.
              </p>
            </div>
          </div>

          {/* Form Side */}
          <div className="bg-white p-8 md:p-12 shadow-sm">
            {status === "success" ? (
              <div className="text-center py-24 space-y-4">
                <h3 className="text-3xl font-serif text-gray-900">Thank You</h3>
                <p className="text-gray-600">We have received your inquiry and will be in touch shortly.</p>
                <button 
                  onClick={() => setStatus("idle")}
                  className="mt-8 text-sm uppercase tracking-widest border-b border-gray-900 pb-1"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div>
                  <label htmlFor="name" className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 bg-transparent transition-colors"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 bg-transparent transition-colors"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Phone (Optional)</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 bg-transparent transition-colors"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Subject</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 bg-transparent transition-colors"
                    placeholder="General Inquiry"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-gray-900 bg-transparent resize-none transition-colors"
                    placeholder="Tell us about your project..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full bg-gray-900 text-white py-4 uppercase tracking-widest hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {status === "submitting" ? "Sending..." : "Submit Inquiry"}
                </button>
                
                {status === "error" && (
                  <p className="text-red-500 text-sm text-center">Something went wrong. Please try again.</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactForm() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContactFormContent />
    </Suspense>
  );
}

