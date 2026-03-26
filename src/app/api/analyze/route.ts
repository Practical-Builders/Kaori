import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/analyze
 *
 * Proxies the biomechanics prompt to the Anthropic Claude API server-side,
 * keeping the API key out of the browser bundle.
 *
 * Body: { prompt: string }
 * Returns: the parsed JSON from Claude, or { error: string }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }

  const systemPrompt = `You are a sports biomechanics analyst producing factual, data-driven summaries of movement data captured from video. Your role is to report what the data shows — not to speculate beyond it.

Strict guidelines:
- Be neutral and precise. Use measured language: "the data shows", "measurements indicate", "recorded values suggest".
- Never infer the athlete's position, sport-specific role, or tactical intent unless the user's profile explicitly states it AND the data clearly supports it.
- For short clips (under 10 seconds), note that measurements are from a limited sample and may not be representative.
- Do not dramatize or sensationalize values. State them plainly.
- Identified "moves" should be described as observable movement patterns (e.g. "rapid lateral weight shift", "acceleration burst"), not tactical conclusions (e.g. "goalkeeper dive", "striker breakaway").
- Training suggestions must be grounded in the specific data points provided, not generic advice.
- If data is insufficient for a reliable conclusion, say so.
- No motivational language. No superlatives unless the data justifies them.`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    console.error("Anthropic API error:", anthropicRes.status, errText);
    return NextResponse.json(
      { error: `Anthropic API returned ${anthropicRes.status}.` },
      { status: 502 }
    );
  }

  const data = await anthropicRes.json();
  const text: string = data.content?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch {
    // Claude returned something that isn't JSON — pass the raw text back
    return NextResponse.json({
      summary: text.slice(0, 300),
      moves: [],
      suggestions: [],
      comparison: "",
    });
  }
}
