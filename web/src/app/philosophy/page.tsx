import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Philosophy | Post-Modern Naturalism",
  description: "Mundi Collesi challenges traditional realism. We create immersive spaces through flattened forms, bold silhouettes, and the slow art of hand-painting.",
};

export default function PhilosophyPage() {
  return (
    <div className="pt-24 min-h-screen">
      {/* Hero Text */}
      <section className="container mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl md:text-8xl font-serif mb-8 text-gray-900">Our Philosophy</h1>
        <div className="max-w-2xl mx-auto">
          <p className="text-xl md:text-2xl font-light leading-relaxed text-gray-600">
            In an age of hyper-realism, we choose abstraction. Every wall we paint is customized, unique, and never repeated. Each piece will create memories that belong uniquely to you and your family.
          </p>
        </div>
      </section>

      {/* Full Width Image */}
      <div className="relative w-full h-[60vh] mb-24">
        <Image
          src="https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?q=80&w=2670&auto=format&fit=crop"
          alt="Artist Studio"
          fill
          className="object-cover"
        />
      </div>

      <div className="container mx-auto px-6 max-w-4xl space-y-24 pb-24">
        <section className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="text-3xl font-serif text-gray-900 sticky top-32">The Flattened Form</h2>
          </div>
          <div className="md:col-span-8 space-y-6 text-gray-600 text-lg leading-relaxed">
            <p>
              We believe that the wall should remain a wall, not a window. By flattening the perspective of plants and animals, 
              we create a graphic rhythm that feels modern and architectural. We strip away the unnecessary details of realism 
              to reveal the pure, essential shape of nature.
            </p>
            <p>
              This commitment to &quot;Post-Modern Naturalism&quot; ensures that the energy of the room is defined by bold silhouettes 
              and negative space, rather than the busy noise of traditional botanical illustration.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="text-3xl font-serif text-gray-900 sticky top-32">Environment, Not Decoration</h2>
          </div>
          <div className="md:col-span-8 space-y-6 text-gray-600 text-lg leading-relaxed">
            <p>
              Our clients do not buy our products to hang a picture. They commission us to transform a space into an experience. 
              We sell the immersion of a stylized jungle, the quietude of an abstract garden, and the mood of a color field.
            </p>
            <p>
              A Mundi Collesi room is a backdrop for life&apos;s most important moments. It elevates the everyday into the cinematic.  
              It is a declaration that design is not just about what you see, but how you feel within a space.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <h2 className="text-3xl font-serif text-gray-900 sticky top-32">Heritage & Future</h2>
          </div>
          <div className="md:col-span-8 space-y-6 text-gray-600 text-lg leading-relaxed">
            <p>
              While our techniques—hand-painting on silk fabric with pearlescent and iridescent finishes, executed by our dedicated studio 
              of artists—honor traditional craftsmanship, our vision is firmly in the future. We collaborate with contemporary designers 
              to reinterpret nature for the modern aesthetic. We use time-honored methods to create undeniably contemporary art that 
              speaks to the present while drawing from centuries of artistic heritage.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
