/**
 * Slack integration helpers.
 * Uses Incoming Webhooks for channel posts and Bot Token for DMs + user lookup.
 *
 * Required env vars:
 *   SLACK_BOT_TOKEN   — xoxb-... (scopes: chat:write, users:read, users:read.email, im:write)
 *   SLACK_WEBHOOK_URL — https://hooks.slack.com/services/... (for channel posts)
 *   NEXT_PUBLIC_APP_URL — your deployed app URL (e.g. https://your-app.vercel.app)
 */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

// ── Entry category detection ────────────────────────────────────────────────

export type EntryCategory = 'workout' | 'nutrition' | 'sleep' | 'steps' | 'mixed';

export function detectEntryCategory(body: Record<string, unknown>): EntryCategory {
  const hasWorkout = body.workout_done === true || body.cardio_done === true;
  const hasNutrition =
    body.home_cooked_meals !== undefined ||
    body.protein_meal !== undefined ||
    body.water_liters !== undefined ||
    body.junk_food !== undefined ||
    body.alcohol !== undefined;
  const hasSleep = body.sleep_hours !== undefined;
  const hasSteps = body.steps !== undefined;

  const count = [hasWorkout, hasNutrition, hasSleep, hasSteps].filter(Boolean).length;
  if (count > 1) return 'mixed';
  if (hasWorkout) return 'workout';
  if (hasNutrition) return 'nutrition';
  if (hasSleep) return 'sleep';
  if (hasSteps) return 'steps';
  return 'mixed';
}

// ── Message content helpers ─────────────────────────────────────────────────

const CATEGORY_META: Record<EntryCategory, { emoji: string; title: string; image: string }> = {
  workout:   { emoji: '🏋️', title: 'Workout Logged!',   image: 'workout.png' },
  nutrition: { emoji: '🥗', title: 'Nutrition Logged!', image: 'nutrition.png' },
  sleep:     { emoji: '😴', title: 'Sleep Logged!',     image: 'workout.png' },
  steps:     { emoji: '👟', title: 'Steps Logged!',     image: 'workout.png' },
  mixed:     { emoji: '⚡', title: 'Activity Logged!',  image: 'workout.png' },
};

function buildDetails(body: Record<string, unknown>, category: EntryCategory): string {
  const lines: string[] = [];

  if (category === 'workout' || category === 'mixed') {
    if (body.workout_done) {
      const types = Array.isArray(body.workout_types) ? (body.workout_types as string[]).join(', ') : '';
      const dur = body.workout_duration ? ` · ${body.workout_duration} min` : '';
      lines.push(`Workout${types ? ': ' + types : ''}${dur}`);
    }
    if (body.cardio_done) {
      const dur = body.cardio_duration ? ` · ${body.cardio_duration} min` : '';
      lines.push(`Cardio${body.cardio_type ? ': ' + body.cardio_type : ''}${dur}`);
    }
  }
  if (category === 'nutrition' || category === 'mixed') {
    if (body.water_liters) lines.push(`Water: ${body.water_liters}L`);
    if (body.home_cooked_meals) lines.push(`Home-cooked: ${body.home_cooked_meals} meal(s)`);
    if (body.protein_meal) lines.push('Protein meal ✓');
  }
  if (body.sleep_hours) lines.push(`Sleep: ${body.sleep_hours}h`);
  if (body.steps) lines.push(`Steps: ${Number(body.steps).toLocaleString()}`);

  return lines.slice(0, 3).join(' · ');
}

// ── Block Kit builder ───────────────────────────────────────────────────────

export interface SlackEntryPayload {
  displayName: string;
  category: EntryCategory;
  body: Record<string, unknown>;
  pointsToday: number;
}

export function buildEntryBlocks(payload: SlackEntryPayload): unknown[] {
  const { displayName, category, body, pointsToday } = payload;
  const { emoji, title, image } = CATEGORY_META[category];
  const details = buildDetails(body, category);
  const imageUrl = `${APP_URL}/slack/${image}`;

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*${displayName}* just logged a health activity! 🎉`,
          details ? `\n▸ ${details}` : '',
          `\n▸ *Points today:* ${pointsToday} pts`,
        ].join(''),
      },
      accessory: {
        type: 'image',
        image_url: imageUrl,
        alt_text: title,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Keep crushing it, team! 💪  ·  <${APP_URL}|Superjoin Health OS>`,
        },
      ],
    },
  ];
}

export function buildReminderBlocks(displayName: string): unknown[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '⏰ Daily Health Reminder', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey *${displayName}*! 👋\n\nDon't forget to log your health activities today. Every step, workout, and healthy habit counts toward the team leaderboard!\n\n▸ <${APP_URL}|Open Health OS and log now>`,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'Superjoin Health OS · Daily nudge' }],
    },
  ];
}

// ── Daily digest ────────────────────────────────────────────────────────────

export interface DigestRanking {
  rank: number;
  display_name: string;
  pts: number;
}

export interface RankCrossing {
  climber: string;
  overtook: string;
  new_rank: number;
}

export interface DigestData {
  nobody_logged: boolean;
  leader: { display_name: string; total_pts_month: number };
  top5: DigestRanking[];
  biggest_gainer_yesterday: { display_name: string; pts_yesterday: number } | null;
  rank_crossings: RankCrossing[];
  team_pts_yesterday: number;
  logged_yesterday_count: number;
  total_users: number;
  month_name: string;
  days_remaining_in_month: number;
}

const MORNING_HEADERS = [
  '☀️ Morning briefing — yesterday\'s health battlefield report',
  '🏆 Rise and shine — time to see who crushed it yesterday',
  '📋 Daily health debrief — your morning leaderboard update',
  '🌅 Good morning, champions — yesterday\'s scores are in',
  '⚡ Morning roll call — the leaderboard has spoken',
];

const LEADER_QUIPS = [
  'Still untouchable. Someone dethrone them already.',
  'Leading the pack like it\'s their day job.',
  'Sitting comfortably at the top. Suspiciously comfortable.',
  'The throne is theirs — for now.',
  'Absolutely living rent-free at #1.',
];

const GHOST_TOWN_LINES = [
  'Not a single log yesterday. The leaderboard is collecting dust.',
  'Zero activity yesterday. The couch won. Decisively.',
  'Yesterday: complete radio silence. The only thing getting a workout was the snooze button.',
  'Nobody logged a thing yesterday. Healthy habits took the day off apparently.',
  'Yesterday was a total write-off. The leaderboard is judging you all.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildDigestBlocks(data: DigestData): unknown[] {
  const {
    nobody_logged,
    leader,
    top5,
    biggest_gainer_yesterday,
    rank_crossings,
    team_pts_yesterday,
    logged_yesterday_count,
    total_users,
    month_name,
    days_remaining_in_month,
  } = data;

  const blocks: unknown[] = [];

  const daysLabel = days_remaining_in_month === 1
    ? '1 day left'
    : `${days_remaining_in_month} days left`;

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${pickRandom(MORNING_HEADERS)}`,
      emoji: true,
    },
  });

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `*${month_name} Health Contest*  ·  ${daysLabel} in the month` }],
  });

  blocks.push({ type: 'divider' });

  // Ghost town — nobody logged
  if (nobody_logged) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*👻 Ghost town.*\n\n${pickRandom(GHOST_TOWN_LINES)}\n\n_${daysLabel} to make up for it. Get logging._`,
      },
    });
    blocks.push({ type: 'divider' });
    // Still show current standings so there's context
    if (top5.length > 0) {
      const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];
      const lines = top5
        .map((r, i) => `${MEDALS[i] ?? `${r.rank}.`} *${r.display_name}*  —  ${r.pts} pts`)
        .join('\n');
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*📊 ${month_name} standings (unchanged)*\n${lines}` },
      });
    }
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `<${APP_URL}|Open Health OS and log now>` }],
    });
    return blocks;
  }

  // Current leader
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*👑 ${month_name} leader:* *${leader.display_name}* — ${leader.total_pts_month} pts\n_${pickRandom(LEADER_QUIPS)}_`,
    },
  });

  // Top 5 standings
  if (top5.length > 0) {
    const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];
    const lines = top5
      .map((r, i) => `${MEDALS[i] ?? `${r.rank}.`} *${r.display_name}*  —  ${r.pts} pts`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*📊 ${month_name} standings*\n${lines}` },
    });
  }

  blocks.push({ type: 'divider' });

  // Rank crossings — the juicy part
  if (rank_crossings.length > 0) {
    const crossingLines = rank_crossings
      .map((c) => `▸ *${c.climber}* overtook *${c.overtook}* — now #${c.new_rank}`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🔀 Yesterday's shake-up*\n${crossingLines}`,
      },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🔀 Yesterday's shake-up*\nNo rank changes yesterday. The order held.`,
      },
    });
  }

  // Yesterday's MVP
  if (biggest_gainer_yesterday) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚡ Yesterday's MVP:* *${biggest_gainer_yesterday.display_name}* — ${biggest_gainer_yesterday.pts_yesterday} pts logged. Highest single-day haul.`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // Team pulse
  const logRate = total_users > 0 ? Math.round((logged_yesterday_count / total_users) * 100) : 0;
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*Team pulse:* ${logged_yesterday_count} of ${total_users} logged yesterday · ${team_pts_yesterday} pts scored · ${logRate}% participation  ·  <${APP_URL}|Open Health OS>`,
      },
    ],
  });

  return blocks;
}

// ── API callers ─────────────────────────────────────────────────────────────

/** Post a rich Block Kit message to the configured Slack channel via webhook. */
export async function postToChannel(blocks: unknown[]): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) console.error('[Slack] postToChannel failed:', res.status, await res.text());
  } catch (e) {
    console.error('[Slack] postToChannel error:', e);
  }
}

/** Send a direct message to a Slack user via Bot Token. */
export async function sendDM(
  slackUserId: string,
  text: string,
  blocks?: unknown[],
): Promise<void> {
  if (!SLACK_BOT_TOKEN) return;
  try {
    const payload: Record<string, unknown> = { channel: slackUserId, text };
    if (blocks) payload.blocks = blocks;
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) console.error('[Slack] sendDM error:', data.error);
  } catch (e) {
    console.error('[Slack] sendDM error:', e);
  }
}

/** Resolve a Slack member ID from an email address using the bot token. */
export async function lookupSlackUserByEmail(email: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null;
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } },
    );
    const data = (await res.json()) as { ok: boolean; user?: { id: string } };
    if (data.ok && data.user?.id) return data.user.id;
    return null;
  } catch {
    return null;
  }
}
