-- Allow users to delete their own daily_entries row (e.g. after clearing all activities via PATCH).
CREATE POLICY "Users can delete own entries"
  ON public.daily_entries FOR DELETE
  USING (auth.uid() = user_id);
