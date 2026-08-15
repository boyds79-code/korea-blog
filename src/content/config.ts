import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(), // meta description (SEO)
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // 이 글의 주제가 어디서 왔는지 기록 (manual = 직접 지정, trend = 자동 트렌드 소스)
    topicSource: z.enum(['manual', 'trend']).default('manual'),
    // 자동화 파이프라인이 생성했지만 아직 사람 검수 전인지 표시용 (PR 리뷰 단계에서는 항상 true로 시작)
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
