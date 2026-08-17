const API_URL = 'https://api.anthropic.com/v1/messages';

// TODO: 최신 모델 ID를 확인하고 필요하면 교체하세요.
// https://docs.claude.com/en/docs/about-claude/models
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// body_markdown 안의 이미지 경로에 실제 슬러그를 나중에 끼워 넣기 위한 placeholder.
// (Claude가 글을 쓰는 시점엔 아직 최종 슬러그를 모르므로, 생성 후 generate-post.mjs에서
// 이 문자열을 실제 슬러그로 치환합니다.)
export const SLUG_PLACEHOLDER = '{{SLUG}}';

/**
 * Claude API를 호출해서 블로그 글 초안을 JSON으로 받아옵니다.
 * 이미지는 자동으로 다운로드하지 않고, Claude가 "이런 사진이 필요하다"는 계획(image_plan)만
 * 세우고 본문에 자리(마크다운 이미지 태그)만 잡아둡니다 — 실제 사진은 사용자가 직접
 * 다운로드/생성해서 채워 넣는 구조입니다.
 */
export async function generateBlogPostDraft({ topic, notes, apiKey, model }) {
  // .env를 GUI 에디터로 저장할 때 섞여 들어갈 수 있는 보이지 않는 공백/줄바꿈 문자 방지
  apiKey = apiKey?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되어 있지 않습니다. GitHub Actions Secret 또는 로컬 .env를 확인하세요.');
  }

  const systemPrompt = `You are an experienced English-language blogger who writes about Korean culture, travel, food, and everyday life for an international (mostly US/UK/AU) audience.

Your job: write one complete, SEO-friendly, ORIGINAL blog post based on the given topic, AND plan out 2-4 photos a human editor should take/find/generate for it (you do not generate images yourself — you only plan where they go and what they should show).

Hard requirements:
- Do not simply summarize or paraphrase a single source. Add practical, specific, useful details (numbers, steps, comparisons, local tips) that make this genuinely more useful than a generic overview.
- Write for a reader who has never been to Korea and knows little about it, but keep the tone smart and non-condescending.
- Structure: an engaging H1-equivalent title, a short hook intro (no heading), then 3-6 sections using H2 (##) and H3 (###) subheadings as needed, then a short closing section.
- Length: roughly 700-1100 words.
- Output valid Markdown for the body (no H1 inside the body — the title is separate).
- Include one natural place partway through the article (not at the very top or bottom) where the text says literally "<!--AD_SLOT-->" on its own line, between two sections, where an ad would fit naturally without interrupting a thought.
- Do not fabricate specific prices/statistics you're not reasonably confident about; prefer ranges and general guidance over invented precise numbers when unsure.
- Avoid generic filler sentences ("Korea is a beautiful country with rich culture...").
- Do NOT put a specific year (e.g. "2024", "2025", "2026") in the title, even if it feels like it makes the title more current. This is an evergreen page that will still be read years from now, and a hardcoded year makes it look outdated almost immediately. Only include a year in the title if the post is genuinely about a dated event that only makes sense with that year attached (e.g. a specific festival edition) — general guides, how-tos, and explainers should never have a year in the title.

Readability / scannability requirements (this matters — readers skim, they don't read walls of text):
- Keep paragraphs SHORT: 2-4 sentences max. Never write a paragraph longer than ~5 sentences. Break long explanations into multiple short paragraphs instead.
- Use an H2 or H3 subheading roughly every 100-150 words so the page is easy to scan — don't let any single section run long without a break.
- Bold (**text**) the 1-3 most important key terms, numbers, or takeaways per section (e.g. prices, times, names) — but do not overuse it; only truly important scan-points.
- When comparing 3+ options (transport methods, prices, neighborhoods, etc.), use a genuine Markdown table instead of prose paragraphs — tables are far more scannable than sentences full of numbers.
- Use bullet or numbered lists for any sequence of steps, tips, or short parallel items instead of cramming them into a paragraph.
- Where it fits naturally, add ONE short callout using Markdown blockquote syntax (a line starting with "> ") for a standout tip, warning, or "good to know" aside — e.g. "> 💡 Tip: ..." or "> ⚠️ Note: ...". Keep it to 1-2 sentences. Use at most one or two of these per post, only where genuinely useful — not as decoration.
- The opening paragraph should work as a strong, scannable summary of what the reader will get from the post (it gets slightly larger styling on the page, so make it earn that).

Image plan requirements:
- Plan 2 to 4 images total. Image #1 is always the "cover" image (shown at the top of the post automatically — do NOT also embed image #1 inline in the body, since that would show it twice).
- For images #2 and onward, embed a real Markdown image tag directly in body_markdown at the point in the article where that photo would help most, using EXACTLY this path pattern: ![alt text](/images/blog/${SLUG_PLACEHOLDER}/N.jpg) where N is the image's position number (2, 3, 4...). Use the literal text "${SLUG_PLACEHOLDER}" — do not invent a slug yourself.
- Each planned image needs: a filename (always "N.jpg" matching its position number, e.g. "1.jpg", "2.jpg"), a short descriptive alt text (for accessibility/SEO), and a one-sentence description of what the photo should actually show (for whoever is sourcing/shooting/generating it).

You must respond by calling the "submit_post" tool exactly once with the complete post.`;

  const userPrompt = notes
    ? `Topic: ${topic}\n\nThings to make sure to cover: ${notes}`
    : `Topic: ${topic}`;

  const body = {
    model: model || DEFAULT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [
      {
        name: 'submit_post',
        description: 'Submit the finished blog post.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'SEO-friendly title, under 70 characters if possible. Do NOT include a specific year — this is an evergreen page, not a dated one.' },
            description: { type: 'string', description: 'Meta description, 140-160 characters, enticing and accurate.' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '2-5 short lowercase tags, e.g. ["travel", "seoul", "food"]',
            },
            image_plan: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string', description: 'e.g. "1.jpg" — must match position order starting at 1' },
                  alt: { type: 'string', description: 'Short accessibility/SEO alt text for the image.' },
                  description: { type: 'string', description: 'One sentence describing what this photo should show, for whoever sources/shoots/generates it.' },
                },
                required: ['filename', 'alt', 'description'],
              },
              description: '2-4 planned images. Item 1 = cover image (not embedded inline). Items 2+ must also appear as Markdown image tags in body_markdown.',
            },
            body_markdown: { type: 'string', description: 'The full post body in Markdown, per the system instructions, including inline image tags for image_plan items 2+.' },
          },
          required: ['title', 'description', 'tags', 'image_plan', 'body_markdown'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_post' },
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API 호출 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const toolUse = data.content?.find((block) => block.type === 'tool_use' && block.name === 'submit_post');
  if (!toolUse) {
    throw new Error('Claude 응답에서 submit_post tool 호출을 찾지 못했습니다. 응답: ' + JSON.stringify(data));
  }

  return toolUse.input;
}
