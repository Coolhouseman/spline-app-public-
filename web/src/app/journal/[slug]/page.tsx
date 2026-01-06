import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { blogPosts } from "@/lib/blog";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = blogPosts.find((p) => p.slug === params.slug);
  
  if (!post) {
    return { title: "Article Not Found" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
      type: "article",
    },
  };
}

export function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export default function BlogPostPage({ params }: PageProps) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="min-h-screen bg-white pt-24 pb-24">
      {/* Header */}
      <div className="container mx-auto px-6 max-w-4xl text-center mb-16">
        <div className="flex justify-center gap-2 mb-8">
           {post.tags.map(tag => (
             <span key={tag} className="text-xs uppercase tracking-widest bg-stone-100 px-3 py-1 text-gray-600 rounded-full">{tag}</span>
           ))}
        </div>
        <h1 className="text-4xl md:text-6xl font-serif mb-8 text-gray-900 leading-tight">
          {post.title}
        </h1>
        <div className="flex justify-center items-center gap-4 text-sm text-gray-500 font-serif italic">
          <span>{post.date}</span>
          <span>&bull;</span>
          <span>{post.readTime}</span>
        </div>
      </div>

      {/* Hero Image */}
      <div className="w-full h-[60vh] relative mb-24">
        <Image 
          src={post.coverImage} 
          alt={post.title} 
          fill 
          className="object-cover"
          priority
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 max-w-3xl">
        <div 
          className="prose prose-lg prose-stone prose-p:font-light prose-headings:font-serif prose-headings:font-normal prose-a:text-gray-900 mx-auto"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
        
        {/* Post-footer */}
        <div className="mt-24 pt-12 border-t border-gray-100 text-center">
          <h3 className="font-serif text-2xl mb-6">Continue the Conversation</h3>
          <p className="text-gray-600 mb-8">
            Interested in how these philosophies translate to your home?
          </p>
          <Link href="/contact" className="inline-block bg-gray-900 text-white px-8 py-3 uppercase tracking-widest text-sm hover:bg-gray-700 transition-colors">
            Start a Commission
          </Link>
        </div>
      </div>
    </article>
  );
}

