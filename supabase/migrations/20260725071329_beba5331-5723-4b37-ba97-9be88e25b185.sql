
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  interval_value INTEGER NOT NULL DEFAULT 1,
  interval_unit TEXT NOT NULL DEFAULT 'hour' CHECK (interval_unit IN ('minute','hour','day','week')),
  translation TEXT NOT NULL DEFAULT 'all',
  next_send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verse_id UUID REFERENCES public.verses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert a subscription"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users read own or guest subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users update own or guest subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users delete own or guest subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX idx_push_subscriptions_next_send ON public.push_subscriptions (next_send_at);
