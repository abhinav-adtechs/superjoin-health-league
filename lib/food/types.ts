export type MealType = 'breakfast' | 'brunch' | 'lunch' | 'snack' | 'dinner';

export const MEAL_TYPES: MealType[] = ['breakfast', 'brunch', 'lunch', 'snack', 'dinner'];

export type FoodLogSource = 'catalog' | 'nl_parse' | 'manual';

export type PortionUiType = 'count' | 'bowl_scale' | 'cup_scale' | 'hand_portion' | 'gram_only';

export type WaterLogSource = 'quick_glass' | 'quick_bottle' | 'quick_liter' | 'manual' | 'integration';

export interface PortionPresetOption {
  key: string;
  label: string;
  hint?: string;
  multiplier: number;
}

export interface PortionPresets {
  default_key: string;
  options: PortionPresetOption[];
}

export interface UnitOptionConfig {
  multiplier: number;
  label: string;
  step?: number;
  min?: number;
  max?: number;
}

export type UnitOptions = Record<string, UnitOptionConfig>;

export interface FoodBrowseSection {
  id: string;
  label: string;
  emoji: string | null;
  sort_order: number;
  default_portion_ui_type: string;
}

export interface FoodCatalogRow {
  id: string;
  slug: string;
  name: string;
  name_hi: string | null;
  browse_section_id: string;
  default_unit: string;
  kcal_per_serving: number;
  protein_g_per_serving: number;
  serving_label: string | null;
  unit_options: UnitOptions;
  portion_ui_type: string;
  portion_presets: PortionPresets;
  aliases: string[];
  tags: string[];
  is_junk: boolean;
  sort_priority: number;
}

export interface ParsedLineInput {
  name: string;
  quantity: number;
  unit: string;
  meal_type?: MealType;
  portion_size?: string | null;
  portion_confidence?: number;
}

export interface FoodCartItem {
  client_id: string;
  food_catalog_id: string | null;
  display_name: string;
  meal_type: MealType;
  quantity: number;
  unit: string;
  portion_key: string | null;
  portion_label: string | null;
  calories_kcal: number;
  protein_g: number;
  source: FoodLogSource;
  nl_raw?: string | null;
  needs_review?: boolean;
  needs_portion_review?: boolean;
  catalog_created?: boolean;
}

export interface MealFoodLogRow {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: MealType;
  food_catalog_id: string | null;
  display_name: string;
  quantity: number;
  unit: string;
  portion_key: string | null;
  portion_label: string | null;
  calories_kcal: number;
  protein_g: number;
  source: FoodLogSource;
  nl_raw: string | null;
  created_at: string;
}

export interface WaterLogRow {
  id: string;
  user_id: string;
  log_date: string;
  amount_liters: number;
  label: string | null;
  source: WaterLogSource;
  created_at: string;
}
