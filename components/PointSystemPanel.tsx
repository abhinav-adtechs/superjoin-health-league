'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Activity, ChevronDown, Dumbbell, Flame, Footprints, HelpCircle,
  Moon, TrendingUp, Utensils, Zap, X, BookOpen,
} from 'lucide-react';
import type { ScoringRule } from '@/app/api/scoring-rules/route';
import { apiUrl, getApiFetchOptions } from '@/lib/api';

// ─── Category display metadata ────────────────────────────────────────────────
const CATEGORY_META: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  streakNote?: boolean;
}> = {
  workout:        { label: 'Workout',       icon: Dumbbell,    color: 'text-blue-400',    bgColor: 'bg-blue-400/10'    },
  cardio:         { label: 'Cardio',        icon: Activity,    color: 'text-rose-400',    bgColor: 'bg-rose-400/10'    },
  sleep:          { label: 'Sleep',         icon: Moon,        color: 'text-indigo-400',  bgColor: 'bg-indigo-400/10'  },
  nutrition:      { label: 'Nutrition',     icon: Utensils,    color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  steps:          { label: 'Steps',         icon: Footprints,  color: 'text-amber-400',   bgColor: 'bg-amber-400/10'   },
  logging_streak: { label: 'Log Streak',    icon: Flame,       color: 'text-orange-400',  bgColor: 'bg-orange-400/10', streakNote: true },
  weekly_perf:    { label: 'Weekly Goals',  icon: TrendingUp,  color: 'text-green-400',   bgColor: 'bg-green-400/10',  streakNote: true },
  goal_crush:     { label: 'Goal Crush',    icon: Zap,         color: 'text-yellow-400',  bgColor: 'bg-yellow-400/10', streakNote: true },
};

const CATEGORY_ORDER = ['workout', 'cardio', 'sleep', 'nutrition', 'steps', 'logging_streak', 'weekly_perf', 'goal_crush'];
const DAILY_CATS     = ['workout', 'cardio', 'sleep', 'nutrition', 'steps'];

type RulesByCategory = Map<string, ScoringRule[]>;

// ─── Lazy fetch — only fires once when enabled becomes true ──────────────────
function useScoringRules(enabled: boolean) {
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
function buildFAQ(byCategory: RulesByCategory): Array<{ q: string; a: string }> {
  const get = (cat: string) => byCategory.get(cat) ?? [];
  const pts = (rules: ScoringRule[], match: (r: ScoringRule) => boolean) =>
    rules.find(match)?.points ?? 0;

  const workoutBase    = pts(get('workout'),  r => !r.is_bonus);
  const workoutBonus45 = pts(get('workout'),  r => r.is_bonus && r.action_label.includes('45'));
  const workoutBonus60 = pts(get('workout'),  r => r.is_bonus && r.action_label.includes('60'));
  const cardioBase     = pts(get('cardio'),   r => !r.is_bonus);
  const cardioBonus    = pts(get('cardio'),   r => r.is_bonus);
  const sleep7_9       = pts(get('sleep'),    r => !r.is_bonus && r.action_label.includes('7'));
  const sleep6_7       = pts(get('sleep'),    r => !r.is_bonus && r.action_label.includes('6'));
  const sleepQuality   = pts(get('sleep'),    r => r.is_bonus);
  const steps10k       = pts(get('steps'),    r => r.action_label.includes('10,000'));
  const steps7k        = pts(get('steps'),    r => r.action_label.includes('7,500'));
  const steps5k        = pts(get('steps'),    r => r.action_label.includes('5,000'));
  const weeklyPartial  = pts(get('weekly_perf'), r => r.action_label.toLowerCase().includes('partial'));
  const weeklyFull     = pts(get('weekly_perf'), r => r.action_label.toLowerCase().includes('full'));
  const crushStreaks    = get('goal_crush').filter(r => !r.action_label.includes('beyond'));
  const logStreaks      = get('logging_streak').filter(r => !r.action_label.includes('beyond'));
  const dailyMax       = DAILY_CATS.reduce((sum, c) => sum + (byCategory.get(c)?.[0]?.category_max ?? 0), 0);

  return [
    {
      q: 'What is the maximum I can earn per day?',
      a: `Your daily activity points are capped at ${dailyMax || 98} pts, covering workout, cardio, sleep, nutrition, and steps. Streak bonuses (logging streak, goal crush streak, weekly performance) are awarded separately on top of this cap — so a high-streak day can exceed ${dailyMax || 98} pts in total.`,
    },
    {
      q: 'What counts as a "Goal hit" day vs "Goal missed"?',
      a: `A day is a "Goal hit" when ALL your set daily goals are met: steps ≥ your daily target, water ≥ your target, and sleep within your target range. Your workout goal is weekly (not daily), so not working out on a given day does not itself make it a "Goal missed" day — only the daily metrics (steps, water, sleep) determine it.`,
    },
    {
      q: 'Why does "Workout goal met" show even though every day says "Goal missed"?',
      a: `These labels track completely different things. "Workout goal met" on the weekly badge means you logged enough workout sessions across the week (e.g. 4/4 workout days). "Goal missed" on each day means a daily metric — steps, water, or sleep — wasn't fully met. They are independent and will often diverge.`,
    },
    {
      q: 'What is the difference between daily goals and weekly goals?',
      a: `Daily goals (steps, water, sleep) are evaluated per day — each day stands on its own. Weekly goals (workout days per week, workout minutes per week, home-cooked meals per week) are tallied across the full Monday–Sunday week. This is why the workout goal appears only as a week-level badge, not per-day.`,
    },
    {
      q: 'What does "Workout goal partial" mean?',
      a: `It means you logged at least one workout session this week but fewer than your weekly target. For example, if your goal is 4 workout days and you only logged 2, the badge shows "Workout goal partial · 2/4 workout days". Reaching your exact target or above shows "Workout goal met".`,
    },
    {
      q: 'What week does the system use — Monday or Sunday start?',
      a: `All weekly calculations use Monday–Sunday (ISO week). A week always starts on Monday and ends on Sunday. This applies to the workout goal tracker, weekly performance bonuses, and the workout history grouped view.`,
    },
    {
      q: 'How is sleep scored?',
      a: `${sleep7_9 || 10} pts for sleeping 7–9 hours (the ideal range), ${sleep6_7 || 5} pts for 6–7 hours. A +${sleepQuality || 5} pt bonus if you rate your sleep quality 4 or 5 out of 5. Sleeping more than 9 hours earns 0 pts — oversleeping is not rewarded.`,
    },
    {
      q: 'How are steps scored, and does the 35+ age bracket change anything?',
      a: `Steps award up to ${steps10k || 15} pts/day: ${steps10k || 15} pts for 10,000+ steps, ${steps7k || 10} pts for 7,500+, ${steps5k || 5} pts for 5,000+. For members in the 35+ age bracket, thresholds are scaled to 85% — 8,500 / 6,375 / 4,250 steps — but the same point values apply. Cardio duration works the same way (30 min → 25.5 min for 35+).`,
    },
    {
      q: 'Can I earn points on a rest day with no workout?',
      a: `Yes. Sleep, steps, water, and nutrition are fully independent of workout. On a rest day you can still earn significant points by sleeping well, hitting your step count, staying hydrated, and making good food choices.`,
    },
    {
      q: 'How does workout scoring stack?',
      a: `Logging any workout earns ${workoutBase || 10} pts. ${workoutBonus45 ? `A 45+ min session adds +${workoutBonus45} pts,` : ''} ${workoutBonus60 ? `and 60+ min adds another +${workoutBonus60} pts (bonuses stack, max ${workoutBase + workoutBonus45 + workoutBonus60} pts for 60+ min).` : ''} Cardio works the same: ${cardioBase || 10} pts base, +${cardioBonus || 5} pts for 30+ minutes.`,
    },
    {
      q: 'What is a logging streak and how does it work?',
      a: `A logging streak counts consecutive days you log any health data — even just steps. Missing a single day resets it to 0. Milestone bonuses are one-time per level: ${logStreaks.length ? logStreaks.map(r => `${r.points} pts at ${r.action_label.replace(' logging streak', ' days')}`).join(', ') : 'earned at 7, 14, 30, 60, and 90 days'}. Additional bonuses continue every 30 days beyond 90.`,
    },
    {
      q: 'Do streak bonuses count toward the daily points cap?',
      a: `No. Logging streak, goal crush streak, and weekly performance bonuses all stack on top of the ${dailyMax || 98}-pt daily cap. They appear as separate bonus points on the day they are triggered.`,
    },
    {
      q: 'What is a goal crush streak?',
      a: `A goal crush streak counts consecutive days where you hit ALL your set daily goals (steps, water, sleep). Milestone bonuses: ${crushStreaks.length ? crushStreaks.map(r => `${r.points} pts for ${r.action_label.replace(' goal crush streak', ' days in a row')}`).join(', ') : 'earned at 3, 7, 14, and 30 days'}. Missing any daily goal resets the streak.`,
    },
    {
      q: 'What are the weekly performance bonuses?',
      a: `At the end of each week the system checks your weekly goals (workout days, workout minutes, home-cooked meals). ${weeklyPartial ? `Meeting some goals earns ${weeklyPartial} pts.` : ''} ${weeklyFull ? `Meeting ALL your set weekly goals earns ${weeklyFull} pts.` : ''} These are separate from daily activity points.`,
    },
    {
      q: 'What does the "+" bonus tag mean on a rule?',
      a: `Bonus rules (marked "+") stack on top of the base points for that category — they don't replace them. For example, completing a workout earns the base points, and crossing the duration threshold adds the bonus on top. You must earn the base rule first before the bonus can apply.`,
    },
  ];
}

// ─── Collapsible rules list ───────────────────────────────────────────────────
function RulesSection({ byCategory }: { byCategory: RulesByCategory }) {
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['workout', 'steps']));

  const toggle = (cat: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const dailyMax = DAILY_CATS.reduce((sum, c) => {
    const rules = byCategory.get(c);
    return sum + (rules?.[0]?.category_max ?? 0);
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Scoring rules</p>
        {dailyMax > 0 && (
          <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full tabular-nums">
            {dailyMax} pts/day cap
          </span>
        )}
      </div>

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
                {categoryMax != null && (
                  <span className="text-[10px] text-text-muted tabular-nums mr-1">max {categoryMax} pts</span>
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
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td className="py-1.5 pr-2">
                            <div className="flex items-start gap-1.5">
                              {rule.is_bonus && (
                                <span className="mt-0.5 flex-shrink-0 text-[9px] font-bold text-text-muted bg-white/8 px-1 rounded leading-tight">+</span>
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
                            <span className={`font-bold tabular-nums ${meta.color}`}>
                              {rule.is_bonus ? `+${rule.points}` : rule.points}
                            </span>
                            <span className="text-text-muted ml-0.5 text-[10px]">pts</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-text-muted leading-relaxed">
        Members 35+ get 85% thresholds on steps &amp; cardio. Streak bonuses stack on top of the daily cap.
      </p>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FAQSection({ byCategory }: { byCategory: RulesByCategory }) {
  const faqs = useMemo(() => buildFAQ(byCategory), [byCategory]);
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
export function PointSystemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
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
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent-superjoin-orange" />
            <h2 className="text-sm font-bold text-text-primary">Point System</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-surface-2/60" />
              ))}
            </div>
          ) : byCategory.size === 0 ? (
            <p className="text-sm text-text-muted">Unable to load scoring rules.</p>
          ) : (
            <>
              <RulesSection byCategory={byCategory} />
              <div className="h-px bg-white/8" />
              <FAQSection byCategory={byCategory} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
