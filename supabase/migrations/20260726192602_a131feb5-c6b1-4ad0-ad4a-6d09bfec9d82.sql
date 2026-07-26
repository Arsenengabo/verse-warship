
DROP POLICY IF EXISTS "Anyone can insert a subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users delete own or guest subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users read own or guest subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users update own or guest subscriptions" ON public.push_subscriptions;

CREATE POLICY "Read own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Insert own or guest subscription"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Update own or guest subscription"
  ON public.push_subscriptions FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL)
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Delete own or guest subscription"
  ON public.push_subscriptions FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL)
  );
