
-- VERSES (public read)
CREATE TABLE public.verses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'KJV',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verses TO anon, authenticated;
GRANT ALL ON public.verses TO service_role;
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verses are viewable by everyone"
  ON public.verses FOR SELECT
  USING (true);

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by their owner"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FAVORITES
CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_id UUID NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, verse_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own favorites"
  ON public.favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- LESSONS (placeholder for future feature)
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scripture_refs TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own lessons"
  ON public.lessons FOR ALL TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- GROUPS + MEMBERSHIP + EVENTS (placeholders)
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "Users can create groups"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their groups"
  ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can delete their groups"
  ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Members can view group membership"
  ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Users can join groups themselves"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave groups themselves"
  ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  video_link TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view events for their groups"
  ON public.events FOR SELECT TO authenticated
  USING (group_id IS NULL OR public.is_group_member(group_id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Users create events they author"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authors update their events"
  ON public.events FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authors delete their events"
  ON public.events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Seed KJV public-domain verses
INSERT INTO public.verses (reference, text, translation, tags) VALUES
('John 3:16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', 'KJV', ARRAY['love','salvation']),
('Psalm 23:1', 'The Lord is my shepherd; I shall not want.', 'KJV', ARRAY['comfort','trust']),
('Philippians 4:13', 'I can do all things through Christ which strengtheneth me.', 'KJV', ARRAY['strength']),
('Proverbs 3:5', 'Trust in the Lord with all thine heart; and lean not unto thine own understanding.', 'KJV', ARRAY['trust','wisdom']),
('Romans 8:28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', 'KJV', ARRAY['hope','providence']),
('Isaiah 40:31', 'But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', 'KJV', ARRAY['strength','hope']),
('Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.', 'KJV', ARRAY['hope','peace']),
('Matthew 11:28', 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', 'KJV', ARRAY['rest','comfort']),
('Psalm 46:10', 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.', 'KJV', ARRAY['peace','stillness']),
('Joshua 1:9', 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.', 'KJV', ARRAY['courage']),
('2 Corinthians 5:17', 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.', 'KJV', ARRAY['renewal']),
('Romans 12:2', 'And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.', 'KJV', ARRAY['renewal','wisdom']),
('Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.', 'KJV', ARRAY['scripture','guidance']),
('Ephesians 2:8', 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.', 'KJV', ARRAY['grace','salvation']),
('Galatians 5:22', 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith.', 'KJV', ARRAY['spirit','character']),
('1 Corinthians 13:4', 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.', 'KJV', ARRAY['love']),
('Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.', 'KJV', ARRAY['kingdom','priority']),
('Psalm 27:1', 'The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?', 'KJV', ARRAY['courage','light']),
('Hebrews 11:1', 'Now faith is the substance of things hoped for, the evidence of things not seen.', 'KJV', ARRAY['faith']),
('Lamentations 3:22', 'It is of the Lord''s mercies that we are not consumed, because his compassions fail not.', 'KJV', ARRAY['mercy']);
