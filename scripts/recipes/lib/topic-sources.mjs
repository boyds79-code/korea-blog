import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const QUEUE_PATH = path.join(ROOT, 'topics', 'recipes', 'queue.yaml');

const HEADER = `# 레시피 주제 대기열입니다. 순서 = 발행 우선순위입니다.
# 위쪽은 외국인들이 많이 검색/좋아하는 "인기 한식"(tier: popular), 아래쪽은 한국 셰프
# 유튜브(승우아빠, 자취요리 스타일 등)에서 영감을 받은 "간단 레시피"(tier: chef-simple)입니다.
# 매일 자동 실행이 돌 때마다 맨 위 항목을 하나 꺼내서 초안을 생성하고, 사용된 항목은
# 이 파일에서 자동으로 제거됩니다. 순서를 자유롭게 바꾸거나 항목을 추가/삭제해도 됩니다.
#
# 형식:
# - dish: "요리 이름 (영문 권장)"
#   tier: "popular" | "chef-simple"
#   notes: "이 레시피에서 꼭 다뤘으면 하는 포인트 (선택)"
#   referenceStyle: "톤/스타일 참고용 채널·블로그 (선택, 내용을 베끼라는 뜻이 아니라 톤 참고용)"
`;

/**
 * 큐(topics/queue.yaml)에서 다음 레시피 주제를 하나 꺼냅니다.
 * 이 블로그는 (의도적으로) 트렌드 자동 탐색 모드가 없습니다 — 큐가 비면 명확한 에러를 던져서
 * Actions 실행이 실패하고, 사용자가 topics/queue.yaml에 항목을 더 추가하도록 안내합니다.
 */
export async function getNextTopic() {
  if (!fs.existsSync(QUEUE_PATH)) {
    throw new Error('topics/queue.yaml 파일을 찾을 수 없습니다.');
  }

  const raw = fs.readFileSync(QUEUE_PATH, 'utf8');
  const doc = yamlLoad(raw);
  if (!Array.isArray(doc) || doc.length === 0) {
    throw new Error(
      'topics/queue.yaml에 남은 주제가 없습니다. 큐를 다 썼습니다 — GitHub 저장소에서 topics/queue.yaml을 열어 새 레시피를 몇 개 더 추가해주세요.'
    );
  }

  const [next, ...rest] = doc;
  fs.writeFileSync(QUEUE_PATH, HEADER + yamlDump(rest, { lineWidth: 100 }));

  return {
    dish: next.dish,
    notes: next.notes || '',
    tier: next.tier || 'manual',
    referenceStyle: next.referenceStyle || '',
  };
}
