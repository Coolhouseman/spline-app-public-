import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";

// Mock Data
const collectionsData: Record<string, {
  title: string;
  subtitle: string;
  heroImage: string;
  inspiration: string;
  theory: string;
  process: string;
  detailImages: string[];
}> = {
  "royal-gardens": {
    title: "The Royal Gardens",
    subtitle: "Abstracted Flora",
    heroImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop",
    inspiration: "We looked to the structure of plants rather than their surface details. The curve of a fern, the radial geometry of a palm. We stripped away the texture to reveal the pure, architectural form of the garden.",
    theory: "This collection uses a flattened perspective, borrowing from Matisse's cut-outs. The plants are treated as blocks of color and shape, interacting in a rhythmic dance across the wall. It is a garden reimagined through the lens of modern graphic design.",
    process: "We apply solid blocks of gouache to create crisp, defined edges. The depth is achieved not through shading, but through the layering of shapes—opaque leaves overlapping translucent stems to create a sense of dense, lush vegetation without visual clutter.",
    detailImages: [
      "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=2600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1549495101-72f1737e937d?q=80&w=2671&auto=format&fit=crop"
    ]
  },
  "venetian-dreams": {
    title: "Venetian Dreams",
    subtitle: "Surrealist Waterscapes",
    heroImage: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop",
    inspiration: "Not the Venice of canals, but the Venice of memory—fragments of archways, reflections on water, and the interplay of light and shadow.",
    theory: "We deconstruct the elements of the city into abstract geometries. The water becomes a series of undulating lines; the architecture becomes a rhythm of arches. It is a dreamscape where gravity and perspective are suspended.",
    process: "Using a resist technique on silk, we create negative spaces that allow the metallic ground to shine through. The paint is applied in broad, sweeping strokes that prioritize movement and energy over architectural accuracy.",
    detailImages: [
      "https://images.unsplash.com/photo-1550616656-788812c7d95b?q=80&w=2670&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1516069974863-71c1800de1a4?q=80&w=2670&auto=format&fit=crop"
    ]
  },
  "imperial-silk": {
    title: "Imperial Silk",
    subtitle: "Modern Chinoiserie",
    heroImage: "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2680&auto=format&fit=crop",
    inspiration: "Traditional Chinoiserie focuses on delicate details. We focus on the bold silhouettes of birds and branches against vast fields of negative space.",
    theory: "We have updated the composition to suit the modern eye. The birds are stylized, almost logo-like in their simplicity. The branches are graphic lines that cut across the wall. It is an exercise in minimalism and restraint.",
    process: "We use a limited color palette—often monochromatic or duotone—to emphasize the form. The birds are painted with a single, continuous gesture, capturing the essence of flight rather than the detail of feathers.",
    detailImages: [
      "https://images.unsplash.com/photo-1622646279586-b48227b40d6f?q=80&w=2670&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1526304760382-3b5a68c8097d?q=80&w=2670&auto=format&fit=crop"
    ]
  }
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const collection = collectionsData[params.slug];
  
  if (!collection) {
    return {
      title: "Collection Not Found",
    };
  }

  return {
    title: collection.title,
    description: collection.inspiration.slice(0, 160) + "...",
    openGraph: {
      title: `${collection.title} | Mundi Collesi`,
      description: collection.subtitle,
      images: [collection.heroImage],
    },
  };
}

export default function CollectionStoryPage({ params }: { params: { slug: string } }) {
  const collection = collectionsData[params.slug];

  if (!collection) {
    notFound();
  }

  return (
    <article className="min-h-screen bg-stone-50 pb-24">
      {/* Hero */}
      <div className="relative h-[70vh] w-full">
        <Image 
          src={collection.heroImage} 
          alt={collection.title} 
          fill 
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-0 left-0 w-full p-12 text-white">
          <div className="container mx-auto">
            <h1 className="text-5xl md:text-8xl font-serif mb-4">{collection.title}</h1>
            <p className="text-xl md:text-2xl font-light tracking-widest uppercase opacity-90">{collection.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-24 max-w-4xl">
        {/* Inspiration */}
        <section className="mb-24 text-center">
          <span className="text-sm uppercase tracking-widest text-neutral-400 mb-4 block">The Inspiration</span>
          <p className="text-xl md:text-2xl font-serif leading-relaxed text-gray-800">
            {collection.inspiration}
          </p>
        </section>

        {/* Design Theory */}
        <section className="mb-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-serif">Design Theory</h2>
            <div className="w-12 h-px bg-gray-900" />
            <p className="text-gray-600 leading-relaxed text-lg">
              {collection.theory}
            </p>
          </div>
          <div className="relative aspect-square">
            <Image 
              src={collection.detailImages[0]} 
              alt="Detail" 
              fill 
              className="object-cover shadow-lg"
            />
          </div>
        </section>

        {/* Process */}
        <section className="mb-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-square md:order-2">
            <Image 
              src={collection.detailImages[1]} 
              alt="Process" 
              fill 
              className="object-cover shadow-lg"
            />
          </div>
          <div className="space-y-6 md:order-1">
            <h2 className="text-3xl font-serif">The Process</h2>
            <div className="w-12 h-px bg-gray-900" />
            <p className="text-gray-600 leading-relaxed text-lg">
              {collection.process}
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center border-t border-gray-200 pt-16">
          <p className="text-lg text-gray-500 mb-8 italic">
            &quot;To live with {collection.title} is to live inside a painting.&quot;
          </p>
          <Link 
            href={`/contact?subject=${encodeURIComponent(collection.title)}`}
            className="inline-block bg-gray-900 text-white px-12 py-4 uppercase tracking-widest hover:bg-gray-700 transition-colors"
          >
            Inquire About This Collection
          </Link>
        </div>
      </div>
    </article>
  );
}
