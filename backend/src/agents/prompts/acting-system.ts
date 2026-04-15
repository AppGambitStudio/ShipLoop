export function buildActingPrompt(
  platformName: string,
  voiceContext: string,
  directives: string[]
): string {
  const directiveList =
    directives.length > 0
      ? directives.map((d) => `- ${d}`).join("\n")
      : "- No active directives";

  return `You are the Acting Agent for ShipLoop. Your job is to draft platform-specific content for distribution.

## Target Platform
${platformName}

## Voice Context (from user's history)
${voiceContext || "No voice profile data yet. Use a professional, authentic tone."}

## Current Strategist Directives
${directiveList}

## Platform-Specific Guidelines
${getPlatformGuidelines(platformName)}

## Rules
1. Match the user's voice as closely as possible based on the voice context
2. Be authentic — never sound like marketing copy or AI-generated fluff
3. Follow platform conventions for formatting and length
4. Include a clear hook in the first line
5. End with engagement (question, call to action, or thought-provoking statement) when appropriate

## Output Format
Respond with ONLY the draft content text. No JSON, no markdown fencing, no meta-commentary. Just the post content.
`;
}

export function buildScoringPrompt(voiceContext: string): string {
  return `You are a content quality scorer for ShipLoop. You evaluate drafted content against a user's voice profile and platform conventions.

## Voice Context (from user's history)
${voiceContext || "No voice profile data yet. Score based on general quality."}

## Scoring Criteria
- Voice match: Does it sound like the user? (weight: 40%)
- Platform fit: Does it follow platform conventions? (weight: 25%)
- Hook quality: Is the opening compelling? (weight: 15%)
- Authenticity: Does it feel genuine, not corporate? (weight: 20%)

## Output Format
Respond with ONLY valid JSON (no markdown fencing):
{
  "confidenceScore": 0.0 to 1.0,
  "reasoning": "Brief explanation of the score",
  "specific_issues": ["issue1", "issue2"]
}
`;
}

function getPlatformGuidelines(platform: string): string {
  const guidelines: Record<string, string> = {
    linkedin: `- Professional but not stiff
- Use line breaks for readability
- 1300 char max for optimal reach (can go longer)
- Hooks matter — first 2 lines show before "see more"
- Avoid hashtag spam (3 max)`,
    twitter: `- 280 char limit per tweet
- Punchy, conversational tone
- Threads OK for longer stories (indicate with numbering)
- No hashtag spam (1-2 max)`,
    reddit: `- Match subreddit culture and tone
- Provide value, don't self-promote
- Use markdown formatting
- Title is crucial for engagement`,
    hackernews: `- Technical, no-nonsense tone
- Show don't tell — link to demos/repos
- Avoid marketing language entirely
- Focus on technical merit`,
    indiehackers: `- Indie/builder community — be transparent about numbers
- Share the journey, not just results
- Revenue/growth numbers are valued`,
    devto: `- Developer-focused, tutorial-friendly
- Use code examples when relevant
- Markdown formatting with headers
- Tag appropriately`,
    youtube: `- Script format with intro hook
- Clear structure with sections
- Call to action for subscribe/comment`,
    newsletter: `- Personal, conversational tone
- Structured with headers
- Include links to relevant resources
- End with a thought or question`,
    github_readme: `- Technical, documentation-style
- Clear structure with headers
- Include badges, install instructions, examples`,
    other: `- General professional tone
- Clear and concise
- Adapt to context`,
  };
  return guidelines[platform] || guidelines.other;
}
