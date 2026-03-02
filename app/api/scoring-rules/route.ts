import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export interface ScoringRule {
  id: number;
  category: string;
  category_max: number | null;
  sort_order: number;
  action_label: string;
  field_name: string | null;
  condition_desc: string;
  points: number;
  is_bonus: boolean;
  age_adjusted: boolean;
  age_note: string | null;
}

export interface ScoringRulesResponse {
  rules: ScoringRule[];
  categories: string[];
}

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('scoring_rules')
    .select('*')
    .order('category')
    .order('sort_order');

  if (error) {
    console.error('scoring_rules fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rules: ScoringRule[] = data ?? [];
  const categories = [...new Set(rules.map((r) => r.category))];

  return NextResponse.json({ rules, categories } satisfies ScoringRulesResponse);
}
