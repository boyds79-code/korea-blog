import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'blog');

/**
 * Pexels에서 대표 이미지를 하나 찾아 public/images/blog/에 저장하고,
 * frontmatter에 넣을 필드들을 돌려줍니다.
 *
 * PEXELS_API_KEY가 없거나, 검색에 실패하거나, 네트워크 문제가 있으면
 * null을 반환합니다 — 이미지가 없다고 해서 글 생성 자체가 실패하면 안 되기 때문에
 * 이 함수를 호출하는 쪽에서 null을 "이미지 없이 진행"으로 처리합니다.
 *
 * Pexels 라이선스: 상업적 이용 가능, 저작자 표시 필수 아님(권장) - https://www.pexels.com/license/
 * 무료 API 키 발급: https://www.pexels.com/api/
 */
export async function findAndSaveHeroImage({ query, slug, apiKey }) {
  if (!apiKey) {
    console.log('[images] PEXELS_API_KEY가 없어 이미지 없이 진행합니다.');
    return null;
  }

  try {
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const res = await fetch(searchUrl, { headers: { authorization: apiKey } });
    if (!res.ok) {
      console.warn(`[images] Pexels 검색 실패 (${res.status}), 이미지 없이 진행합니다.`);
      return null;
    }
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) {
      console.warn(`[images] "${query}" 검색 결과가 없어 이미지 없이 진행합니다.`);
      return null;
    }

    // 원본 대신 미리 리사이즈된 버전을 받아서 저장소 용량을 아낌 (~940px 폭)
    const imageUrl = photo.src.large;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.warn(`[images] 이미지 다운로드 실패 (${imgRes.status}), 이미지 없이 진행합니다.`);
      return null;
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const ext = imageUrl.split('?')[0].split('.').pop().toLowerCase().slice(0, 4) || 'jpg';
    const filename = `${slug}.${ext}`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);

    return {
      heroImage: `/images/blog/${filename}`,
      heroImageAlt: photo.alt || query,
      heroImageCredit: `Photo by ${photo.photographer} on Pexels`,
      heroImageCreditUrl: photo.photographer_url || photo.url,
    };
  } catch (err) {
    console.warn('[images] 이미지 처리 중 오류, 이미지 없이 진행합니다:', err.message);
    return null;
  }
}
