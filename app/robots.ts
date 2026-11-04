import type { MetadataRoute } from 'next'

/**
 * Link Vault is a private, single-user vault: there is nothing here for a crawler to index, and an
 * indexed login page is pure noise in search results. Metadata and Open Graph tags still make
 * shared links preview properly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://link-manager-lake.vercel.app').replace(/\/$/, '')
}
