import fs from 'node:fs';
import path from 'node:path';
import { getNextTopic } from './lib/topic-sources.mjs';
import { generateBlogPostDraft } from './lib/anthropic.mjs';
import { slugify } from './lib/slugify.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');

async function main() {
  const { topic, notes, source } = await getNextTopic();
  console.log(`[generate-post] 주제 소스: ${source}`);
  console.log(`[generate-post] 주제: ${topic}`);

  const draft = await generateBlogPostDraft({
    topic,
    notes,
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL,
  });

  const today = new Date().toISOString().slice(0, 10);
  let slug = slugify(draft.title);
  let filePath = path.join(BLOG_DIR, `${slug}.md`);

  // 같은 날 슬러그가 겹치면 뒤에 -2, -3 붙여서 회피
  let n = 2;
  while (fs.existsSync(filePath)) {
    filePath = path.join(BLOG_DIR, `${slug}-${n}.md`);
    n += 1;
  }
  slug = path.basename(filePath, '.md');

  const frontmatter = [
    '---',
    `title: ${yamlString(draft.title)}`,
    `description: ${yamlString(draft.description)}`,
    `pubDate: ${today}`,
    `tags: [${draft.tags.map((t) => yamlString(t)).join(', ')}]`,
    `topicSource: "${source}"`,
    'draft: false',
    '---',
    '',
  ].join('\n');

  const body = draft.body_markdown.replace('<!--AD_SLOT-->', '<!-- AD_SLOT: 광고 자동 삽입 위치 표시용, 렌더링에는 영향 없음 -->');

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.writeFileSync(filePath, frontmatter + body.trim() + '\n');

  console.log(`[generate-post] 작성 완료: ${filePath}`);

  // GitHub Actions에서 다음 스텝(PR 생성)이 쓸 수 있도록 env로 내보냄
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(
      process.env.GITHUB_ENV,
      `POST_TITLE=${draft.title}\nPOST_SLUG=${slug}\nTOPIC_SOURCE=${source}\n`
    );
  }
}

function yamlString(s) {
  return JSON.stringify(String(s));
}

main().catch((err) => {
  console.error('[generate-post] 실패:', err);
  process.exit(1);
});
