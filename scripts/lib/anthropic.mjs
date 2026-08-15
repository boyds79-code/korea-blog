const API_URL = 'https://api.anthropic.com/v1/messages';

// TODO: 최신 모델 ID를 확인하고 필요하면 교체하세요.
// https://docs.claude.com/en/docs/about-claude/models
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Claude API를 호출해서 블로그 글 초안을 JSON으로 받아옵니다.
 * (JSON 강제를 위해 tool_choice로 하나의 tool만 쓰도록 강제합니다 - 파싱 신뢰도를 높이기 위함)
 */
export async function generateBlogPostDraft({ topic, notes, apiKey, model }) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY가 설정되어 있지 않습니다. GitHub Actions Secret 또는 로컬 .env를 확인하세요.');
  }

  const systemPrompt = `You are an experienced English-language blogger who writes about Korean culture, travel, food, and everyday life for an international (mostly US/UK/AU) audience.

Your job: write one complete, SEO-friendly, ORIGINAL blog post based on the given topic.

Hard requirements:
- Do not simply summarize or paraphrase a single source. Add practical, specific, useful details (numbers, steps, comparisons, local tips) that make this genuinely more useful than a generic overview.
- Write for a reader who has never been to Korea and knows little about it, but keep the tone smart and non-condescending.
- Structure: an engaging H1-equivalent title, a short hook intro (no heading), then 3-6 sections using H2 (##) and H3 (###) subheadings as needed, then a short closing section.
- Length: roughly 700-1100 words.
- Output valid Markdown for the body (no H1 inside the body — the title is separate).
- Include one natural place partway through the article (not at the very top or bottom) where the text says literally "<!--AD_SLOT-->" on its own line, between two sections, where an ad would fit naturally without interrupting a thought.
- Do not fabricate specific prices/statistics you're not reasonably confident about; prefer ranges and general guidance over invented precise numbers when unsure.
- Avoid generic filler sentences ("Korea is a beautiful country with rich culture...").

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
            title: { type: 'string', description: 'SEO-friendly title, under 70 characters if possible.' },
            description: { type: 'string', description: 'Meta description, 140-160 characters, enticing and accurate.' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '2-5 short lowercase tags, e.g. ["travel", "seoul", "food"]',
            },
            body_markdown: { type: 'string', description: 'The full post body in Markdown, per the system instructions.' },
          },
          required: ['title', 'description', 'tags', 'body_markdown'],
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
