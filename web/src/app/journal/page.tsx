import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { blogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "The Journal | Mundi Collesi",
  description: "Insights on slow design, craftsmanship, and the art of living. Read our latest stories.",
};

export default function JournalPage() {
  return (
    <div className="pt-24 min-h-screen bg-stone-50">
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-24 max-w-2xl mx-auto">
          <h1 className="text-5xl font-serif mb-6 text-gray-900">The Journal</h1>
          <p className="text-lg text-gray-600">
            Chronicles of the studio. We explore the philosophy behind our craft and the role of beauty in the modern age.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {blogPosts.map((post) => (
            <article key={post.slug} className="flex flex-col group cursor-pointer">
              <Link href={`/journal/${post.slug}`} className="block overflow-hidden mb-6 aspect-[16/10] relative">
                 <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors z-10" />
                <Image 
                  src={post.coverImage} 
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </Link>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-gray-500">
                  <span>{post.date}</span>
                  <span>|</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="text-3xl font-serif leading-tight group-hover:text-gray-600 transition-colors">
                  <Link href={`/journal/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  {post.excerpt}
                </p>
                <Link href={`/journal/${post.slug}`} className="inline-block text-xs uppercase tracking-widest border-b border-gray-900 pb-1 pt-2">
                  Read Story
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

