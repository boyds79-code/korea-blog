# Korea, Explained — 자동 초안 + 사람 검수 블로그

영어권 독자를 대상으로 한 한국 문화/여행 블로그입니다. Astro로 만든 정적 사이트이고,
매일 GitHub Actions가 Claude API로 글 초안을 자동 생성해 Pull Request를 올리면,
**사람이 검토하고 PR을 머지해야만** 실제로 사이트에 발행되는 구조입니다.
(초안 자동 생성 ≠ 자동 발행 — 발행은 항상 PR 머지라는 사람의 행동이 트리거합니다.)

## 어떻게 작동하나요

1. 매일 정해진 시간에 GitHub Actions(`daily-post.yml`)가 실행됩니다.
2. `topics/queue.yaml`에 남은 주제가 있으면 맨 위 항목을 하나 꺼내 씁니다. (직접 정한 주제, 초기 20개용)
3. 큐가 비면 자동으로 "트렌드 모드"로 전환되어, 구글 뉴스에서 최근 24시간 내 "Korea" 관련 헤드라인을 하나 찾아 그걸 소재로 삼습니다. (레딧은 기본값에서 빠져 있습니다 — 아래 "왜 레딧을 기본으로 쓰지 않았는지" 참고)
4. Claude API를 호출해 SEO에 맞춘 완성된 글 초안(`src/content/blog/*.md`)을 생성합니다.
5. 생성된 파일을 새 브랜치에 커밋하고, **Pull Request를 엽니다.** 이 시점에는 아무것도 사이트에 반영되지 않습니다.
6. 당신이 PR을 열어 내용을 읽고, 필요하면 직접 수정한 뒤, **머지(merge)** 합니다.
7. `main` 브랜치에 머지되는 순간 Vercel이 자동으로 빌드/배포해서 글이 실제로 공개됩니다.

이 흐름은 첫 글부터 계속 동일합니다 — "처음 20개는 수동, 이후는 자동" 같은 예외가 아니라,
**모든 글이 초안은 자동, 발행 승인은 항상 사람**입니다.

## 시작하기 (처음 한 번만)

### 1. 로컬에서 확인
```bash
npm install
npm run dev        # http://localhost:4321 에서 확인
npm run build      # 정적 빌드가 에러 없이 되는지 확인
```

### 2. GitHub 저장소 만들기
새 GitHub 저장소를 만들고 이 프로젝트 전체를 push하세요.
```bash
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin <당신의-저장소-URL>
git push -u origin main
```

### 3. Anthropic API 키 발급 및 등록
1. https://console.anthropic.com 에서 API 키를 발급받으세요.
2. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: 발급받은 키
3. (선택) 모델을 바꾸고 싶으면 같은 화면의 **Variables** 탭에서 `CLAUDE_MODEL` 변수를 추가하세요.
   비워두면 `scripts/lib/anthropic.mjs`에 적힌 기본 모델을 씁니다 — 최신 모델 ID는
   https://docs.claude.com/en/docs/about-claude/models 에서 확인 후 필요하면 교체하세요.
4. (선택, 대표 이미지 자동 삽입용) https://www.pexels.com/api/ 에서 무료 API 키를 발급받아
   같은 화면에 `PEXELS_API_KEY`라는 이름의 Secret으로 추가하세요. 등록하지 않으면 이미지 없이
   텍스트만 생성됩니다 — 자세한 내용은 아래 "대표 이미지 자동 삽입" 참고.

### 4. GitHub Actions에 PR 생성 권한 확인
저장소 **Settings → Actions → General → Workflow permissions**에서
"Read and write permissions" + "Allow GitHub Actions to create and approve pull requests"가
켜져 있는지 확인하세요. (조직 계정은 기본값이 꺼져 있는 경우가 있습니다.)

### 5. Vercel 연결
1. https://vercel.com 에서 GitHub 저장소를 import 하세요.
2. Framework Preset은 자동으로 Astro가 잡힙니다. 별다른 설정 없이 Deploy를 누르면 됩니다.
3. 이후로는 `main`에 push(=PR 머지)될 때마다 자동 재배포됩니다.
4. 도메인을 연결했다면 `astro.config.mjs`의 `SITE_URL`과 `public/robots.txt`의 sitemap 주소도
   실제 도메인으로 바꿔주세요 (SEO에 영향을 줍니다).

### 6. 첫 실행 테스트
저장소의 **Actions 탭 → Daily draft post → Run workflow** 를 눌러 수동으로 한 번 실행해보세요.
몇 분 뒤 PR이 하나 열리면 정상 작동하는 것입니다.

## 애드센스 준비

- `/about`, `/contact`, `/privacy` 페이지가 이미 포함되어 있습니다. 내용의 TODO 표시된 부분
  (실제 이메일, 소개 문구 등)을 채워주세요 — 애드센스 심사와 SEO(E-E-A-T) 둘 다에 도움이 됩니다.
- 승인 전까지 광고 자리는 자리표시자(점선 박스)로만 보입니다. 승인받으면 Vercel 프로젝트의
  환경변수에 `PUBLIC_ADSENSE_CLIENT`, `PUBLIC_ADSENSE_SLOT_TOP`, `PUBLIC_ADSENSE_SLOT_BOTTOM`을
  채우고 재배포하면 실제 광고가 노출됩니다. (`src/components/AdSlot.astro` 참고)
- 매 글마다 `<!-- AD_SLOT -->` 마커가 본문 중간 어딘가에 자연스럽게 들어가도록 프롬프트에
  지시해뒀지만, 지금 레이아웃은 글 상단/하단 2곳에만 실제 광고를 노출합니다. 본문 중간 삽입까지
  자동화하려면 `src/layouts/BlogPost.astro`에서 렌더링된 HTML을 그 마커 기준으로 분할해 넣는
  로직을 추가하면 됩니다 (지금은 과설계를 피하려 보류했습니다).
- **애드센스는 완전 무검수 대량 발행 사이트를 저품질로 판단합니다.** 이 프로젝트가 매 글마다
  PR 리뷰를 강제하는 이유가 이것입니다 — 리뷰를 형식적으로 통과시키지 말고, 실제로 읽고
  고쳐서 머지하는 습관을 들이는 걸 추천합니다.

## 대표 이미지 자동 삽입

`PEXELS_API_KEY`를 등록해두면 글마다 이렇게 자동으로 이미지가 붙습니다.

1. Claude가 글을 쓰면서 `image_query`(예: "seoul subway station")도 같이 생성합니다.
2. 그 검색어로 [Pexels](https://www.pexels.com) 스톡 사진을 검색해 첫 번째 결과를 가져옵니다.
3. `public/images/blog/<slug>.jpg`로 저장하고, frontmatter에 `heroImage`, `heroImageAlt`,
   `heroImageCredit`(사진작가 표시)를 함께 기록합니다.
4. 글 상단과 홈 화면 목록에 자동으로 노출됩니다.

Pexels 라이선스는 상업적 이용에 저작자 표시가 필수는 아니지만, 관례상 사진 아래에 작게
"Photo by 000 on Pexels" 크레딧을 자동으로 넣어뒀습니다 (원치 않으면 `BlogPost.astro`의
`figcaption` 부분을 지우면 됩니다).

키를 등록하지 않았거나, 검색 결과가 없거나, 네트워크 오류가 나도 글 생성 자체는 실패하지
않고 이미지 없이 진행됩니다 — 이미지가 텍스트 생성을 막는 일은 없습니다.

이미지가 쌓이면 저장소 용량이 점점 커집니다. 개인 블로그 트래픽 수준에서는 신경 쓸 정도가
아니지만, 나중에 글이 아주 많아지면 이미지를 별도 스토리지(예: Vercel Blob, Cloudinary)로
옮기는 걸 고려해볼 수 있습니다 — 지금은 과설계를 피하려 가장 단순한 방식(저장소에 직접 저장)을
택했습니다.

## 주제 큐 관리 (`topics/queue.yaml`)

- 처음 20개는 이미 채워져 있습니다. 자유롭게 순서를 바꾸거나, 항목을 추가/삭제하세요.
- 큐가 소진되면 자동으로 뉴스 트렌드 기반으로 전환됩니다. 트렌드 모드로 넘어간 뒤에도
  언제든 `topics/queue.yaml`에 새 항목을 추가하면 그게 다시 우선됩니다(큐가 비어있지 않은 한
  트렌드보다 큐가 항상 우선입니다).

### 왜 레딧을 기본으로 쓰지 않았는지

레딧 Data API의 무료 티어는 **비상업적 용도로만** 허용됩니다. 애드센스 광고가 붙은 블로그의
글감으로 쓰는 건 상업적 이용에 해당해서, 원칙적으로는 레딧의 별도 상업적 이용 승인
(Responsible Builder Policy)이 필요하고 승인도 보장되지 않습니다. 그래서 기본값은 구글 뉴스
RSS(`https://news.google.com/rss/search?q=Korea...`)로 대체해뒀습니다.

레딧을 꼭 쓰고 싶다면:
1. 레딧 개발자 포털에서 상업적 이용 승인을 먼저 받으세요.
2. `scripts/lib/topic-sources.mjs` 맨 아래 주석 처리된 `findTrendTopicFromReddit` 예시를
   참고해 `findTrendTopic` 자리에 넣고, `REDDIT_ACCESS_TOKEN` 같은 인증 값을 Secrets에 추가하면 됩니다.

## 로컬에서 초안 생성 테스트

```bash
cp .env.example .env
# .env에 ANTHROPIC_API_KEY (그리고 선택적으로 PEXELS_API_KEY) 채우기
set -a && source .env && set +a
npm run generate
```

> 참고: 아주 제한적인 네트워크 환경(예: 일부 샌드박스)에서는 구글 뉴스 RSS 호출이 막혀있을 수
> 있습니다. GitHub Actions 러너에서는 문제없이 동작합니다.

## 프로젝트 구조

```
src/content/blog/       실제 글(Markdown). 여기 있는 파일 = 발행된 글
src/pages/               라우팅 (index, blog/[slug], about, contact, privacy, rss.xml)
src/layouts/              공통 레이아웃 (Base, BlogPost)
src/components/AdSlot.astro   애드센스 광고 슬롯 컴포넌트
public/images/blog/       자동으로 다운로드된 대표 이미지들
topics/queue.yaml         직접 정한 주제 대기열
topics/used-trends.json   트렌드 모드에서 이미 쓴 헤드라인 기록 (중복 방지용, 자동 생성됨)
scripts/generate-post.mjs 메인 초안 생성 스크립트
scripts/lib/               초안 생성에 쓰이는 하위 모듈들 (topic-sources, anthropic, images, slugify)
.github/workflows/daily-post.yml   매일 실행되는 자동화
```

## 비용 개산

- Claude API: 글 1편당 입출력 토큰 합쳐 대략 몇 천 토큰 수준 — 정확한 단가는
  https://docs.claude.com/en/docs/about-claude/pricing 에서 사용 모델 기준으로 확인하세요.
  매일 1편이면 한 달에 30편, 부담스러운 비용은 아닙니다.
- Vercel: 개인 블로그 트래픽 수준에서는 무료 티어로 충분합니다.
- GitHub Actions: public 저장소는 무료, private 저장소도 무료 한도가 넉넉합니다.

## 법적 안내

`src/pages/privacy.astro`는 애드센스 심사에 필요한 최소한의 템플릿이며 법률 자문이 아닙니다.
실제 서비스 지역/이용자에 맞게 검토가 필요할 수 있습니다.
