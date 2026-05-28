'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { apiUrl, getApiFetchOptions, getAuthHeaders } from '@/lib/api';
import type { Profile } from '@/lib/types';
import type { FoodCartItem, MealType } from '@/lib/food/types';
import { MEAL_TYPES } from '@/lib/food/types';
import { FoodPortionSheet, type CatalogPick } from './FoodPortionSheet';
import { getProteinTargetGrams, calorieFieldLabel } from '@/components/LogEntryModal';
import { SliderField } from '@/components/entry/SliderField';

function newClientId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type SearchItem = CatalogPick & {
  browse_section?: { id: string; label: string; emoji?: string | null };
  serving_label?: string | null;
};

interface FoodLogPanelProps {
  profile: Profile;
  date: string;
  onLogged: (result: { points_delta?: number; daily_points?: number }) => void;
  onError: (msg: string) => void;
}

export function FoodLogPanel({ profile, date, onLogged, onError }: FoodLogPanelProps) {
  const [tab, setTab] = useState<'add' | 'describe'>('add');
  const [sections, setSections] = useState<{ id: string; label: string; emoji: string | null }[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [recents, setRecents] = useState<SearchItem[]>([]);
  const [cart, setCart] = useState<FoodCartItem[]>([]);
  const [defaultMeal, setDefaultMeal] = useState<MealType>('lunch');
  const [portionPick, setPortionPick] = useState<SearchItem | null>(null);
  const [describeText, setDescribeText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dayTotals, setDayTotals] = useState({ calories_kcal: 0, protein_g: 0 });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualProtein, setManualProtein] = useState(0);
  const [manualCalories, setManualCalories] = useState(0);
  /** Either cart or search/AI is expanded — not both (avoids overlap on small screens). */
  const [activePane, setActivePane] = useState<'composer' | 'cart'>('composer');
  /** Mobile keyboard open — collapse chrome and sync visual viewport height. */
  const [composerFocused, setComposerFocused] = useState(false);
  const composerBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const foodMode = profile.food_tracking_mode ?? 'protein_only';
  const showProtein = foodMode === 'protein_only' || foodMode === 'both';
  const showCalories = foodMode === 'calories_only' || foodMode === 'both';

  const batchKcal = cart.reduce((s, c) => s + c.calories_kcal, 0);
  const batchProtein = cart.reduce((s, c) => s + c.protein_g, 0);
  const blocked = cart.some((c) => !c.food_catalog_id);

  const loadDay = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/food/logs?date=${encodeURIComponent(date)}`), {
      ...getApiFetchOptions(),
      headers,
    });
    const data = await res.json();
    if (res.ok && data.totals) {
      setDayTotals({
        calories_kcal: data.totals.calories_kcal ?? 0,
        protein_g: data.totals.protein_g ?? 0,
      });
    }
  }, [date]);

  const loadSections = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl('/api/food/sections'), { ...getApiFetchOptions(), headers });
    const data = await res.json();
    if (res.ok) setSections(data.sections ?? []);
  }, []);

  const loadRecents = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl('/api/food/recent'), { ...getApiFetchOptions(), headers });
    const data = await res.json();
    if (res.ok) setRecents((data.items ?? []) as SearchItem[]);
  }, []);

  const runSearch = useCallback(async () => {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (searchQ.trim().length >= 2) params.set('q', searchQ.trim());
    if (section) params.set('section', section);
    const res = await fetch(apiUrl(`/api/food/search?${params}`), {
      ...getApiFetchOptions(),
      headers,
    });
    const data = await res.json();
    if (res.ok) setResults((data.items ?? []) as SearchItem[]);
  }, [searchQ, section]);

  useEffect(() => {
    loadSections();
    loadRecents();
    loadDay();
  }, [loadSections, loadRecents, loadDay]);

  useEffect(() => {
    const t = setTimeout(runSearch, 200);
    return () => clearTimeout(t);
  }, [runSearch]);

  useEffect(() => {
    if (cart.length === 0) setActivePane('composer');
  }, [cart.length]);

  useEffect(() => {
    if (activePane === 'cart') {
      setManualOpen(false);
      if (composerBlurTimer.current) clearTimeout(composerBlurTimer.current);
      setComposerFocused(false);
    }
  }, [activePane]);

  useEffect(() => {
    if (!composerFocused) {
      document.documentElement.style.removeProperty('--visual-vh');
      document.documentElement.style.removeProperty('--visual-offset-top');
      document.documentElement.style.removeProperty('--keyboard-inset');
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const syncViewport = () => {
      document.documentElement.style.setProperty('--visual-vh', `${vv.height}px`);
      document.documentElement.style.setProperty('--visual-offset-top', `${vv.offsetTop}px`);
      const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      document.documentElement.style.removeProperty('--visual-vh');
      document.documentElement.style.removeProperty('--visual-offset-top');
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, [composerFocused]);

  useEffect(
    () => () => {
      if (composerBlurTimer.current) clearTimeout(composerBlurTimer.current);
    },
    [],
  );

  const handleComposerFocus = () => {
    if (composerBlurTimer.current) clearTimeout(composerBlurTimer.current);
    setComposerFocused(true);
    setActivePane('composer');
  };

  const handleComposerBlur = () => {
    composerBlurTimer.current = setTimeout(() => setComposerFocused(false), 120);
  };

  const showComposer = activePane === 'composer';
  const showCartExpanded = activePane === 'cart' && cart.length > 0;
  const showTypingChrome = !composerFocused;

  const addToCart = (payload: {
    food_catalog_id: string;
    display_name: string;
    meal_type: MealType;
    quantity: number;
    unit: string;
    portion_key: string;
    portion_label: string;
    calories_kcal: number;
    protein_g: number;
    source?: FoodCartItem['source'];
    needs_review?: boolean;
    needs_portion_review?: boolean;
    catalog_created?: boolean;
    nl_raw?: string;
  }) => {
    setCart((prev) => [
      ...prev,
      {
        client_id: newClientId(),
        food_catalog_id: payload.food_catalog_id,
        display_name: payload.display_name,
        meal_type: payload.meal_type,
        quantity: payload.quantity,
        unit: payload.unit,
        portion_key: payload.portion_key,
        portion_label: payload.portion_label,
        calories_kcal: payload.calories_kcal,
        protein_g: payload.protein_g,
        source: payload.source ?? 'catalog',
        nl_raw: payload.nl_raw,
        needs_review: payload.needs_review,
        needs_portion_review: payload.needs_portion_review,
        catalog_created: payload.catalog_created,
      },
    ]);
    setPortionPick(null);
  };

  const parseDescribe = async () => {
    if (!describeText.trim()) return;
    setParsing(true);
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' };
      const res = await fetch(apiUrl('/api/food/parse'), {
        method: 'POST',
        ...getApiFetchOptions(),
        headers,
        body: JSON.stringify({ text: describeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      for (const line of data.items ?? []) {
        addToCart({
          food_catalog_id: line.food_catalog_id ?? '',
          display_name: line.display_name,
          meal_type: line.meal_type,
          quantity: line.quantity,
          unit: line.unit,
          portion_key: line.portion_key ?? 'regular',
          portion_label: line.portion_label ?? 'Regular',
          calories_kcal: line.calories_kcal ?? 0,
          protein_g: line.protein_g ?? 0,
          source: 'nl_parse',
          needs_review: line.needs_review,
          needs_portion_review: line.needs_portion_review,
          catalog_created: line.catalog_created,
          nl_raw: line.nl_raw,
        });
      }
      setDescribeText('');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Parse failed');
    } finally {
      setParsing(false);
    }
  };

  const submitCart = async () => {
    if (cart.length === 0 || blocked) return;
    setSaving(true);
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' };
      const items = cart
        .filter((c) => c.food_catalog_id)
        .map((c) => ({
          food_catalog_id: c.food_catalog_id,
          display_name: c.display_name,
          meal_type: c.meal_type,
          quantity: c.quantity,
          unit: c.unit,
          portion_key: c.portion_key,
          portion_label: c.portion_label,
          calories_kcal: c.calories_kcal,
          protein_g: c.protein_g,
          source: c.source,
          nl_raw: c.nl_raw,
        }));

      const res = await fetch(apiUrl('/api/food/logs'), {
        method: 'POST',
        ...getApiFetchOptions(),
        headers,
        body: JSON.stringify({ date, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      if (manualOpen && (manualProtein > 0 || manualCalories > 0)) {
        const entryBody: Record<string, unknown> = { date };
        if (showProtein && manualProtein > 0) {
          entryBody.protein_qty = manualProtein;
          entryBody.protein_meal = true;
        }
        if (showCalories && manualCalories > 0) entryBody.calories_kcal = manualCalories;
        await fetch(apiUrl('/api/entries'), {
          method: 'POST',
          ...getApiFetchOptions(),
          headers,
          body: JSON.stringify(entryBody),
        });
      }

      setCart([]);
      onLogged({ points_delta: data.points_delta, daily_points: data.daily_points });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const proteinTarget = getProteinTargetGrams(profile);

  return (
    <div
      className={`food-log-panel log-entry-form flex flex-col flex-1 min-h-0 h-full overflow-hidden gap-1.5 sm:gap-2${
        composerFocused ? ' food-log-panel--typing' : ''
      }${showCartExpanded ? ' food-log-panel--cart-expanded' : ''}`}
    >
      <p className="hidden sm:block text-[10px] text-text-muted shrink-0 leading-tight">
        Logged today: {dayTotals.calories_kcal} kcal · {dayTotals.protein_g}g
        {showProtein && ` · goal ~${proteinTarget}g`}
      </p>

      <div
        className={`food-log-panel__cart rounded-xl border border-slate-200 bg-slate-50 shadow-sm overflow-hidden ${
          showCartExpanded ? 'flex flex-col flex-1 min-h-0' : 'shrink-0'
        }`}
      >
        {cart.length === 0 ? (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white">
            <span className="text-xs font-bold text-text-primary">Cart</span>
            <span className="text-[11px] text-text-muted truncate">Search or AI below</span>
          </div>
        ) : showCartExpanded ? (
          <>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-b border-slate-200 text-left"
              aria-expanded
              onClick={() => setActivePane('composer')}
            >
              <span className="text-xs font-bold text-text-primary">Cart</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-primary-orange">
                {cart.length}
                <ChevronUp className="w-3.5 h-3.5 text-text-muted" aria-hidden />
              </span>
            </button>
            <ul className="divide-y divide-slate-200 flex-1 min-h-0 overflow-y-auto">
              {cart.map((line) => (
                <li
                  key={line.client_id}
                  className={`px-3 py-1.5 text-sm ${line.catalog_created ? 'bg-sky-50' : 'bg-white'}`}
                >
                  <div className="flex justify-between gap-2 items-start">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary text-[13px] leading-snug truncate">
                        <span className="text-[10px] uppercase text-text-muted mr-1">{line.meal_type}</span>
                        {line.quantity}× {line.display_name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {line.calories_kcal} kcal · {line.protein_g}g
                        {line.catalog_created ? ' · new' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-text-muted shrink-0 p-1 text-xs"
                      aria-label="Remove"
                      onClick={() => setCart((prev) => prev.filter((c) => c.client_id !== line.client_id))}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white text-left"
            aria-expanded={false}
            onClick={() => setActivePane('cart')}
          >
            <span className="text-xs font-bold text-text-primary">Cart</span>
            <span className="min-w-0 flex-1 text-[11px] text-text-muted truncate text-center px-1 tabular-nums">
              {cart.length} item{cart.length === 1 ? '' : 's'} · +{batchKcal} kcal · +{batchProtein}g
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-muted" aria-hidden />
          </button>
        )}
      </div>

      {!showCartExpanded ? (
        <div
          role="tablist"
          aria-label="Add food"
          className="food-log-panel__tabs grid grid-cols-2 gap-1 p-0.5 sm:p-1 rounded-xl bg-slate-100 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'add'}
            onClick={() => {
              setTab('add');
              setActivePane('composer');
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-all ${
              tab === 'add'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'describe'}
            onClick={() => {
              setTab('describe');
              setActivePane('composer');
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-all inline-flex items-center justify-center gap-1 ${
              tab === 'describe'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-orange" aria-hidden />
            AI
          </button>
        </div>
      ) : null}

      {showCartExpanded ? (
        <button
          type="button"
          className="shrink-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-text-secondary text-center"
          onClick={() => setActivePane('composer')}
        >
          Add more via Search or AI
        </button>
      ) : null}

      {!showCartExpanded ? (
      <div
        className={`food-log-panel__main flex flex-col overflow-hidden ${
          showComposer ? 'flex-1 min-h-0' : 'shrink-0 h-0 min-h-0 overflow-hidden pointer-events-none'
        }`}
        aria-hidden={!showComposer}
      >
      {tab === 'add' ? (
        <div className="food-log-panel__search flex flex-col flex-1 min-h-0 overflow-hidden -mx-0.5 px-0.5">
          {showTypingChrome ? (
            <div className="food-log-panel__search-chrome shrink-0 space-y-2 pb-2">
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDefaultMeal(m)}
                    className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium ${
                      defaultMeal === m ? 'bg-black/10' : 'text-text-muted'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <input
            type="search"
            placeholder="Search roti, dal, egg…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onFocus={handleComposerFocus}
            onBlur={handleComposerBlur}
            className="food-log-panel__search-input w-full border border-black/10 rounded-xl px-3 py-2 text-sm shrink-0"
          />
          {showTypingChrome ? (
            <div className="food-log-panel__search-chrome shrink-0 space-y-2 pt-2">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 snap-x">
                <button
                  type="button"
                  onClick={() => setSection(null)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${
                    !section ? 'border-primary-orange bg-primary-orange/10' : 'border-black/10'
                  }`}
                >
                  All
                </button>
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                      section === s.id ? 'border-primary-orange bg-primary-orange/10' : 'border-black/10'
                    }`}
                  >
                    {s.emoji ? `${s.emoji} ` : ''}
                    {s.label}
                  </button>
                ))}
              </div>
              {recents.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {recents.map((r) => (
                    <button
                      key={r.food_catalog_id}
                      type="button"
                      onClick={() => setPortionPick(r)}
                      className="shrink-0 px-3 py-1 rounded-full bg-black/5 text-xs font-medium"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <ul className="food-log-panel__search-results flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0.5 pt-2 pb-1">
            {results.length === 0 ? (
              <li className="text-sm text-text-muted py-3 text-center">
                {searchQ.length < 2 && !section ? 'Search or pick a category' : 'No dishes found'}
              </li>
            ) : (
              results.map((r) => (
                <li key={r.food_catalog_id}>
                  <button
                    type="button"
                    onClick={() => setPortionPick(r)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 flex justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-sm block truncate">{r.name}</span>
                      {r.serving_label && (
                        <span className="block text-[10px] text-text-muted truncate">{r.serving_label}</span>
                      )}
                    </span>
                    <span className="text-[10px] text-text-muted shrink-0 pt-0.5">
                      {r.kcal_per_serving} kcal
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div className="food-log-panel__ai flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl sm:rounded-2xl border-2 border-dashed border-primary-orange/30 bg-gradient-to-b from-primary-orange/[0.06] to-transparent p-2.5 sm:p-3">
          {showTypingChrome ? (
            <p className="food-log-panel__ai-hint text-[10px] sm:text-[11px] text-text-secondary shrink-0 mb-1.5 line-clamp-2">
              Describe meals — we match dishes and add new ones to the catalog.
            </p>
          ) : null}
          <textarea
            value={describeText}
            onChange={(e) => setDescribeText(e.target.value)}
            onFocus={handleComposerFocus}
            onBlur={handleComposerBlur}
            rows={composerFocused ? undefined : 3}
            placeholder="breakfast: poha — lunch: 3 chapati, dal"
            className="food-log-panel__ai-input w-full min-h-[5rem] bg-white/90 border border-black/8 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-orange/30"
          />
          {showTypingChrome ? (
            <div className="food-log-panel__ai-chips flex flex-wrap gap-1 shrink-0 pt-1.5">
              {['Since morning', 'Today', 'This meal'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 border border-black/8 text-text-muted"
                  onClick={() => setDescribeText((t) => (t ? `${t}\n` : '') + `${chip}: `)}
                >
                  {chip}
                </button>
              ))}
            </div>
          ) : null}
          <div className="food-log-panel__ai-actions flex justify-end shrink-0 pt-1.5">
            <button
              type="button"
              disabled={parsing || !describeText.trim()}
              onClick={parseDescribe}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary-orange bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-sm font-bold text-primary-orange shadow-sm disabled:opacity-40 active:scale-[0.98]"
            >
              <Sparkles className={`w-4 h-4 ${parsing ? 'animate-pulse' : ''}`} aria-hidden />
              {parsing ? 'Working…' : 'Add to cart'}
            </button>
          </div>
        </div>
      )}
      </div>
      ) : null}

      <div className="food-log-panel__footer log-entry-sticky-cta shrink-0 pt-1.5 sm:pt-2 border-t border-black/5 bg-white">
        {!showCartExpanded && tab === 'add' && (showProtein || showCalories) && (
          <button
            type="button"
            className="text-[10px] text-text-muted underline mb-2 block"
            onClick={() => setManualOpen((o) => !o)}
          >
            {manualOpen ? 'Hide manual macros' : 'Manual protein / calories'}
          </button>
        )}
        {!showCartExpanded && manualOpen && tab === 'add' && (
          <div className="space-y-2 max-h-[100px] overflow-y-auto mb-2">
            {showProtein && (
              <SliderField
                label="Protein override"
                value={manualProtein}
                min={0}
                max={200}
                step={5}
                onChange={setManualProtein}
                unit=" g"
              />
            )}
            {showCalories && (
              <SliderField
                label={calorieFieldLabel(profile)}
                value={manualCalories}
                min={0}
                max={4000}
                step={25}
                onChange={setManualCalories}
                unit=" kcal"
              />
            )}
          </div>
        )}
        <div className="flex items-stretch gap-2 rounded-xl bg-slate-100 p-1.5">
          <div className="flex-1 flex flex-col justify-center px-2 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-text-muted font-medium hidden sm:block">
              This batch
            </p>
            <p className="text-xs sm:text-sm font-semibold text-text-primary tabular-nums truncate leading-tight">
              <span className="sm:hidden text-[10px] text-text-muted font-normal block">
                Today {dayTotals.calories_kcal} kcal · {dayTotals.protein_g}g
              </span>
              +{batchKcal} kcal · +{batchProtein}g
            </p>
          </div>
          <button
            type="button"
            disabled={cart.length === 0 || blocked || saving}
            onClick={submitCart}
            className="btn-primary shrink-0 min-w-[8.5rem] px-5 min-h-[48px] rounded-lg font-bold text-sm disabled:opacity-40"
          >
            {saving ? '…' : cart.length === 0 ? 'Log' : `Log ${cart.length}`}
          </button>
        </div>
      </div>

      {portionPick && (
        <FoodPortionSheet
          item={portionPick}
          defaultMealType={defaultMeal}
          onClose={() => setPortionPick(null)}
          onAdd={(p) => addToCart({ ...p, source: 'catalog' })}
        />
      )}
    </div>
  );
}
