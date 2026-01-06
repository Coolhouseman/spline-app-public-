import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallpaper Collections",
  description: "Browse our exclusive collections of hand-painted wallpapers. Abstracted flora, surrealist waterscapes, and modern Chinoiserie.",
};

const collections = [
  {
    slug: "royal-gardens",
    title: "The Royal Gardens",
    description: "Abstracted botanical forms inspired by the structural geometry of plants.",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop"
  },
  {
    slug: "venetian-dreams",
    title: "Venetian Dreams",
    description: "A surrealist interpretation of water and architectural memory.",
    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop"
  },
  {
    slug: "imperial-silk",
    title: "Imperial Silk",
    description: "Graphic silhouettes of nature against vast fields of negative space.",
    image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2680&auto=format&fit=crop"
  }
];

export default function CollectionsPage() {
  return (
    <div className="pt-24 min-h-screen">
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-5xl font-serif mb-16 text-center">Our Collections</h1>
        
        <div className="grid grid-cols-1 gap-16">
          {collections.map((collection, index) => (
            <Link 
              key={collection.slug} 
              href={`/collections/${collection.slug}`}
              className="group flex flex-col md:flex-row gap-8 md:gap-16 items-center"
            >
              <div className={`w-full md:w-1/2 aspect-[4/3] relative overflow-hidden ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                <Image 
                  src={collection.image} 
                  alt={collection.title} 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className={`w-full md:w-1/2 space-y-4 ${index % 2 === 1 ? 'md:order-1 md:text-right' : ''}`}>
                <h2 className="text-4xl font-serif">{collection.title}</h2>
                <p className="text-gray-600 text-lg">{collection.description}</p>
                <div className={`text-sm uppercase tracking-widest text-neutral-400 group-hover:text-black transition-colors pt-4 ${index % 2 === 1 ? 'ml-auto' : ''}`}>
                  Discover the Story &rarr;
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
