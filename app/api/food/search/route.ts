import { getSupabaseWithUser } from '@/lib/supabase/server';
import { searchCatalog } from '@/lib/food/catalog-match';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const section = searchParams.get('section') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 50);

  const rows = await searchCatalog(supabase, { q, section, limit });

  const sectionIds = Array.from(new Set(rows.map((r) => r.browse_section_id)));
  const { data: sections } = await supabase
    .from('food_browse_sections')
    .select('id, label, emoji')
    .in('id', sectionIds.length ? sectionIds : ['__none__']);

  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s]));

  const items = rows.map((r) => ({
    food_catalog_id: r.id,
    name: r.name,
    serving_label: r.serving_label,
    kcal_per_serving: r.kcal_per_serving,
    protein_g_per_serving: r.protein_g_per_serving,
    browse_section: sectionMap.get(r.browse_section_id) ?? {
      id: r.browse_section_id,
      label: r.browse_section_id,
    },
    portion_ui_type: r.portion_ui_type,
    default_unit: r.default_unit,
    unit_options: r.unit_options,
    portion_presets: r.portion_presets,
  }));

  return NextResponse.json({ items });
}
