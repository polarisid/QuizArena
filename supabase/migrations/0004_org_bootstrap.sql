-- ============================================================================
-- Bootstrap de organização (onboarding self-serve)
--
-- No primeiro acesso, o host ganha automaticamente seu próprio workspace como
-- 'owner' ativo. Idempotente: se já tem uma org como owner, apenas a retorna.
-- SECURITY DEFINER porque um usuário recém-criado ainda não tem permissão de
-- RLS para inserir em organizations/org_members.
-- ============================================================================

create or replace function public.get_or_create_personal_org(p_name text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_name  text;
  v_slug  text;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  -- Já é owner de alguma org? Retorna a primeira.
  select m.org_id into v_org
    from org_members m
   where m.user_id = v_uid and m.role = 'owner'
   order by m.created_at
   limit 1;
  if v_org is not null then
    return v_org;
  end if;

  v_name := coalesce(nullif(trim(p_name), ''),
                     nullif(trim((select full_name from profiles where id = v_uid)), ''),
                     'Meu Workspace');

  -- slug único a partir do nome
  v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'org'; end if;
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org;

  insert into org_members (org_id, user_id, role, status)
  values (v_org, v_uid, 'owner', 'active');

  return v_org;
end;
$$;
