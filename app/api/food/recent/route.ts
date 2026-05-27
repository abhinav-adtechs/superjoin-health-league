import { getSupabaseWithUser } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseWithUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: logs, error } = await supabase
    .from('meal_food_logs')
    .select('food_catalog_id, created_at')
    .eq('user_id', user.id)
    .not('food_catalog_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const orderedIds: { id: string; last_logged_at: string }[] = [];
  for (const row of logs ?? []) {
    const id = row.food_catalog_id as string;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    orderedIds.push({ id, last_logged_at: row.created_at as string });
    if (orderedIds.length >= 12) break;
  }

  if (orderedIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: catalog } = await supabase
    .from('food_catalog')
    .select('id, name, browse_section_id, serving_label, kcal_per_serving, protein_g_per_serving, portion_ui_type, default_unit, unit_options, portion_presets')
    .in('id', orderedIds.map((o) => o.id))
    .eq('is_active', true);

  const { data: sections } = await supabase
    .from('food_browse_sections')
    .select('id, label, emoji');

  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s]));
  const catalogMap = new Map((catalog ?? []).map((c) => [c.id, c]));

  const items = orderedIds
    .map(({ id, last_logged_at }) => {
      const c = catalogMap.get(id);
      if (!c) return null;
      return {
        food_catalog_id: c.id,
        name: c.name,
        serving_label: c.serving_label,
        kcal_per_serving: c.kcal_per_serving,
        protein_g_per_serving: c.protein_g_per_serving,
        portion_ui_type: c.portion_ui_type,
        default_unit: c.default_unit,
        unit_options: c.unit_options,
        portion_presets: c.portion_presets,
        browse_section: sectionMap.get(c.browse_section_id) ?? { id: c.browse_section_id, label: c.browse_section_id },
        last_logged_at,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items });
}
