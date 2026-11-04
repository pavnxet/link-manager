import type { MetadataRoute } from 'next'

/** Only the entry point exists publicly; everything else is behind the login cookie. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://link-manager-lake.vercel.app').replace(/\/$/, '')
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
