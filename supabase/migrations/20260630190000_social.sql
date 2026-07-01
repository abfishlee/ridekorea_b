-- 20260630190000_social.sql
-- Publish/unpublish a route, and add a comment (owner/visibility-checked).
-- comments_count is maintained by the existing bump_counts trigger.

-- 1. publish_route: flip a route's visibility (owner only). Returns the route.
create or replace function public.publish_route(p_route uuid, p_public boolean default true)
returns public.routes language plpgsql security definer set search_path = public as $$
declare v_route public.routes;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  update routes
     set visibility = case when p_public then 'PUBLIC'::route_visibility
                           else 'PRIVATE'::route_visibility end
   where id = p_route and author_id = auth.uid()
  returning * into v_route;
  if v_route.id is null then raise exception 'NOT_OWNER'; end if;
  return v_route;
end; $$;

grant execute on function public.publish_route(uuid, boolean) to authenticated;

-- 2. add_comment: post a comment on a visible route as the caller.
create or replace function public.add_comment(p_route uuid, p_body text)
returns public.comments language plpgsql security definer set search_path = public as $$
declare v_comment public.comments;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if char_length(coalesce(p_body, '')) not between 1 and 2000 then
    raise exception 'INVALID_BODY';
  end if;
  if not exists (
    select 1 from routes r
     where r.id = p_route and (r.visibility = 'PUBLIC' or r.author_id = auth.uid())
  ) then
    raise exception 'ROUTE_NOT_VISIBLE';
  end if;

  insert into comments (route_id, user_id, body)
  values (p_route, auth.uid(), p_body)
  returning * into v_comment;
  return v_comment;
end; $$;

grant execute on function public.add_comment(uuid, text) to authenticated;
