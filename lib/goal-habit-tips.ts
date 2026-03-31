import type { FitnessGoal } from './types';

/** Short coaching copy — keyed by primary fitness goal. Use per section (sleep / water / workout / food). */
export const GOAL_HABIT_TIPS: Record<
  FitnessGoal,
  { sleep: string; water: string; workout: string; food: string }
> = {
  lose_weight: {
    sleep:
      'Target 7–9 hours on a regular schedule. Short sleep raises hunger hormones and makes a calorie deficit harder to stick to — same bedtime helps.',
    water:
      'Spread fluids through the day (don’t chug at night). Good hydration supports metabolism and helps you tell thirst apart from hunger.',
    workout:
      'Blend strength work (keep muscle while cutting) with cardio you can repeat weekly. Consistency beats occasional all-out sessions.',
    food:
      'In a deficit, prioritize protein to protect muscle. If you track calories, stay consistent — rough estimates you log beat perfect plans you don’t.',
  },
  gain_muscle: {
    sleep:
      'Muscle repair happens in deep sleep — aim for 7–9 hours. A steady wind-down routine improves recovery between training days.',
    water:
      'Higher training volume means more sweat — sip steadily. Pair water with meals to support digestion and protein use.',
    workout:
      'Progressive overload on compound lifts plus enough weekly volume. Rest days matter — growth happens when you recover, not only in the gym.',
    food:
      'Spread protein across meals to support muscle protein synthesis. A modest surplus with enough protein and carbs around training beats “dirty” bulking.',
  },
  gain_weight: {
    sleep:
      'Extra calories need recovery — 7–9 hours helps you actually use the fuel you eat for growth instead of just feeling sluggish.',
    water:
      'Don’t run dry while eating more; hydration supports appetite, digestion, and training quality.',
    workout:
      'Strength-focused work with room to add reps or weight over time. Add easy movement (walks) so extra calories don’t all sit still.',
    food:
      'Hit your calorie target with mostly whole foods when you can — liquid calories and snacks are fine if they help you reach the number without feeling stuffed 24/7.',
  },
  stay_active: {
    sleep:
      'Regular sleep keeps energy steady for daily movement — even 30 minutes more on rough nights adds up over weeks.',
    water:
      'Sip before you’re thirsty during workdays. A bottle at your desk makes hitting your target automatic.',
    workout:
      'Pick activities you’ll repeat: sports, classes, or mixed cardio. The “best” plan is the one you show up for.',
    food:
      'Match tracking to what you’ll sustain — protein-only is fine if calories aren’t your focus right now. Simple rules beat all-or-nothing.',
  },
  general_wellness: {
    sleep:
      'Prioritize wind-down and a fixed wake time. Sleep anchors mood, focus, and appetite — small tweaks beat perfect spreadsheets.',
    water:
      'Steady hydration beats occasional overload. Herbal tea and water-rich foods count toward how you feel day to day.',
    workout:
      'Any joyful movement counts — walks, yoga, light strength. Match intensity to how you feel; consistency builds the habit.',
    food:
      'Gentle structure helps — aim for enough protein and plants without turning meals into a spreadsheet. Notice how foods affect your energy.',
  },
};

export function getGoalHabitTips(goal: FitnessGoal) {
  return GOAL_HABIT_TIPS[goal] ?? GOAL_HABIT_TIPS.general_wellness;
}
