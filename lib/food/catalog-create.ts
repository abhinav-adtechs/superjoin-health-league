import type { SupabaseClient } from '@supabase/supabase-js';
import { catalogRowFromDb } from './nutrition';
import type { FoodCatalogRow } from './types';
import type { ParsedLineInput } from './types';

const CATALOG_SELECT =
  'id, slug, name, name_hi, browse_section_id, default_unit, kcal_per_serving, protein_g_per_serving, serving_label, unit_options, portion_ui_type, portion_presets, aliases, tags, is_junk, sort_priority';

const VALID_UNITS = new Set(['piece', 'bowl', 'cup', 'tablespoon', 'serving', 'gram', 'ml']);

const UNIT_MACRO_DEFAULTS: Record<string, { kcal: number; protein: number }> = {
  piece: { kcal: 120, protein: 4 },
  bowl: { kcal: 180, protein: 6 },
  cup: { kcal: 80, protein: 2 },
  tablespoon: { kcal: 45, protein: 1 },
  serving: { kcal: 200, protein: 8 },
  gram: { kcal: 100, protein: 3 },
  ml: { kcal: 50, protein: 1 },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
}

async function uniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  let slug = base || 'dish';
  for (let n = 0; n < 20; n++) {
    const candidate = n === 0 ? slug : `${slug}-${n + 1}`;
    const { data } = await supabase.from('food_catalog').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

function defaultUnit(unit: string): string {
  return VALID_UNITS.has(unit) ? unit : 'serving';
}

function unitOptionsFor(unit: string) {
  const u = defaultUnit(unit);
  if (u === 'gram') {
    return {
      gram: { multiplier: 1, label: 'g', step: 10, min: 10, max: 500 },
    };
  }
  if (u === 'bowl') {
    return {
      bowl: { multiplier: 1, label: 'bowl', step: 0.5, min: 0.5, max: 4 },
    };
  }
  return {
    [u]: { multiplier: 1, label: u, step: 1, min: 0.5, max: 10 },
  };
}

/** Insert a new global catalog row for an AI-parsed dish not in the catalog yet. */
export async function createCatalogFromParsedLine(
  supabase: SupabaseClient,
  userId: string,
  line: ParsedLineInput,
): Promise<FoodCatalogRow> {
  const unit = defaultUnit(line.unit);
  const macros = UNIT_MACRO_DEFAULTS[unit] ?? UNIT_MACRO_DEFAULTS.serving;
  const slug = await uniqueSlug(supabase, slugify(line.name));
  const portion_presets = {
    default_key: 'regular',
    options: [{ key: 'regular', label: 'Regular', multiplier: 1 }],
  };

  const { data, error } = await supabase
    .from('food_catalog')
    .insert({
      slug,
      name: line.name.trim(),
      browse_section_id: 'other',
      default_unit: unit,
      kcal_per_serving: macros.kcal,
      protein_g_per_serving: macros.protein,
      serving_label: `1 ${unit} (estimated)`,
      unit_options: unitOptionsFor(unit),
      portion_ui_type: unit === 'piece' ? 'count' : 'bowl_scale',
      portion_presets,
      aliases: [],
      tags: ['user_added', 'nl_parse'],
      is_junk: false,
      is_home_cooked: true,
      sort_priority: 40,
      is_active: true,
      created_by: userId,
    })
    .select(CATALOG_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to add dish to catalog');
  }

  return catalogRowFromDb(data as Record<string, unknown>);
}
