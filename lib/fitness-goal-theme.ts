import type { FitnessGoal } from './types';

export interface GoalTheme {
  label: string;
  /** Hex for --theme-primary */
  primary: string;
  /** Darker variant for hover states */
  primaryDark: string;
  /** Lighter variant for tints */
  primaryLight: string;
  /** RGB triple (no alpha) for use with rgba() in CSS */
  primaryRgb: string;
  /** Tailwind badge classes (bg + text + border) for inline use */
  badgeClass: string;
  /** Tailwind badge classes in the dark (dimmer) style for Leaderboard */
  badgeDimClass: string;
}

export const FITNESS_GOAL_THEMES: Record<FitnessGoal, GoalTheme> = {
  lose_weight: {
    label: 'Cutting',
    primary: '#E11D48',       // rose-600
    primaryDark: '#BE123C',   // rose-700
    primaryLight: '#FB7185',  // rose-400
    primaryRgb: '225, 29, 72',
    badgeClass: 'bg-rose-100 text-rose-700 border border-rose-200',
    badgeDimClass: 'bg-rose-400/10 text-rose-400',
  },
  gain_muscle: {
    label: 'Building',
    primary: '#4F46E5',       // indigo-600
    primaryDark: '#4338CA',   // indigo-700
    primaryLight: '#818CF8',  // indigo-400
    primaryRgb: '79, 70, 229',
    badgeClass: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    badgeDimClass: 'bg-indigo-400/10 text-indigo-400',
  },
  gain_weight: {
    label: 'Bulking',
    primary: '#059669',       // emerald-600
    primaryDark: '#047857',   // emerald-700
    primaryLight: '#34D399',  // emerald-400
    primaryRgb: '5, 150, 105',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    badgeDimClass: 'bg-emerald-400/10 text-emerald-400',
  },
  stay_active: {
    label: 'Active',
    primary: '#D97706',       // amber-600
    primaryDark: '#B45309',   // amber-700
    primaryLight: '#FBBF24',  // amber-400
    primaryRgb: '217, 119, 6',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    badgeDimClass: 'bg-amber-400/10 text-amber-400',
  },
  general_wellness: {
    label: 'Wellness',
    primary: '#7C3AED',       // violet-600
    primaryDark: '#6D28D9',   // violet-700
    primaryLight: '#A78BFA',  // violet-400
    primaryRgb: '124, 58, 237',
    badgeClass: 'bg-violet-100 text-violet-700 border border-violet-200',
    badgeDimClass: 'bg-violet-400/10 text-violet-400',
  },
};

/** Orange default for logged-out / loading state (Superjoin brand) */
export const DEFAULT_GOAL_THEME: GoalTheme = {
  label: '',
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8C5A',
  primaryRgb: '255, 107, 53',
  badgeClass: '',
  badgeDimClass: '',
};

export function getGoalTheme(goal: FitnessGoal | null | undefined): GoalTheme {
  if (!goal) return DEFAULT_GOAL_THEME;
  return FITNESS_GOAL_THEMES[goal] ?? DEFAULT_GOAL_THEME;
}

/** Set --theme-* CSS variables on :root so globals.css and Tailwind variables pick them up. */
export function applyFitnessGoalTheme(goal: FitnessGoal | null | undefined): void {
  if (typeof document === 'undefined') return;
  const t = getGoalTheme(goal);
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', t.primary);
  root.style.setProperty('--theme-primary-dark', t.primaryDark);
  root.style.setProperty('--theme-primary-light', t.primaryLight);
  root.style.setProperty('--theme-primary-rgb', t.primaryRgb);
}
