import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z
    .object({
      slug: z
        .string()
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          "slug must be lowercase words separated by hyphens (e.g. invoice-follow-up-sequence)",
        )
        .optional(),
      title: z
        .string()
        .min(10, "title should be descriptive")
        .max(70, "title must be 70 characters or fewer"),
      description: z
        .string()
        .min(140, "description must be between 140 and 160 characters")
        .max(160, "description must be between 140 and 160 characters"),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string().min(1)).min(1, "at least one tag is required"),
      seoKeywords: z
        .array(z.string().min(1))
        .min(3, "at least 3 seoKeywords are required"),
      draft: z.boolean().default(false),
      heroImage: z.string().min(1).optional(),
      canonicalURL: z.string().url().optional(),
      readingTime: z.number().positive().optional(),
    })
    .strict(),
});

export const collections = { blog };
