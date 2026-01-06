import { Hero } from "@/components/sections/Hero";
import { FeatureSection } from "@/components/sections/FeatureSection";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mundi Collesi | Modern Hand-Painted Wallpapers",
  description: "Experience the new language of interior artistry. Mundi Collesi creates bespoke, hand-painted wallpapers that flatten nature into bold, post-modern environments.",
  openGraph: {
    title: "Mundi Collesi | Modern Hand-Painted Wallpapers",
    description: "Experience the new language of interior artistry. Bespoke, hand-painted wallpapers that flatten nature into bold, post-modern environments.",
    images: ["https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop"],
  },
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      
      <section className="py-24 px-6 bg-stone-50 text-center">
        <div className="container mx-auto max-w-4xl">
          <p className="text-2xl md:text-4xl font-serif leading-tight text-gray-800 italic">
            &quot;We do not paint illustrations of nature. We create immersive environments where flattened forms and bold silhouettes transform your residence into a living atmosphere.&quot;
          </p>
        </div>
      </section>

      <FeatureSection />

      {/* Our Process Section */}
      <section className="py-24 md:py-32 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16 md:mb-24">
            <h2 className="text-4xl md:text-6xl font-serif text-gray-900 mb-6">From Concept to Completion</h2>
            <div className="w-24 h-px bg-gray-900 mx-auto mb-6" />
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Every commission is a collaborative journey. We handle every detail from initial concept through final installation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {/* Step 1: Site Visit */}
            <div className="space-y-4">
              <div className="text-5xl font-serif text-gray-300 mb-4">01</div>
              <h3 className="text-2xl font-serif text-gray-900 mb-4">Site Visit</h3>
              <p className="text-gray-600 leading-relaxed">
                We visit your space. Understand the light. Listen to your vision. Our multi-disciplinary team—artists, designers, architects—collaborate to see what you see.
              </p>
            </div>

            {/* Step 2: Concept & Design */}
            <div className="space-y-4">
              <div className="text-5xl font-serif text-gray-300 mb-4">02</div>
              <h3 className="text-2xl font-serif text-gray-900 mb-4">Design Proposal</h3>
              <p className="text-gray-600 leading-relaxed">
                We propose a design that best fits your space and memory. Refined through internal collaboration until it feels right. Then we present it to you.
              </p>
            </div>

            {/* Step 3: Production */}
            <div className="space-y-4">
              <div className="text-5xl font-serif text-gray-300 mb-4">03</div>
              <h3 className="text-2xl font-serif text-gray-900 mb-4">Hand-Painted Production</h3>
              <p className="text-gray-600 leading-relaxed">
                Once approved, our artists hand-paint each panel. Every brushstroke intentional. Every detail considered.
              </p>
            </div>

            {/* Step 4: Installation */}
            <div className="space-y-4">
              <div className="text-5xl font-serif text-gray-300 mb-4">04</div>
              <h3 className="text-2xl font-serif text-gray-900 mb-4">Installation</h3>
              <p className="text-gray-600 leading-relaxed">
                Our expert installers handle each unique, non-repeatable pattern with precision. Special care for special work. Perfection from concept to completion.
              </p>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-8">
              We handle everything. From concept to completion.
            </p>
            <Link 
              href="/contact" 
              className="inline-block border border-gray-900 px-8 py-3 uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-colors text-sm"
            >
              Get in touch with us
            </Link>
          </div>
        </div>
      </section>

      {/* Collections Preview - Hidden for now */}
      <section className="hidden py-24 bg-neutral-900 text-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16">
            <div>
              <h2 className="text-4xl md:text-6xl font-serif mb-4">Our Collections</h2>
              <p className="text-neutral-400 max-w-md">Explore the narratives behind our post-modern series.</p>
            </div>
            <Link href="/collections" className="hidden md:block text-sm uppercase tracking-widest hover:text-gray-300 transition-colors mt-8 md:mt-0">
              View All Collections &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { slug: "royal-gardens", title: "The Royal Gardens", image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop" },
              { slug: "venetian-dreams", title: "Venetian Dreams", image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop" },
              { slug: "imperial-silk", title: "Imperial Silk", image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2680&auto=format&fit=crop" },
            ].map((collection) => (
              <Link href={`/collections/${collection.slug}`} key={collection.slug} className="group cursor-pointer">
                <div className="relative aspect-[3/4] overflow-hidden mb-6">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors z-10" />
                  <Image 
                    src={collection.image} 
                    alt={collection.title} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
                <h3 className="text-2xl font-serif mb-2">{collection.title}</h3>
                <span className="text-sm text-neutral-400 uppercase tracking-widest group-hover:text-white transition-colors">Read the Story</span>
              </Link>
            ))}
          </div>
          
          <div className="mt-12 text-center md:hidden">
            <Link href="/collections" className="text-sm uppercase tracking-widest hover:text-gray-300 transition-colors">
              View All Collections &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Materials Teaser */}
      <section className="relative h-[80vh] flex items-center justify-center">
        <Image 
          src="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/premium-silk-fabric-for-wallpaper-base-material.jpg" 
          alt="Premium Silk Fabric for Wallpaper Base Material" 
          fill 
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center text-white px-6">
          <h2 className="text-4xl md:text-7xl font-serif mb-6">The Materiality</h2>
          <p className="max-w-xl mx-auto text-lg mb-8 text-neutral-200">
            Understand the silk fabric, the pearlescent and iridescent finishes, and the hand-painted artistry. The foundation of our art is the material itself.
          </p>
          <Link href="/materials" className="inline-block border border-white px-8 py-3 uppercase tracking-widest hover:bg-white hover:text-black transition-colors">
            Explore Materials
          </Link>
        </div>
      </section>
    </div>
  );
}
