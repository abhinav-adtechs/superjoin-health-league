'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown, Dumbbell, Flame, Footprints, HelpCircle,
  Moon, TrendingUp, Utensils, Zap, X, BookOpen, Info,
} from 'lucide-react';
import type { ScoringRule } from '@/app/api/scoring-rules/route';
import type { FoodTrackingMode, FitnessGoal } from '@/lib/types';
import { getDailyActivityCap, getNutritionCap, getGoalCrushThreshold } from '@/lib/points';
import { apiUrl, getApiFetchOptions } from '@/lib/api';
import { FITNESS_GOAL_THEMES } from '@/lib/fitness-goal-theme';
import { RulesListSkeleton } from '@/components/LoadingScreen';

export type ProfileContext = {
  fitness_goal?: FitnessGoal | null;
  food_tracking_mode?: FoodTrackingMode | null;
  goal_protein_g_day?: number | null;
  goal_calories_day?: number | null;
};

const FITNESS_GOAL_META: Record<string, { label: string; color: string }> = Object.fromEntries(
  (Object.entries(FITNESS_GOAL_THEMES) as [FitnessGoal, { label: string; badgeDimClass: string }][]).map(
    ([k, v]) => [k, { label: v.label, color: v.badgeDimClass }],
  ),
);

const FOOD_MODE_LABELS: Record<string, string> = {
  protein_only:  'Protein + water tracking',
  calories_only: 'Calories + water tracking',
  both:          'Protein + calories + water',
};

const FOOD_MODE_DAILY_CAP: Record<string, number> = {
  protein_only: 90,
  calories_only: 90,
  both: 90,
};

// Returns true if the rule is "inactive" given the user's food_tracking_mode
function isFoodRuleInactive(rule: ScoringRule, mode?: FoodTrackingMode | null): boolean {
  if (rule.category !== 'nutrition') return false;
  const isProteinRule =
    rule.field_name === 'protein_qty' || rule.action_label.toLowerCase().includes('protein');
  const isCalorieRule =
    rule.field_name === 'calories_kcal' || rule.action_label.toLowerCase().includes('calorie');
  const isCapNote = rule.action_label.toLowerCase().includes('nutrition cap');
  if (isCapNote) return false;
  if (mode == null) return isProteinRule || isCalorieRule;
  if (isProteinRule && mode === 'calories_only') return true;
  if (isCalorieRule && mode === 'protein_only') return true;
  return false;
}

// ─── Category display metadata ────────────────────────────────────────────────
const CATEGORY_META: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  streakNote?: boolean;
}> = {
  workout:        { label: 'Workout',       icon: Dumbbell,    color: 'text-blue-400',    bgColor: 'bg-blue-400/10'    },
  movement:       { label: 'Movement',      icon: Footprints,  color: 'text-amber-400',   bgColor: 'bg-amber-400/10'   },
  sleep:          { label: 'Sleep',         icon: Moon,        color: 'text-indigo-400',  bgColor: 'bg-indigo-400/10'  },
  nutrition:      { label: 'Nutrition',     icon: Utensils,    color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  logging_streak: { label: 'Log Streak',    icon: Flame,       color: 'text-orange-400',  bgColor: 'bg-orange-400/10', streakNote: true },
  weekly_perf:    { label: 'Weekly Goals',  icon: TrendingUp,  color: 'text-green-400',   bgColor: 'bg-green-400/10',  streakNote: true },
  goal_crush:     { label: 'Goal Crush',    icon: Zap,         color: 'text-yellow-400',  bgColor: 'bg-yellow-400/10', streakNote: true },
};

const CATEGORY_ORDER = ['workout', 'movement', 'sleep', 'nutrition', 'logging_streak', 'weekly_perf', 'goal_crush'];
const DAILY_CATS     = ['workout', 'movement', 'sleep', 'nutrition'];

export type RulesByCategory = Map<string, ScoringRule[]>;

export function dailyActivityCap(
  byCategory: RulesByCategory,
  profile?: ProfileContext,
): number {
  if (profile?.food_tracking_mode !== undefined) {
    return getDailyActivityCap(profile.food_tracking_mode);
  }
  return DAILY_CATS.reduce((sum, c) => {
    const rules = byCategory.get(c);
    if (c === 'nutrition' && profile) {
      return sum + getNutritionCap(profile.food_tracking_mode);
    }
    return sum + (rules?.[0]?.category_max ?? 0);
  }, 0);
}

// ─── Lazy fetch — only fires once when enabled becomes true ──────────────────
export function useScoringRules(enabled: boolean) {
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!enabled || fetched) return;
    setLoading(true);
    fetch(apiUrl('/api/scoring-rules'), getApiFetchOptions())
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.rules)) setRules(data.rules); })
      .catch(() => {})
      .finally(() => { setLoading(false); setFetched(true); });
  }, [enabled, fetched]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ScoringRule[]>();
    rules.forEach((r) => {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    });
    return map;
  }, [rules]);

  return { byCategory, loading };
}

// ─── FAQ builder — all values pulled from live rules ─────────────────────────
function buildFAQ(
  byCategory: RulesByCategory,
  profile?: ProfileContext,
): Array<{ q: string; a: string }> {
  const get = (cat: string) => byCategory.get(cat) ?? [];
  const pts = (rules: ScoringRule[], match: (r: ScoringRule) => boolean) =>
    rules.find(match)?.points ?? 0;

  const workoutMax     = pts(get('workout'),  r => r.action_label.includes('60'));
  const cardioMax      = pts(get('movement'), r => r.action_label.includes('Cardio 60'));
  const stepsMax       = pts(get('movement'), r => r.action_label.includes('100%'));
  const sleepOptimal   = pts(get('sleep'),    r => r.action_label.includes('8–9'));
  const sleepGood      = pts(get('sleep'),    r => r.action_label.includes('7–8'));
  const sleepFair      = pts(get('sleep'),    r => r.action_label.includes('6–7'));
  const proteinHit     = pts(get('nutrition'), r => r.action_label.toLowerCase().includes('protein goal hit'));
  const calorieHit     = pts(get('nutrition'), r => r.action_label.toLowerCase().includes('calories on target'));
  const weeklyPartial  = pts(get('weekly_perf'), r => r.action_label.toLowerCase().includes('partial'));
  const weeklyFull     = pts(get('weekly_perf'), r => r.action_label.toLowerCase().includes('full'));
  const crushStreaks   = get('goal_crush').filter(r => !r.action_label.includes('beyond') && !r.action_label.includes('threshold'));
  const logStreaks     = get('logging_streak').filter(r => !r.action_label.includes('beyond'));
  const dailyMax       = dailyActivityCap(byCategory, profile);
  const crushThreshold = getGoalCrushThreshold(profile?.food_tracking_mode);
  const movementMax    = get('movement')[0]?.category_max ?? 20;

  return [
    {
      q: 'What is the maximum I can earn per day?',
      a: `Your daily activity cap is ${dailyMax} pts (75 if you only track water, 90 if you track calories and/or protein). Categories: workout (25), movement (${movementMax}), sleep (15), nutrition (${getNutritionCap(profile?.food_tracking_mode)}). Streak and weekly bonuses stack on top.`,
    },
    {
      q: 'Does logging weight add to my daily points?',
      a: 'No. Weight updates your profile and weekly weigh-in; it is not part of the daily activity score. The Point System categories are workout, movement, sleep, and nutrition only.',
    },
    {
      q: 'What counts as a "Goal hit" day vs "Goal missed"?',
      a: `A day is a "Goal hit" when ALL your active daily goals are met: water ≥ target, sleep within your target range, protein ≥ target (if tracking protein), and calories aligned with your fitness goal direction (if tracking calories). Workout is a weekly goal — missing a workout on a given day does not itself create a "Goal missed" day.`,
    },
    {
      q: 'Why does "Workout goal met" show even though every day says "Goal missed"?',
      a: `These track different things. "Workout goal met" on the weekly badge means you logged enough workout sessions across the week (e.g. 4/4 days). "Goal missed" per day reflects whether your daily goals — water, sleep, protein, calories — were all met. They are independent and will often diverge.`,
    },
    {
      q: 'What is the difference between daily goals and weekly goals?',
      a: `Daily goals (water, sleep, protein/calories) are evaluated per day — each day stands on its own. Weekly goals (workout days per week, workout minutes per week) are tallied across the full Monday–Sunday week. This is why the workout goal appears only as a week-level badge, not per-day.`,
    },
    {
      q: 'What does "Workout goal partial" mean?',
      a: `It means you logged at least one workout session this week but fewer than your weekly target. For example, if your goal is 4 workout days and you only logged 2, the badge shows "Workout goal partial · 2/4 workout days". Reaching your exact target or above shows "Workout goal met".`,
    },
    {
      q: 'What week does the system use — Monday or Sunday start?',
      a: `All weekly calculations use Monday–Sunday (ISO week). A week always starts on Monday and ends on Sunday. This applies to the workout goal tracker, weekly performance bonuses, and the Health & Activity Log grouped view.`,
    },
    {
      q: 'How is sleep scored?',
      a: `${sleepOptimal || 15} pts for 8–9 hours (optimal), ${sleepGood || 12} pts for 7–8 hours, ${sleepFair || 7} pts for 6–7 hours, 3 pts for 5–6 hours, and 13 pts for 9+ hours. Less than 5 hours earns 0 pts.`,
    },
    {
      q: 'How does the Movement category work?',
      a: `Cardio and steps each scale to ${movementMax} pts independently; their sum is capped at ${movementMax}. Cardio uses duration tiers up to ${cardioMax || 20} pts. Steps use your personal step goal when set, otherwise fixed tiers up to ${stepsMax || 20} pts. Members 35+ get 85% thresholds on duration and step counts.`,
    },
    {
      q: 'Can I earn points on a rest day with no workout?',
      a: `Yes. Sleep, movement (steps/cardio), water, and nutrition are fully independent of workout. On a rest day you can still earn significant points by sleeping well, walking your step count, staying hydrated, and hitting your food goals.`,
    },
    {
      q: 'How does workout scoring work?',
      a: `Workout points scale with duration: 5 pts for logging any workout, up to ${workoutMax || 25} pts for 60+ minutes (11 at 15 min, 15 at 30 min, 20 at 45 min). Members 35+ have age-adjusted minute thresholds (85%).`,
    },
    {
      q: 'How does food tracking affect my daily cap?',
      a: `Water-only tracking caps nutrition at 15 pts (daily max 75). Tracking protein and/or calories unlocks up to 30 nutrition pts (daily max 90). Protein max is ${proteinHit || 15} pts; calorie adherence max is ${calorieHit || 15} pts in single-macro modes, or 10 pts each in "both" mode.`,
    },
    {
      q: 'How do calorie points work differently based on my fitness goal?',
      a: `Calorie scoring uses gradient tiers (±2%, ±5%, ±10%, ±15%). "Lose weight": earn by staying at or under budget. "Gain weight" or "Gain muscle": earn by meeting or exceeding target. "Stay active" or "General wellness": symmetric window around target. Requires goal_calories_day to be set.`,
    },
    {
      q: 'If I change my fitness goal, does it affect my past points?',
      a: `No. Each entry is scored with the fitness goal that was active at the time it was logged (stored as a snapshot). Changing your fitness goal today only affects new entries going forward — your historical points are preserved exactly as earned.`,
    },
    {
      q: 'What is a logging streak and how does it work?',
      a: `A logging streak counts consecutive days you log any health data. Missing a single day resets it to 0. Milestone bonuses are one-time per level: ${logStreaks.length ? logStreaks.map(r => `${r.points} pts at ${r.action_label.replace(' logging streak', ' days')}`).join(', ') : 'earned at 7, 14, 30, 60, and 90 days'}. Additional bonuses continue every 30 days beyond 90.`,
    },
    {
      q: 'Do streak bonuses count toward the daily points cap?',
      a: `No. Logging streak, goal crush streak, and weekly performance bonuses stack on top of your ${dailyMax}-pt daily cap and count toward leaderboard totals.`,
    },
    {
      q: 'What is a goal crush streak?',
      a: `A goal crush day requires ${crushThreshold}+ points (70% of your daily cap) AND activity in at least 3 of 4 categories. Milestone bonuses: ${crushStreaks.length ? crushStreaks.map(r => `${r.points} pts for ${r.action_label.replace(' goal crush streak', ' days in a row')}`).join(', ') : 'earned at 3, 7, 14, and 30 days'}. Missing the threshold or covering fewer than 3 categories resets the streak.`,
    },
    {
      q: 'What are the weekly performance bonuses?',
      a: `At the end of each week the system checks your weekly goals (workout days, workout minutes). ${weeklyPartial ? `Meeting some goals earns ${weeklyPartial} pts.` : ''} ${weeklyFull ? `Meeting ALL your set weekly goals earns ${weeklyFull} pts.` : ''} These are separate from daily activity points.`,
    },
    {
      q: 'What does the "+" bonus tag mean on a rule?',
      a: `Bonus rules (marked "+") stack on top of the base points for that category — they don't replace them. For example, completing a workout earns the base points, and crossing the duration threshold adds the bonus on top. You must earn the base rule first before the bonus can apply.`,
    },
  ];
}

// ─── Collapsible rules list ───────────────────────────────────────────────────
export function ScoringRulesSection({
  byCategory,
  profile,
  hideScoringRulesTitle = false,
}: {
  byCategory: RulesByCategory;
  profile?: ProfileContext;
  hideScoringRulesTitle?: boolean;
}) {
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['workout', 'movement']));

  const toggle = (cat: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const dailyMax = dailyActivityCap(byCategory, profile);
  const nutritionMax = getNutritionCap(profile?.food_tracking_mode);

  const mode = profile?.food_tracking_mode;

  return (
    <div>
      {!hideScoringRulesTitle && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Scoring rules</p>
          {dailyMax > 0 && (
            <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full tabular-nums">
              {dailyMax} pts/day cap
            </span>
          )}
        </div>
      )}

      {/* Personalised context card */}
      {profile?.fitness_goal && (
        <div className="mb-3 rounded-xl border border-white/8 bg-surface-1 px-3 py-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3 text-text-muted flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Your scoring setup</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const g = FITNESS_GOAL_META[profile.fitness_goal!];
              return g ? (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.color}`}>{g.label}</span>
              ) : null;
            })()}
            {mode ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">
                {FOOD_MODE_LABELS[mode] ?? mode} · {FOOD_MODE_DAILY_CAP[mode] ?? 90} pts/day
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary">
                Water only · 75 pts/day
              </span>
            )}
            {(!mode || mode === 'calories_only' || mode === 'both') ? (
              <span className="text-[10px] text-text-muted">
                {profile.fitness_goal === 'lose_weight' ? '↓ stay under calorie budget' :
                 profile.fitness_goal === 'stay_active' || profile.fitness_goal === 'general_wellness' ? '→ within 5% of calorie target' :
                 '↑ hit or exceed calorie target'}
              </span>
            ) : null}
          </div>
          <p className="text-[10px] text-text-muted leading-relaxed">
            {!mode && 'Water-only mode: nutrition max 15 pts, daily cap 75. Set a tracking mode in goals to unlock 90 pts/day.'}
            {mode === 'protein_only' && 'Water + protein active (30 nutrition pts). Calorie rules greyed out.'}
            {mode === 'calories_only' && 'Water + calories active (30 nutrition pts). Protein rules greyed out.'}
            {mode === 'both' && 'Water, protein, and calories each max 10 pts (30 nutrition total).'}
          </p>
        </div>
      )}

      <div className="space-y-1">
        {CATEGORY_ORDER.map((cat) => {
          const rules = byCategory.get(cat);
          if (!rules?.length) return null;
          const meta = CATEGORY_META[cat];
          if (!meta) return null;
          const Icon = meta.icon;
          const isOpen = openCats.has(cat);
          const categoryMax = rules[0]?.category_max;

          return (
            <div key={cat} className="rounded-xl border border-white/8 overflow-hidden">
              <button
                onClick={() => toggle(cat)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/4 transition-colors text-left"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${meta.bgColor}`}>
                  <Icon className={`w-3 h-3 ${meta.color}`} />
                </div>
                <span className={`text-xs font-semibold flex-1 ${meta.color}`}>{meta.label}</span>
                {(categoryMax != null || cat === 'nutrition') && (
                  <span className="text-[10px] text-text-muted tabular-nums mr-1">
                    max {cat === 'nutrition' ? nutritionMax : categoryMax} pts
                  </span>
                )}
                {meta.streakNote && (
                  <span className="text-[10px] text-text-muted mr-1">milestone</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="border-t border-white/8 px-3 py-2">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-white/5">
                      {rules.map((rule) => {
                        const inactive = isFoodRuleInactive(rule, mode);
                        return (
                          <tr key={rule.id} className={inactive ? 'opacity-35' : ''}>
                            <td className="py-1.5 pr-2">
                              <div className="flex items-start gap-1.5">
                                {rule.is_bonus && (
                                  <span className="mt-0.5 flex-shrink-0 text-[9px] font-bold text-text-muted bg-white/8 px-1 rounded leading-tight">+</span>
                                )}
                                {inactive && (
                                  <span className="mt-0.5 flex-shrink-0 text-[9px] font-bold text-text-muted bg-white/8 px-1 rounded leading-tight">off</span>
                                )}
                                <div>
                                  <p className="text-text-primary font-medium leading-snug">{rule.action_label}</p>
                                  <p className="text-text-muted leading-snug mt-0.5 text-[10px]">{rule.condition_desc}</p>
                                  {rule.age_note && (
                                    <p className="leading-snug mt-0.5 flex items-center gap-1">
                                      <span className="text-[9px] font-bold bg-amber-400/10 text-amber-400 px-1 py-0.5 rounded">35+</span>
                                      <span className="text-amber-400/80 text-[10px]">{rule.age_note}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-1.5 text-right align-top whitespace-nowrap w-12">
                              <span className={`font-bold tabular-nums ${inactive ? 'text-text-muted' : meta.color}`}>
                                {rule.is_bonus ? `+${rule.points}` : rule.points}
                              </span>
                              <span className="text-text-muted ml-0.5 text-[10px]">pts</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-text-muted leading-relaxed">
        Members 35+ get 85% thresholds on workout, cardio duration &amp; steps. Your daily cap is {dailyMax} pts based on tracking mode. Streak bonuses stack on top.
      </p>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FAQSection({
  byCategory,
  profile,
}: {
  byCategory: RulesByCategory;
  profile?: ProfileContext;
}) {
  const faqs = useMemo(() => buildFAQ(byCategory, profile), [byCategory, profile]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">FAQ</p>
      <div className="space-y-1">
        {faqs.map((faq, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className="rounded-xl border border-white/8 overflow-hidden">
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-white/4 transition-colors text-left"
              >
                <HelpCircle className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                <span className="text-xs text-text-primary font-medium flex-1 leading-snug">{faq.q}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="border-t border-white/8 px-3 py-2.5">
                  <p className="text-[11px] text-text-secondary leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide-over panel (works on all screen sizes) ────────────────────────────
export function PointSystemSheet({ open, onClose, profile }: { open: boolean; onClose: () => void; profile?: ProfileContext }) {
  const { byCategory, loading } = useScoringRules(open);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:bg-slate-900/65 md:backdrop-blur-none"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel — slides in from right */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-0 border-l border-white/10 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-modal
        role="dialog"
        aria-label="Point System"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 edge-safe-top border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent-superjoin-orange" />
            <h2 className="text-sm font-bold text-text-primary">Point System</h2>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-1.5 rounded-lg hover:bg-surface-1 text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 edge-safe-bottom space-y-6">
          {loading ? (
            <RulesListSkeleton rows={8} />
          ) : byCategory.size === 0 ? (
            <p className="text-sm text-text-muted">Unable to load scoring rules.</p>
          ) : (
            <>
              <ScoringRulesSection byCategory={byCategory} profile={profile} />
              <div className="h-px bg-white/8" />
              <FAQSection byCategory={byCategory} profile={profile} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
