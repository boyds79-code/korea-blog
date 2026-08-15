// 이미 존재하는 글(특히 자동화 이전에 수동으로 쓴 글)에 대표 이미지를 나중에
// 붙이거나 교체하는 유틸리티입니다. 새 글 자동 생성 파이프라인이 쓰는 것과 동일한
// Pexels 검색/다운로드 로직(scripts/lib/images.mjs)을 재사용합니다.
//
// 사용법:
//   set -a && source .env && set +a   # PEXELS_API_KEY 로드
//   node scripts/backfill-hero-image.mjs <slug> ["이미지 검색어"] [--force]
//
// 예:
//   node scripts/backfill-hero-image.mjs incheon-airport-to-seoul-guide "seoul subway train"
//   (이미 이미지가 있는 글의 사진을 바꾸고 싶을 때는 --force 추가)
//   node scripts/backfill-hero-image.mjs incheon-airport-to-seoul-guide "incheon airport express train" --force

import fs from 'node:fs';
import path from 'node:path';
import { findAndSaveHeroImage } from './lib/images.mjs';

const rawArgs = process.argv.slice(2);
const force = rawArgs.includes('--force');
const [slugArg, ...queryParts] = rawArgs.filter((a) => a !== '--force');

if (!slugArg) {
  console.error('사용법: node scripts/backfill-hero-image.mjs <slug> ["검색어"] [--force]');
  process.exit(1);
}

const query = queryParts.join(' ') || slugArg.replace(/-/g, ' ');
const ROOT = path.resolve(import.meta.dirname, '..');
const filePath = path.join(ROOT, 'src', 'content', 'blog', `${slugArg}.md`);
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'blog');

async function main() {
  if (!fs.existsSync(filePath)) {
    console.error(`파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  let raw = fs.readFileSync(filePath, 'utf8');
  const hasHeroImage = /\nheroImage:/.test(raw);

  if (hasHeroImage && !force) {
    console.log('이미 heroImage가 있는 글입니다. 사진을 바꾸고 싶으면 명령어 맨 뒤에 --force를 붙여서 다시 실행하세요.');
    return;
  }

  if (hasHeroImage && force) {
    // 기존 heroImage* 4줄을 frontmatter에서 제거 (교체 전 정리, 파일에는 아직 안 씀)
    raw = raw.replace(/\n(heroImage|heroImageAlt|heroImageCredit|heroImageCreditUrl):.*$/gm, '');
  }

  console.log(`[backfill] "${slugArg}"에 쓸 이미지를 "${query}"로 검색합니다...`);
  const hero = await findAndSaveHeroImage({
    query,
    slug: slugArg,
    apiKey: process.env.PEXELS_API_KEY,
  });

  if (!hero) {
    console.error(
      '이미지를 찾지 못했습니다. PEXELS_API_KEY가 .env에 제대로 들어있는지, 검색어가 너무 특이하지 않은지 확인해보세요.'
    );
    console.error('(기존 이미지/글 내용은 그대로 남아있으니 안심하세요 — 새 이미지를 못 찾으면 아무것도 바뀌지 않습니다.)');
    process.exit(1);
  }

  // 새 이미지를 확실히 받은 뒤에만 예전 이미지 파일(확장자 다를 수 있음) 정리
  if (hasHeroImage && force && fs.existsSync(IMAGES_DIR)) {
    for (const f of fs.readdirSync(IMAGES_DIR)) {
      if (f.startsWith(`${slugArg}.`) && f !== path.basename(hero.heroImage)) {
        fs.unlinkSync(path.join(IMAGES_DIR, f));
        console.log(`[backfill] 기존 이미지 삭제: ${f}`);
      }
    }
  }

  const heroLines = [
    `heroImage: ${JSON.stringify(hero.heroImage)}`,
    `heroImageAlt: ${JSON.stringify(hero.heroImageAlt)}`,
    `heroImageCredit: ${JSON.stringify(hero.heroImageCredit)}`,
    `heroImageCreditUrl: ${JSON.stringify(hero.heroImageCreditUrl)}`,
  ].join('\n');

  // frontmatter는 파일 맨 앞의 두 번째 '---' 줄로 끝난다고 가정하고, 그 직전에 필드를 끼워 넣음
  const firstDelim = raw.indexOf('---');
  const secondDelim = raw.indexOf('---', firstDelim + 3);
  if (firstDelim !== 0 || secondDelim === -1) {
    console.error('frontmatter(--- ... ---) 형식을 찾지 못했습니다. 파일 형식을 확인해주세요.');
    process.exit(1);
  }

  const before = raw.slice(0, secondDelim).replace(/\n$/, '');
  const after = raw.slice(secondDelim); // 두 번째 '---'부터 그대로 유지
  const updated = `${before}\n${heroLines}\n${after}`;

  fs.writeFileSync(filePath, updated);
  console.log(`[backfill] 완료: ${filePath}`);
  console.log(`[backfill] 이미지: ${hero.heroImage} (${hero.heroImageCredit})`);
}

main().catch((err) => {
  console.error('[backfill] 실패:', err);
  process.exit(1);
});
