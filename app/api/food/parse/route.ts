import { getSupabaseWithUser } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { buildCartItemFromParse } from '@/lib/food/catalog-match';
import { parseFoodTextWithGemini } from '@/lib/food/gemini-parse';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  try {
    const { items: parsed, unparsed_fragments } = await parseFoodTextWithGemini(text);

    const catalogWriter = createServiceRoleClient();
    const items = await Promise.all(
      parsed.map((line) =>
        buildCartItemFromParse(supabase, catalogWriter, user.id, line, text),
      ),
    );

    return NextResponse.json({ items, unparsed_fragments });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Parse failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
