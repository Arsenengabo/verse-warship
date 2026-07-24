CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_group_member(_group uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

REVOKE ALL ON FUNCTION private.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_group_member(uuid, uuid) TO authenticated;

-- Recreate policies to reference the private-schema function
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups" ON public.groups
  FOR SELECT TO authenticated
  USING (private.is_group_member(id, auth.uid()) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Members can view group membership" ON public.group_members;
CREATE POLICY "Members can view group membership" ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view events for their groups" ON public.events;
CREATE POLICY "Members can view events for their groups" ON public.events
  FOR SELECT TO authenticated
  USING (group_id IS NULL OR private.is_group_member(group_id, auth.uid()) OR created_by = auth.uid());

DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);