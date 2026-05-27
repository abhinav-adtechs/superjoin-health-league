import type { FoodCatalogRow, PortionPresets, UnitOptions } from './types';

export interface MacroResult {
  calories_kcal: number;
  protein_g: number;
}

export function parsePortionPresets(raw: unknown): PortionPresets {
  const fallback: PortionPresets = {
    default_key: 'regular',
    options: [{ key: 'regular', label: 'Regular', multiplier: 1 }],
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as PortionPresets;
  if (!Array.isArray(o.options) || o.options.length === 0) return fallback;
  return {
    default_key: o.default_key || 'regular',
    options: o.options,
  };
}

export function parseUnitOptions(raw: unknown): UnitOptions {
  if (!raw || typeof raw !== 'object') return {};
  return raw as UnitOptions;
}

export function getPortionMultiplier(presets: PortionPresets, portionKey: string | null | undefined): number {
  const key = portionKey || presets.default_key || 'regular';
  const opt = presets.options.find((p) => p.key === key);
  return opt?.multiplier ?? 1;
}

export function getUnitMultiplier(unitOptions: UnitOptions, unit: string): number {
  const opt = unitOptions[unit];
  if (!opt || typeof opt.multiplier !== 'number') return 1;
  return opt.multiplier;
}

export function getPortionLabel(presets: PortionPresets, portionKey: string | null | undefined): string {
  const key = portionKey || presets.default_key || 'regular';
  return presets.options.find((p) => p.key === key)?.label ?? 'Regular';
}

export function computeMacros(
  item: Pick<FoodCatalogRow, 'kcal_per_serving' | 'protein_g_per_serving' | 'unit_options' | 'portion_presets'>,
  quantity: number,
  unit: string,
  portionKey?: string | null,
): MacroResult {
  const presets = typeof item.portion_presets === 'object'
    ? item.portion_presets
    : parsePortionPresets(item.portion_presets);
  const unitOpts = typeof item.unit_options === 'object'
    ? item.unit_options
    : parseUnitOptions(item.unit_options);

  const portionMult = getPortionMultiplier(presets, portionKey);
  const unitMult = getUnitMultiplier(unitOpts, unit);
  const factor = quantity * unitMult * portionMult;

  return {
    calories_kcal: Math.round(Number(item.kcal_per_serving) * factor),
    protein_g: Math.round(Number(item.protein_g_per_serving) * factor * 10) / 10,
  };
}

export function catalogRowFromDb(row: Record<string, unknown>): FoodCatalogRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    name_hi: row.name_hi != null ? String(row.name_hi) : null,
    browse_section_id: String(row.browse_section_id),
    default_unit: String(row.default_unit),
    kcal_per_serving: Number(row.kcal_per_serving),
    protein_g_per_serving: Number(row.protein_g_per_serving),
    serving_label: row.serving_label != null ? String(row.serving_label) : null,
    unit_options: parseUnitOptions(row.unit_options),
    portion_ui_type: String(row.portion_ui_type || 'bowl_scale'),
    portion_presets: parsePortionPresets(row.portion_presets),
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    is_junk: Boolean(row.is_junk),
    sort_priority: Number(row.sort_priority ?? 50),
  };
}
