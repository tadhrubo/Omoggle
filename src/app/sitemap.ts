/*import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://omoggle.games',
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: 'https://omoggle.games/arena/casual',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: 'https://omoggle.games/arena/ranked',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]
}


*/

// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const blogSlugs = [
    'what-is-mogging',
    'omegle-alternatives-2026',
    'how-psl-rating-works',
    'looksmaxxing-guide-beginners',
    'hunter-eyes-vs-prey-eyes',
    'how-to-win-mog-battles',
  ]

  return [
    { url: 'https://omoggle.games', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://omoggle.games/faq', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...blogSlugs.map(slug => ({
      url: `https://omoggle.games/blog/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}