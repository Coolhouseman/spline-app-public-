import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Materials & Craftsmanship",
  description: "Discover the silk fabric substrates, pearlescent textures, and seamless craftsmanship that define the Mundi Collesi difference.",
};

export default function MaterialsPage() {
  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 py-12 md:py-24">
        <div className="max-w-4xl mx-auto text-center mb-24">
          <h1 className="text-5xl md:text-7xl font-serif mb-8 text-gray-900">The Fabric of Excellence</h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            True luxury begins with the substrate. We do not paint on paper; we paint on history, texture, and light. 
            Understanding our materials is essential to appreciating the value of a Mundi Collesi commission.
          </p>
        </div>

        <div className="space-y-32">
          {/* Silk Fabric Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-square md:aspect-[4/5] order-2 md:order-1">
              <Image 
                src="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/silk-fabric-matte-color.webp" 
                alt="Silk Fabric Texture" 
                fill 
                className="object-cover shadow-xl"
              />
            </div>
            <div className="space-y-6 order-1 md:order-2">
              <h2 className="text-4xl font-serif text-gray-900">Silk Fabric Material</h2>
              <div className="w-16 h-px bg-gray-400" />
              <p className="text-gray-600 leading-relaxed">
                Our primary canvas is premium silk fabric, chosen for its luminous quality and ability to interact dynamically with light. 
                Unlike paper, silk transforms throughout the day, creating a living surface that responds to natural and artificial illumination. 
                The fabric&apos;s natural texture provides depth and tactility, ensuring that each hand-painted design has a foundation worthy of the artistry applied to it.
              </p>
            </div>
          </section>

          {/* Pearlescent & Iridescent Texture Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-serif text-gray-900">Pearlescent & Iridescent Textures</h2>
              <div className="w-16 h-px bg-gray-400" />
              <p className="text-gray-600 leading-relaxed">
                The signature of a Mundi Collesi wallpaper lies in its finish: pearlescent textures and iridescent effects 
                that create an ever-changing surface. As light moves across the wall, these finishes shift and transform, revealing hidden depths 
                and creating a sense of movement within static patterns. This pearlized finish is not a simple coating but a carefully applied 
                technique that enhances the hand-painted design while adding a layer of sophistication and depth.
              </p>
              <p className="text-gray-600 leading-relaxed">
                The pearlescent quality interacts with both natural daylight and evening illumination, ensuring that your wallpaper never appears 
                static. It breathes with the room, adapting to the time of day and the quality of light, creating an immersive environment that 
                feels alive and responsive.
              </p>
            </div>
            <div className="relative aspect-square md:aspect-[4/5]">
              <Image 
                src="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/iredescent-wall-paper-silk-material.JPG" 
                alt="Pearlescent Texture Detail" 
                fill 
                className="object-cover shadow-xl"
              />
            </div>
          </section>

          {/* Seamless Installation Section */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="relative aspect-square md:aspect-[4/5] order-2 md:order-1">
              <Image 
                src="https://hozn2hsy91dhisxu.public.blob.vercel-storage.com/amazon-forest-hand-painted-irredescent-wallpaper.JPG" 
                alt="Seamless Wallpaper Installation" 
                fill 
                className="object-cover shadow-xl"
              />
            </div>
            <div className="space-y-6 order-1 md:order-2">
              <h2 className="text-4xl font-serif text-gray-900">Seamless Paper Join</h2>
              <div className="w-16 h-px bg-gray-400" />
              <p className="text-gray-600 leading-relaxed">
                Perfection lies in the details. Our seamless paper join technique ensures that installation creates a continuous, 
                unbroken surface. There are no visible seams, no interruptions in the pattern, no reminders that the wall is composed of separate panels. 
                The result is a flawless expanse of art that reads as a single, unified composition.
              </p>
              <p className="text-gray-600 leading-relaxed">
                This seamless installation is achieved through meticulous precision in both manufacturing and application. Our installation team 
                works with the same attention to detail as our artists, ensuring that the final result is as perfect as the design itself.
              </p>
            </div>
          </section>

          {/* Custom Color Palette Section */}
          <section className="max-w-4xl mx-auto">
            <div className="space-y-6">
              <h2 className="text-4xl font-serif text-gray-900">Custom Color Selection</h2>
              <div className="w-16 h-px bg-gray-400" />
              <p className="text-gray-600 leading-relaxed">
                At Mundi Collesi, we do not work from a fixed color palette. The base color of each wallpaper is selected through a thoughtful 
                process that begins with understanding your vision and your space. We believe that the perfect color is not found in a catalog—it 
                is discovered through careful consideration of memory, feeling, and design intent.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Our process begins with a site visit, where we study the architecture, natural light patterns, existing furnishings, and most 
                importantly, listen to understand what memory and feeling you wish to evoke in the space. Based on these insights, combined with 
                the pattern design we develop for your commission, we select a base color that we believe is most suitable. This color becomes 
                the foundation upon which the hand-painted design is applied, ensuring that the final piece harmonizes perfectly with its 
                environment while capturing the emotional resonance you seek.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
