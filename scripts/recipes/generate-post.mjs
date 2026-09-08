import fs from 'node:fs';
import path from 'node:path';
import { getNextTopic } from './lib/topic-sources.mjs';
import { generateRecipeDraft, SLUG_PLACEHOLDER } from './lib/anthropic.mjs';
import { generateImage } from './lib/gemini-images.mjs';
import { slugify } from './lib/slugify.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'recipes');

async function main() {
  const { dish, notes, tier, referenceStyle } = await getNextTopic();
  console.log(`[generate-post] 티어: ${tier}`);
  console.log(`[generate-post] 요리: ${dish}`);

  const draft = await generateRecipeDraft({
    dish,
    notes,
    tier,
    referenceStyle,
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL,
  });

  const today = new Date().toISOString().slice(0, 10);
  let slug = slugify(draft.title);
  let filePath = path.join(BLOG_DIR, `${slug}.md`);

  let n = 2;
  while (fs.existsSync(filePath)) {
    filePath = path.join(BLOG_DIR, `${slug}-${n}.md`);
    n += 1;
  }
  slug = path.basename(filePath, '.md');

  // 이 블로그는 항상 정확히 2장(완성 사진 + 재료 사진)만 필요합니다.
  const imagePlan = [
    { filename: 'finished.jpg', alt: draft.finished_photo.alt, ai_prompt: draft.finished_photo.ai_prompt, isCover: true },
    { filename: 'ingredients.jpg', alt: draft.ingredients_photo.alt, ai_prompt: draft.ingredients_photo.ai_prompt },
  ];

  // GEMINI_API_KEY가 있으면 두 이미지를 자동으로 생성해서 바로 폴더에 저장 시도.
  // 실패한 이미지(키 없음/네트워크 오류/안전 필터 차단 등)는 auto=false로 표시되고,
  // 아래에서 사람이 직접 채워야 할 체크리스트로 남습니다.
  const geminiKey = process.env.GEMINI_API_KEY;
  const imagesDir = path.join(ROOT, 'public', 'images', 'recipes', slug);
  if (geminiKey) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log('[generate-post] GEMINI_API_KEY 감지됨 — 이미지 2장 자동 생성 시도 중...');
  } else {
    console.log('[generate-post] GEMINI_API_KEY가 없어 이미지는 자동 생성하지 않습니다 (수동 체크리스트로 남김).');
  }

  for (const img of imagePlan) {
    if (!geminiKey) {
      img.auto = false;
      continue;
    }
    const buf = await generateImage({
      prompt: img.ai_prompt,
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL,
    });
    if (buf) {
      fs.writeFileSync(path.join(imagesDir, img.filename), buf);
      console.log(`[generate-post]   ✅ 자동 생성 완료: ${img.filename}`);
      img.auto = true;
    } else {
      console.log(`[generate-post]   ⚠️  자동 생성 실패, 수동 체크리스트로 남김: ${img.filename}`);
      img.auto = false;
    }
  }
  const allAuto = imagePlan.every((img) => img.auto);
  const needsManual = imagePlan.filter((img) => !img.auto);

  const frontmatter = [
    '---',
    `title: ${yamlString(draft.title)}`,
    `description: ${yamlString(draft.description)}`,
    `pubDate: ${today}`,
    `tags: [${draft.tags.map((t) => yamlString(t)).join(', ')}]`,
    `tier: "${tier === 'popular' || tier === 'chef-simple' ? tier : 'manual'}"`,
    'draft: false',
    `prepTime: ${yamlString(draft.prep_time)}`,
    `cookTime: ${yamlString(draft.cook_time)}`,
    `servings: ${yamlString(draft.servings)}`,
    `difficulty: "${draft.difficulty}"`,
    'ingredients:',
    ...draft.ingredients.map((i) => `  - ${yamlString(i)}`),
    `heroImage: ${yamlString(`/images/recipes/${slug}/finished.jpg`)}`,
    `heroImageAlt: ${yamlString(draft.finished_photo.alt)}`,
    '---',
    '',
  ].join('\n');

  // Claude가 재료 사진 자리에 써넣은 {{SLUG}} placeholder를 실제 슬러그로 치환
  let body = draft.body_markdown.replaceAll(SLUG_PLACEHOLDER, slug);
  body = body.replace('<!--AD_SLOT-->', '<!-- AD_SLOT: 광고 자동 삽입 위치 표시용, 렌더링에는 영향 없음 -->');

  let checklist;
  if (needsManual.length > 0) {
    const someAuto = imagePlan.length > needsManual.length;
    checklist = [
      '<!--',
      someAuto
        ? `🎨 이미지 ${imagePlan.length - needsManual.length}장은 AI로 자동 생성되어 이미 폴더에 들어가 있습니다. 아래 ${needsManual.length}장만 직접 준비해주세요.`
        : `🎨 이 레시피에 필요한 AI 생성 이미지 2장 (머지 전에 준비해서 넣어주세요) — 아래 프롬프트로 AI가 생성한 이미지를 씁니다.`,
      `무료 생성 도구: https://www.bing.com/images/create (Microsoft 계정만 있으면 무료) — 아래 프롬프트를 그대로 복사해서 붙여넣으세요.`,
      `생성한 이미지는 public/images/recipes/${slug}/ 폴더 안에 아래 파일명 그대로 저장하면 자동으로 연결됩니다.`,
      ...needsManual.map((img, i) => `${i + 1}. ${img.filename}${img.isCover ? ' (대표/커버 이미지)' : ''} — 프롬프트: ${img.ai_prompt}`),
      '-->',
      '',
    ].join('\n');
  } else {
    checklist = [
      '<!--',
      `✅ 이미지 2장 모두 AI로 자동 생성되어 이미 폴더에 들어가 있습니다 (public/images/recipes/${slug}/). 내용만 확인하고 머지하면 됩니다.`,
      '-->',
      '',
    ].join('\n');
  }

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.writeFileSync(filePath, frontmatter + checklist + body.trim() + '\n');

  console.log(`[generate-post] 작성 완료: ${filePath}`);
  if (needsManual.length > 0) {
    console.log(`[generate-post] 직접 준비해야 할 이미지 (public/images/recipes/${slug}/ 안에 넣어주세요):`);
    needsManual.forEach((img) => console.log(`  - ${img.filename}: ${img.ai_prompt}`));
  }

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(
      process.env.GITHUB_ENV,
      `POST_TITLE=${draft.title}\nPOST_SLUG=${slug}\nTOPIC_SOURCE=${tier}\nIMAGES_AUTO=${allAuto ? 'true' : 'false'}\n`
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
