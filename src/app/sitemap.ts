import { MetadataRoute } from 'next';
import { getAllBlogs } from '@/lib/mdx';

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE_URL = 'https://omoggle.games';

  // 1. Core Static Routes
  const staticRoutes = [
    { url: '', priority: 1.0, changeFrequency: 'always' as const },
    { url: '/arena/casual', priority: 0.9, changeFrequency: 'daily' as const },
    { url: '/arena/ranked', priority: 0.9, changeFrequency: 'daily' as const },
    { url: '/blog', priority: 0.8, changeFrequency: 'daily' as const },
    { url: '/faq', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/app', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/ranks', priority: 0.8, changeFrequency: 'weekly' as const },
  ].map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // 2. Dynamic Blog Routes
  const posts = getAllBlogs();
  const dynamicRoutes = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.meta.publishedAt || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // 3. Combine and Return
  return [...staticRoutes, ...dynamicRoutes];
}