import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mundicollesi.com';

  // Static pages
  const routes = [
    '',
    '/collections',
    '/journal',
    '/materials',
    '/philosophy',
    '/contact',
    '/privacy-policy',
    '/terms-of-service',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Dynamic collections
  const collections = [
    'royal-gardens',
    'venetian-dreams',
    'imperial-silk',
  ].map((slug) => ({
    url: `${baseUrl}/collections/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  // Journal Posts
  const blogPosts = [
    'renaissance-of-slow-design',
    'living-with-art-emotion',
  ].map((slug) => ({
    url: `${baseUrl}/journal/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...routes, ...collections, ...blogPosts];
}
