DROP POLICY IF EXISTS "Update own or guest subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Delete own or guest subscription" ON public.push_subscriptions;

CREATE POLICY "Update own subscription"
ON public.push_subscriptions
FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Delete own subscription"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);