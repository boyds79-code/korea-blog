import { defineCollection, z } from 'astro:content';

// 공통 필드 (모든 카테고리 공통)
const baseFields = {
  title: z.string(),
  description: z.string(), // meta description (SEO)
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  heroImage: z.string().optional(),
  heroImageAlt: z.string().optional(),
  heroImageCredit: z.string().optional(),
  heroImageCreditUrl: z.string().optional(),
};

const korea = defineCollection({
  type: 'content',
  schema: z.object({
    ...baseFields,
    topicSource: z.enum(['manual', 'trend']).default('manual'),
  }),
});

const beauty = defineCollection({
  type: 'content',
  schema: z.object({
    ...baseFields,
    topicSource: z.enum(['manual', 'trend']).default('manual'),
  }),
});

const entertainment = defineCollection({
  type: 'content',
  schema: z.object({
    ...baseFields,
    topicSource: z.enum(['manual']).default('manual'),
  }),
});

const recipes = defineCollection({
  type: 'content',
  schema: z.object({
    ...baseFields,
    tier: z.enum(['popular', 'chef-simple', 'manual']).default('manual'),
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    servings: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    ingredients: z.array(z.string()).default([]),
  }),
});

export const collections = { korea, recipes, entertainment, beauty };
