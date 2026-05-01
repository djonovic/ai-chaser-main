import { getCollection, type CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;
const blogEntryModules = import.meta.glob("/src/content/blog/**/*.{md,mdx}");

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function getPostSlug(post: BlogEntry): string {
  return post.data.slug ?? slugifyTitle(post.data.title);
}

export async function getPublishedBlogPosts(): Promise<BlogEntry[]> {
  if (Object.keys(blogEntryModules).length === 0) {
    return [];
  }

  let posts: BlogEntry[] = [];

  try {
    posts = await getCollection("blog", ({ data }) => !import.meta.env.PROD || !data.draft);
  } catch {
    // Return an empty list when the collection has no entries yet.
    // This keeps /blog, /rss.xml, and /blog-sitemap.xml deploy-safe for automation-first workflows.
    return [];
  }

  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getBlogUrl(post: BlogEntry): string {
  return `/blog/${getPostSlug(post)}/`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
