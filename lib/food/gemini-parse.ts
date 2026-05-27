import { normalizeMealType, inferMealTypeFromText } from './meal-infer';
import type { MealType } from './types';
import { MEAL_TYPES } from './types';

export interface GeminiParsedItem {
  name: string;
  quantity: number;
  unit: string;
  meal_type?: MealType;
  portion_size?: string | null;
  confidence?: number;
  portion_confidence?: number;
}

const ALLOWED_UNITS = new Set(['piece', 'bowl', 'cup', 'tablespoon', 'serving', 'gram', 'ml']);

/** gemini-2.0-flash-lite is shut down for new users — use 2.5+ */
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];

function modelCandidates(): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  const list = env ? [env, ...FALLBACK_MODELS] : FALLBACK_MODELS;
  return Array.from(new Set(list.filter(Boolean)));
}

export async function parseFoodTextWithGemini(
  text: string,
): Promise<{ items: GeminiParsedItem[]; unparsed_fragments: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = `You extract Indian office/home meal items from user text. Return ONLY valid JSON, no markdown.

Rules:
- Split into separate food line items.
- meal_type is REQUIRED on every item: one of ${MEAL_TYPES.join(', ')}.
- Infer meal_type from what the user wrote (e.g. "for breakfast", "at lunch", "dinner was…"). If the user lists multiple meals, assign each dish to the correct meal.
- If a dish appears right after a meal label, use that meal until the next meal label.
- quantity: number (default 1).
- unit: one of piece, bowl, cup, tablespoon, serving, gram, ml.
- portion_size: small, regular, large, half, double, or null if not stated.
- portion_confidence: 0-1 how sure you are about portion_size.
- confidence: 0-1 how sure you are about the dish name.
- Do NOT include calories or protein.

User text:
${text}

JSON shape:
{"items":[{"name":"string","quantity":1,"unit":"bowl","meal_type":"lunch","portion_size":"regular","confidence":0.9,"portion_confidence":0.8}],"unparsed_fragments":[]}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  let res: Response | null = null;
  let lastErr = '';
  for (const model of modelCandidates()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res.ok) break;
    lastErr = await res.text();
    if (res.status !== 404) {
      throw new Error(`Gemini API error: ${res.status} ${lastErr.slice(0, 200)}`);
    }
  }

  if (!res?.ok) {
    throw new Error(
      `Gemini API error: no available model (tried ${modelCandidates().join(', ')}). ${lastErr.slice(0, 200)}`,
    );
  }

  const json = await res.json();
  const rawText =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty Gemini response');
  }

  let parsed: {
    items?: GeminiParsedItem[];
    unparsed_fragments?: string[];
  };
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse Gemini JSON');
    parsed = JSON.parse(match[0]);
  }

  const items = (parsed.items ?? [])
    .filter((i) => i?.name && String(i.name).trim())
    .map((i) => ({
      name: String(i.name).trim(),
      quantity: Math.max(0.25, Number(i.quantity) || 1),
      unit: ALLOWED_UNITS.has(String(i.unit)) ? String(i.unit) : 'serving',
      meal_type:
        normalizeMealType(i.meal_type) ?? inferMealTypeFromText(text),
      portion_size: i.portion_size ?? null,
      confidence: typeof i.confidence === 'number' ? i.confidence : 0.8,
      portion_confidence: typeof i.portion_confidence === 'number' ? i.portion_confidence : 0.7,
    }));

  return {
    items,
    unparsed_fragments: Array.isArray(parsed.unparsed_fragments)
      ? parsed.unparsed_fragments.map(String)
      : [],
  };
}
