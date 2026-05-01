import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getBlogUrl, getPublishedBlogPosts } from "../utils/blog";

export const GET: APIRoute = async (context) => {
  const posts = await getPublishedBlogPosts();

  return rss({
    title: "ChaseAI Blog",
    description:
      "Invoice follow-up templates, guides, and automation playbooks to reduce late payments and improve cash flow.",
    site: context.site ?? "https://chaseai.app",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: getBlogUrl(post),
      categories: post.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
};
