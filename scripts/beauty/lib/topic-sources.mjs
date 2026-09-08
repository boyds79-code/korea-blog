import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const QUEUE_PATH = path.join(ROOT, 'topics', 'beauty', 'queue.yaml');
const USED_TRENDS_PATH = path.join(ROOT, 'topics', 'beauty', 'used-trends.json');

/**
 * 큐(topics/queue.yaml)에 사람이 직접 넣어둔 주제가 남아있으면 그걸 꺼내서 쓰고,
 * 큐가 비어있으면 트렌드 소스(기본: 구글 뉴스)에서 하나 찾아옵니다.
 *
 * 리턴값: { topic, notes, source: 'manual' | 'trend' }
 */
export async function getNextTopic() {
  const fromQueue = popFromQueue();
  if (fromQueue) {
    return { ...fromQueue, source: 'manual' };
  }

  const fromTrend = await findTrendTopic();
  return { ...fromTrend, source: 'trend' };
}

function popFromQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return null;

  const raw = fs.readFileSync(QUEUE_PATH, 'utf8');
  const doc = yamlLoad(raw);
  if (!Array.isArray(doc) || doc.length === 0) return null;

  const [next, ...rest] = doc;
  const header = `# 직접 정한 주제 대기열입니다.\n# 매일 자동 실행(daily-post.yml)이 돌 때마다 맨 위 항목을 하나 꺼내서\n# 초안을 생성하고, 사용된 항목은 이 파일에서 자동으로 제거됩니다.\n#\n# 이 큐가 비면 자동으로 트렌드 기반 주제 탐색 모드로 전환됩니다.\n`;
  fs.writeFileSync(QUEUE_PATH, header + yamlDump(rest, { lineWidth: 100 }));

  return { topic: next.topic, notes: next.notes || '' };
}

/**
 * 구글 뉴스 RSS에서 K-beauty/한국 스킨케어 관련 최근 기사 제목을 찾아 트렌드 주제로 씁니다.
 * (레딧 API 무료 티어는 비상업적 용도로 제한되어 있어 광고 수익화 블로그에는 부적합합니다.)
 *
 * 이 블로그는 뷰티/스킨케어 성격상 대부분의 글이 에버그린 설명글이라 트렌드 모드가
 * 자주 쓰이진 않을 것으로 예상되지만, 큐가 소진됐을 때 자동 실행이 실패하지 않도록
 * 안전장치로 남겨둡니다.
 */
async function findTrendTopic() {
  const query = '(K-beauty OR "Korean skincare" OR "Korean beauty" OR "Korean skin care" OR "skincare routine" Korea) when:7d';
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(feedUrl, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; korea-beauty-blog-bot/1.0)' } });
  if (!res.ok) {
    throw new Error(`뉴스 트렌드 소스 호출 실패 (${res.status})`);
  }
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const used = loadUsedTrends();

  for (const item of items) {
    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    if (!titleMatch) continue;
    // 구글 뉴스 제목은 보통 "기사 제목 - 언론사명" 형태라 언론사명은 잘라냄
    const rawTitle = titleMatch[1].replace(/\s+-\s+[^-]+$/, '').trim();
    if (!rawTitle) continue;
    if (used.has(rawTitle.toLowerCase())) continue;

    saveUsedTrend(rawTitle);
    return {
      topic: `A blog post inspired by this recent K-beauty/Korean skincare news headline, written for readers unfamiliar with the background: "${rawTitle}". Add context an outsider would need — don't just report the news, and don't name/promote specific commercial brands or products.`,
      notes: 'Turn this into an evergreen explainer/ingredient-or-technique angle rather than a pure news recap — news recaps go stale and rank poorly. Stick to ingredient types and routine concepts, not specific named products.',
    };
  }

  // 모든 후보가 이미 사용된 경우를 대비한 안전장치
  throw new Error(
    '오늘의 트렌드 주제를 찾지 못했습니다 (모두 이미 사용됨이거나 피드가 비어있음). topics/queue.yaml에 주제를 몇 개 더 추가해주세요.'
  );
}

function loadUsedTrends() {
  if (!fs.existsSync(USED_TRENDS_PATH)) return new Set();
  try {
    const arr = JSON.parse(fs.readFileSync(USED_TRENDS_PATH, 'utf8'));
    return new Set(arr.map((s) => s.toLowerCase()));
  } catch {
    return new Set();
  }
}

function saveUsedTrend(title) {
  const used = fs.existsSync(USED_TRENDS_PATH) ? JSON.parse(fs.readFileSync(USED_TRENDS_PATH, 'utf8')) : [];
  used.push(title);
  // 최근 200개만 보관 (파일이 무한정 커지지 않도록)
  const trimmed = used.slice(-200);
  fs.writeFileSync(USED_TRENDS_PATH, JSON.stringify(trimmed, null, 2) + '\n');
}
