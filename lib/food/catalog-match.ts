import type { SupabaseClient } from '@supabase/supabase-js';
import { catalogRowFromDb, computeMacros, getPortionLabel } from './nutrition';
import { mapPortionSizeToKey } from './portion-lexicon';
import { createCatalogFromParsedLine } from './catalog-create';
import { resolveMealTypeForParsedItem } from './meal-infer';
import type { FoodCatalogRow, MealType, ParsedLineInput } from './types';

export type { ParsedLineInput };

const CATALOG_SELECT =
  'id, slug, name, name_hi, browse_section_id, default_unit, kcal_per_serving, protein_g_per_serving, serving_label, unit_options, portion_ui_type, portion_presets, aliases, tags, is_junk, sort_priority';

export async function fetchCatalogById(
  supabase: SupabaseClient,
  id: string,
): Promise<FoodCatalogRow | null> {
  const { data } = await supabase
    .from('food_catalog')
    .select(CATALOG_SELECT)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  return catalogRowFromDb(data as Record<string, unknown>);
}

export async function searchCatalog(
  supabase: SupabaseClient,
  opts: { q?: string; section?: string; limit?: number },
): Promise<FoodCatalogRow[]> {
  const limit = Math.min(opts.limit ?? 50, 50);
  let query = supabase
    .from('food_catalog')
    .select(CATALOG_SELECT)
    .eq('is_active', true);

  if (opts.section) {
    query = query.eq('browse_section_id', opts.section);
  }

  if (opts.q && opts.q.trim().length >= 2) {
    const term = opts.q.trim().toLowerCase();
    query = query.or(
      `name.ilike.%${term}%,name_hi.ilike.%${term}%,slug.ilike.%${term}%`,
    );
  }

  query = query.order('sort_priority', { ascending: false }).order('name').limit(limit);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((r) => catalogRowFromDb(r as Record<string, unknown>));
}

export async function matchCatalogByName(
  supabase: SupabaseClient,
  name: string,
  browseSectionHint?: string | null,
): Promise<{ row: FoodCatalogRow; confidence: number } | null> {
  const term = name.trim().toLowerCase();
  if (!term) return null;

  let query = supabase
    .from('food_catalog')
    .select(CATALOG_SELECT)
    .eq('is_active', true)
    .or(
      `name.ilike.%${term}%,slug.ilike.%${term.replace(/\s+/g, '-')}%`,
    )
    .limit(15);

  if (browseSectionHint) {
    query = query.eq('browse_section_id', browseSectionHint);
  }

  const { data } = await query;
  if (!data?.length) {
    const { data: aliasRows } = await supabase
      .from('food_catalog')
      .select(CATALOG_SELECT)
      .eq('is_active', true)
      .contains('aliases', [term])
      .limit(5);
    if (!aliasRows?.length) return null;
    return { row: catalogRowFromDb(aliasRows[0] as Record<string, unknown>), confidence: 0.75 };
  }

  const exact = data.find(
    (r) =>
      String(r.name).toLowerCase() === term ||
      String(r.slug).toLowerCase() === term.replace(/\s+/g, '-'),
  );
  const pick = exact ?? data[0];
  const confidence = exact ? 0.95 : 0.72;
  return { row: catalogRowFromDb(pick as Record<string, unknown>), confidence };
}

export async function buildCartItemFromParse(
  supabase: SupabaseClient,
  catalogWriter: SupabaseClient,
  userId: string,
  line: ParsedLineInput,
  fullUserText: string,
): Promise<{
  food_catalog_id: string;
  display_name: string;
  meal_type: MealType;
  quantity: number;
  unit: string;
  portion_key: string | null;
  portion_label: string | null;
  calories_kcal: number;
  protein_g: number;
  needs_review: boolean;
  needs_portion_review: boolean;
  catalog_created: boolean;
}> {
  const meal_type = resolveMealTypeForParsedItem(line.meal_type, fullUserText);
  const match = await matchCatalogByName(supabase, line.name);
  const useExisting = match && match.confidence >= 0.85;

  let row: FoodCatalogRow;
  let catalog_created = false;

  if (useExisting) {
    row = match.row;
  } else {
    row = await createCatalogFromParsedLine(catalogWriter, userId, line);
    catalog_created = true;
  }

  const portionKey =
    mapPortionSizeToKey(line.portion_size) ??
    row.portion_presets.default_key ??
    'regular';
  const unit = line.unit && row.unit_options[line.unit] ? line.unit : row.default_unit;
  const macros = computeMacros(row, line.quantity, unit, portionKey);

  return {
    food_catalog_id: row.id,
    display_name: row.name,
    meal_type,
    quantity: line.quantity,
    unit,
    portion_key: portionKey,
    portion_label: getPortionLabel(row.portion_presets, portionKey),
    calories_kcal: macros.calories_kcal,
    protein_g: macros.protein_g,
    needs_review: false,
    needs_portion_review: false,
    catalog_created,
  };
}
