'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeMacros, getPortionLabel } from '@/lib/food/nutrition';
import type { FoodCatalogRow, MealType, PortionPresets, UnitOptions } from '@/lib/food/types';
import { MEAL_TYPES } from '@/lib/food/types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '🌅 Breakfast',
  brunch: '☕ Brunch',
  lunch: '🌤️ Lunch',
  snack: '🍎 Snack',
  dinner: '🌙 Dinner',
};

export type CatalogPick = {
  food_catalog_id: string;
  name: string;
  kcal_per_serving: number;
  protein_g_per_serving: number;
  portion_ui_type: string;
  default_unit: string;
  unit_options: UnitOptions;
  portion_presets: PortionPresets;
};

interface FoodPortionSheetProps {
  item: CatalogPick;
  defaultMealType: MealType;
  initial?: {
    quantity?: number;
    unit?: string;
    portion_key?: string | null;
    meal_type?: MealType;
  };
  onAdd: (payload: {
    food_catalog_id: string;
    display_name: string;
    meal_type: MealType;
    quantity: number;
    unit: string;
    portion_key: string;
    portion_label: string;
    calories_kcal: number;
    protein_g: number;
  }) => void;
  onClose: () => void;
}

export function FoodPortionSheet({ item, defaultMealType, initial, onAdd, onClose }: FoodPortionSheetProps) {
  const catalogRow = useMemo(
    (): FoodCatalogRow => ({
      id: item.food_catalog_id,
      slug: '',
      name: item.name,
      name_hi: null,
      browse_section_id: '',
      default_unit: item.default_unit,
      kcal_per_serving: item.kcal_per_serving,
      protein_g_per_serving: item.protein_g_per_serving,
      serving_label: null,
      unit_options: item.unit_options,
      portion_ui_type: item.portion_ui_type,
      portion_presets: item.portion_presets,
      aliases: [],
      tags: [],
      is_junk: false,
      sort_priority: 50,
    }),
    [item],
  );

  const unitKeys = Object.keys(item.unit_options);
  const [mealType, setMealType] = useState<MealType>(initial?.meal_type ?? defaultMealType);
  const [unit, setUnit] = useState(initial?.unit ?? item.default_unit);
  const [portionKey, setPortionKey] = useState(
    initial?.portion_key ?? item.portion_presets.default_key ?? 'regular',
  );
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);

  const countPresets = item.portion_ui_type === 'count';
  const bowlScale = item.portion_ui_type === 'bowl_scale';

  const macros = computeMacros(catalogRow, quantity, unit, portionKey);

  const sheet = (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="log-entry-form w-full max-w-lg bg-white rounded-t-2xl max-h-[75dvh] flex flex-col min-h-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="log-entry-scroll log-entry-scroll--compact flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-3">
        <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mb-3" />
        <h3 className="font-bold text-lg text-text-primary">{item.name}</h3>
        <p className="text-xs text-text-muted mb-3">
          {item.kcal_per_serving} kcal · {item.protein_g_per_serving}g per regular {item.default_unit}
        </p>

        <label className="block text-xs font-medium text-text-secondary mb-1">Meal</label>
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
          className="w-full border border-black/10 rounded-lg px-3 py-2 mb-4 text-sm"
        >
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>

        {item.portion_presets.options.length > 1 && (
          <>
            <label className="block text-xs font-medium text-text-secondary mb-1">Size</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {item.portion_presets.options.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPortionKey(p.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 touch-manipulation ${
                    portionKey === p.key
                      ? 'border-primary-orange bg-primary-orange/10'
                      : 'border-black/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        {countPresets ? (
          <>
            <label className="block text-xs font-medium text-text-secondary mb-1">How many?</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuantity(n)}
                  className={`w-10 h-10 rounded-full font-bold border-2 ${
                    quantity === n ? 'border-primary-orange bg-primary-orange/10' : 'border-black/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        ) : bowlScale ? (
          <>
            <label className="block text-xs font-medium text-text-secondary mb-1">How much?</label>
            <div className="flex gap-2 mb-4">
              {[0.5, 1, 1.5, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setQuantity(n);
                    setUnit('bowl');
                  }}
                  className={`flex-1 py-3 rounded-xl font-semibold border-2 ${
                    quantity === n && unit === 'bowl'
                      ? 'border-primary-orange bg-primary-orange/10'
                      : 'border-black/10'
                  }`}
                >
                  {n === 0.5 ? '½' : n === 1.5 ? '1½' : String(n)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 mb-4">
            <button type="button" className="w-10 h-10 rounded-full border" onClick={() => setQuantity(Math.max(0.5, quantity - (unit === 'bowl' ? 0.5 : 1)))}>
              −
            </button>
            <span className="text-xl font-bold w-12 text-center">{quantity}</span>
            <button type="button" className="w-10 h-10 rounded-full border" onClick={() => setQuantity(quantity + (unit === 'bowl' ? 0.5 : 1))}>
              +
            </button>
          </div>
        )}

        {unitKeys.length > 1 && (
          <div className="flex gap-2 mb-4">
            {unitKeys.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  unit === u ? 'border-primary-orange' : 'border-black/10'
                }`}
              >
                {item.unit_options[u]?.label ?? u}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm font-semibold text-text-primary mb-2">
          {quantity}× {getPortionLabel(item.portion_presets, portionKey)} · {macros.calories_kcal} kcal · {macros.protein_g}g protein
        </p>
        </div>

        <div className="log-entry-sticky-cta shrink-0 flex gap-2 px-5 pt-2 pb-5 edge-safe-bottom">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 min-h-[48px]">
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 min-h-[48px] font-bold"
            onClick={() =>
              onAdd({
                food_catalog_id: item.food_catalog_id,
                display_name: item.name,
                meal_type: mealType,
                quantity,
                unit,
                portion_key: portionKey,
                portion_label: getPortionLabel(item.portion_presets, portionKey),
                calories_kcal: macros.calories_kcal,
                protein_g: macros.protein_g,
              })
            }
          >
            Add to log
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(sheet, document.body);
}
