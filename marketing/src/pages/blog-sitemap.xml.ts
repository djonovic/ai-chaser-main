import type { APIRoute } from "astro";
import { getBlogUrl, getPublishedBlogPosts } from "../utils/blog";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPublishedBlogPosts();
  const base = site ?? new URL("https://chaseai.app");

  const urls = posts
    .map((post) => {
      const loc = new URL(getBlogUrl(post), base).toString();
      const lastmod = (post.data.updatedDate ?? post.data.pubDate).toISOString();

      return `<url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
};
