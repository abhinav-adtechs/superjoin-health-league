-- Food catalog, meal logs, water logs, browse sections

-- ============================================
-- BROWSE SECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.food_browse_sections (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 50,
  default_portion_ui_type TEXT NOT NULL DEFAULT 'bowl_scale',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.food_browse_sections (id, label, emoji, sort_order, default_portion_ui_type) VALUES
  ('breads_roti', 'Breads & roti', '🫓', 10, 'count'),
  ('rice_biryani', 'Rice & biryani', '🍚', 20, 'bowl_scale'),
  ('dal_legumes', 'Dal & legumes', '🥣', 30, 'bowl_scale'),
  ('veg_curry', 'Veg curries', '🥗', 40, 'bowl_scale'),
  ('veg_starters', 'Veg starters', '🥬', 50, 'bowl_scale'),
  ('nonveg_curry', 'Non-veg curries', '🍗', 60, 'bowl_scale'),
  ('nonveg_starters', 'Non-veg starters', '🍖', 70, 'hand_portion'),
  ('eggs_protein', 'Eggs & protein', '🥚', 80, 'count'),
  ('snacks_chaat', 'Snacks & chaat', '🥟', 90, 'count'),
  ('beverages', 'Beverages', '☕', 100, 'cup_scale'),
  ('dairy', 'Dairy & raita', '🥛', 110, 'cup_scale'),
  ('salads', 'Salads & sides', '🥒', 120, 'bowl_scale'),
  ('thali_combo', 'Thali & combos', '🍱', 130, 'hand_portion'),
  ('sweets_dessert', 'Sweets & dessert', '🍬', 140, 'count'),
  ('fruits', 'Fruits', '🍎', 150, 'count'),
  ('other', 'Other', '🍽️', 200, 'bowl_scale')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  emoji = EXCLUDED.emoji,
  sort_order = EXCLUDED.sort_order,
  default_portion_ui_type = EXCLUDED.default_portion_ui_type;

-- ============================================
-- FOOD CATALOG
-- ============================================

CREATE TYPE public.food_unit_enum AS ENUM (
  'piece', 'bowl', 'cup', 'tablespoon', 'serving', 'gram', 'ml'
);

CREATE TYPE public.meal_type_enum AS ENUM (
  'breakfast', 'brunch', 'lunch', 'snack', 'dinner'
);

CREATE TYPE public.food_log_source_enum AS ENUM (
  'catalog', 'nl_parse', 'manual'
);

CREATE TYPE public.water_log_source_enum AS ENUM (
  'quick_glass', 'quick_bottle', 'quick_liter', 'manual', 'integration'
);

CREATE TABLE IF NOT EXISTS public.food_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_hi TEXT,
  browse_section_id TEXT NOT NULL REFERENCES public.food_browse_sections(id),
  default_unit public.food_unit_enum NOT NULL,
  kcal_per_serving INTEGER NOT NULL CHECK (kcal_per_serving >= 1 AND kcal_per_serving <= 2000),
  protein_g_per_serving NUMERIC(5,2) NOT NULL CHECK (protein_g_per_serving >= 0 AND protein_g_per_serving <= 200),
  serving_label TEXT,
  unit_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  portion_ui_type TEXT NOT NULL DEFAULT 'bowl_scale',
  portion_presets JSONB NOT NULL DEFAULT '{"default_key":"regular","options":[{"key":"regular","label":"Regular","hint":"","multiplier":1}]}'::jsonb,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_junk BOOLEAN NOT NULL DEFAULT false,
  is_home_cooked BOOLEAN NOT NULL DEFAULT true,
  sort_priority SMALLINT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_catalog_browse_section
  ON public.food_catalog (browse_section_id, sort_priority DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_food_catalog_aliases
  ON public.food_catalog USING GIN (aliases);

-- ============================================
-- MEAL FOOD LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.meal_food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  meal_type public.meal_type_enum NOT NULL,
  food_catalog_id UUID REFERENCES public.food_catalog(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  quantity NUMERIC(8,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  portion_key TEXT,
  portion_label TEXT,
  calories_kcal INTEGER NOT NULL CHECK (calories_kcal >= 0 AND calories_kcal <= 5000),
  protein_g NUMERIC(5,2) NOT NULL CHECK (protein_g >= 0 AND protein_g <= 500),
  source public.food_log_source_enum NOT NULL DEFAULT 'catalog',
  nl_raw TEXT,
  parse_confidence NUMERIC(3,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_food_logs_user_date
  ON public.meal_food_logs (user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_meal_food_logs_user_catalog_created
  ON public.meal_food_logs (user_id, food_catalog_id, created_at DESC);

-- ============================================
-- WATER LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  amount_liters NUMERIC(4,2) NOT NULL CHECK (amount_liters > 0 AND amount_liters <= 2),
  label TEXT,
  source public.water_log_source_enum NOT NULL DEFAULT 'quick_glass',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date_created
  ON public.water_logs (user_id, log_date, created_at DESC);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.food_browse_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_browse_sections_select ON public.food_browse_sections;
CREATE POLICY food_browse_sections_select ON public.food_browse_sections
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS food_catalog_select ON public.food_catalog;
CREATE POLICY food_catalog_select ON public.food_catalog
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS meal_food_logs_own ON public.meal_food_logs;
CREATE POLICY meal_food_logs_own ON public.meal_food_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS water_logs_own ON public.water_logs;
CREATE POLICY water_logs_own ON public.water_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
