#!/usr/bin/env node
/**
 * Import food catalog from CSV (upsert by slug).
 *
 * Usage:
 *   node scripts/import-food-catalog.js [path/to/catalog.csv]
 *   # default: data/food-catalog-template.csv
 *
 * Requires HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING (preferred) or
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const postgresUrl = config.postgresUrl || process.env.HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING;
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey;

const VALID_UNITS = new Set(['piece', 'bowl', 'cup', 'tablespoon', 'serving', 'gram', 'ml']);
const VALID_UI = new Set(['count', 'bowl_scale', 'cup_scale', 'hand_portion', 'gram_only']);

let supabase = null;
if (!postgresUrl) {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
    );
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const UPSERT_SQL = `
  INSERT INTO public.food_catalog (
    slug, name, name_hi, browse_section_id, default_unit,
    kcal_per_serving, protein_g_per_serving, serving_label,
    unit_options, portion_ui_type, portion_presets,
    aliases, tags, is_junk, is_home_cooked, sort_priority, is_active, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5::food_unit_enum, $6, $7, $8,
    $9::jsonb, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    name_hi = EXCLUDED.name_hi,
    browse_section_id = EXCLUDED.browse_section_id,
    default_unit = EXCLUDED.default_unit,
    kcal_per_serving = EXCLUDED.kcal_per_serving,
    protein_g_per_serving = EXCLUDED.protein_g_per_serving,
    serving_label = EXCLUDED.serving_label,
    unit_options = EXCLUDED.unit_options,
    portion_ui_type = EXCLUDED.portion_ui_type,
    portion_presets = EXCLUDED.portion_presets,
    aliases = EXCLUDED.aliases,
    tags = EXCLUDED.tags,
    is_junk = EXCLUDED.is_junk,
    is_home_cooked = EXCLUDED.is_home_cooked,
    sort_priority = EXCLUDED.sort_priority,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at
`;

async function upsertRecord(pgClient, record) {
  if (pgClient) {
    await pgClient.query(UPSERT_SQL, [
      record.slug,
      record.name,
      record.name_hi,
      record.browse_section_id,
      record.default_unit,
      record.kcal_per_serving,
      record.protein_g_per_serving,
      record.serving_label,
      JSON.stringify(record.unit_options),
      record.portion_ui_type,
      JSON.stringify(record.portion_presets),
      record.aliases,
      record.tags,
      record.is_junk,
      record.is_home_cooked,
      record.sort_priority,
      record.is_active,
      record.updated_at,
    ]);
    return;
  }
  const { error } = await supabase.from('food_catalog').upsert(record, { onConflict: 'slug' });
  if (error) throw new Error(error.message);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || (c === '\r' && next === '\n')) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      if (c === '\r') i++;
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function parseJsonCol(value, label) {
  if (!value || !value.trim()) return null;
  try {
    return JSON.parse(value.trim());
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
}

function validateUnitOptions(defaultUnit, unitOptions) {
  if (!unitOptions || typeof unitOptions !== 'object') {
    throw new Error('unit_options must be a JSON object');
  }
  if (!unitOptions[defaultUnit]) {
    throw new Error(`unit_options must include default_unit key "${defaultUnit}"`);
  }
  for (const [key, cfg] of Object.entries(unitOptions)) {
    if (!cfg || typeof cfg.multiplier !== 'number' || cfg.multiplier <= 0) {
      throw new Error(`unit_options.${key}.multiplier must be > 0`);
    }
  }
}

function validatePortionPresets(presets) {
  if (!presets || typeof presets !== 'object' || !Array.isArray(presets.options) || presets.options.length === 0) {
    throw new Error('portion_presets must have options array');
  }
}

function splitPipe(value) {
  if (!value || !value.trim()) return [];
  return value.split('|').map((s) => s.trim()).filter(Boolean);
}

function parseBool(value, fallback) {
  if (value == null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  throw new Error(`Invalid boolean: ${value}`);
}

async function main() {
  const fileArg = process.argv[2];
  const csvPath = path.resolve(
    fileArg ||
      (fs.existsSync(path.join(__dirname, '..', 'food-catalog.csv'))
        ? path.join(__dirname, '..', 'food-catalog.csv')
        : path.join(__dirname, '..', 'data', 'food-catalog-template.csv')),
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const pg = postgresUrl ? require('pg') : null;
  let pgClient = null;
  if (postgresUrl) {
    pgClient = new pg.Client({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false },
    });
    await pgClient.connect();
    console.log('Importing via Postgres (direct)');
  } else {
    console.log('Importing via Supabase API');
  }

  let sectionIds;
  if (pgClient) {
    const { rows } = await pgClient.query('SELECT id FROM public.food_browse_sections');
    sectionIds = new Set(rows.map((s) => s.id));
  } else {
    const { data: sections, error: secErr } = await supabase
      .from('food_browse_sections')
      .select('id');
    if (secErr) {
      console.error('Failed to load browse sections:', secErr.message);
      process.exit(1);
    }
    sectionIds = new Set((sections ?? []).map((s) => s.id));
  }

  const raw = fs.readFileSync(csvPath, 'utf8');
  const table = parseCsv(raw);
  if (table.length < 2) {
    console.error('CSV needs header + at least one row');
    process.exit(1);
  }

  const headers = table[0].map((h) => h.trim());
  const seenSlugs = new Set();
  let ok = 0;
  let fail = 0;

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });

    try {
      const name = row.name;
      const browse_section = row.browse_section || row.browse_section_id;
      const default_unit = row.default_unit;
      const kcal = parseInt(row.kcal_per_serving, 10);
      const protein = parseFloat(row.protein_g_per_serving);

      if (!name || name.length < 2) throw new Error('name required');
      if (!browse_section || !sectionIds.has(browse_section)) {
        throw new Error(`invalid browse_section: ${browse_section}`);
      }
      if (!VALID_UNITS.has(default_unit)) throw new Error(`invalid default_unit: ${default_unit}`);
      if (!Number.isFinite(kcal) || kcal < 1 || kcal > 2000) throw new Error('invalid kcal_per_serving');
      if (!Number.isFinite(protein) || protein < 0 || protein > 200) {
        throw new Error('invalid protein_g_per_serving');
      }

      const slug = (row.slug || slugify(name)).trim();
      if (seenSlugs.has(slug)) throw new Error(`duplicate slug in file: ${slug}`);
      seenSlugs.add(slug);

      const unit_options = parseJsonCol(row.unit_options, 'unit_options');
      validateUnitOptions(default_unit, unit_options);

      const portion_presets =
        parseJsonCol(row.portion_presets, 'portion_presets') ||
        {
          default_key: 'regular',
          options: [{ key: 'regular', label: 'Regular', multiplier: 1 }],
        };
      validatePortionPresets(portion_presets);

      const portion_ui_type = row.portion_ui_type || 'bowl_scale';
      if (!VALID_UI.has(portion_ui_type)) throw new Error(`invalid portion_ui_type: ${portion_ui_type}`);

      const record = {
        slug,
        name,
        name_hi: row.name_hi || null,
        browse_section_id: browse_section,
        default_unit,
        kcal_per_serving: kcal,
        protein_g_per_serving: protein,
        serving_label: row.serving_label || null,
        unit_options,
        portion_ui_type,
        portion_presets,
        aliases: splitPipe(row.aliases),
        tags: splitPipe(row.tags),
        is_junk: parseBool(row.is_junk, false),
        is_home_cooked: parseBool(row.is_home_cooked, true),
        sort_priority: row.sort_priority ? parseInt(row.sort_priority, 10) : 50,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      await upsertRecord(pgClient, record);

      ok++;
      if (ok % 50 === 0 || ok === 1) console.log(`✓ ${ok} rows… (latest: ${slug})`);
    } catch (e) {
      fail++;
      console.error(`✗ row ${r + 1}: ${e.message}`);
    }
  }

  if (pgClient) {
    try {
      await pgClient.query(`NOTIFY pgrst, 'reload schema'`);
    } catch {
      /* optional — refreshes Supabase REST schema cache */
    }
    await pgClient.end();
  }

  console.log(`\nDone: ${ok} upserted, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
