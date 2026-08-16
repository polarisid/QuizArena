-- ============================================================================
-- Row Level Security — isolamento multi-tenant + acesso público controlado
--
-- Regra geral:
--  * Conteúdo (quizzes/questions) e gestão: isolado por organização.
--  * Jogo ao vivo: leitura pública (jogadores são anônimos), mas TODA escrita
--    de jogador passa pelas RPCs SECURITY DEFINER (join_game/submit_answer),
--    então não há policy de escrita direta em game_players/game_answers.
-- ============================================================================

-- Helpers ------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members
     where org_id = p_org and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members
     where org_id = p_org and user_id = auth.uid()
       and status = 'active' and role in ('owner','admin')
  );
$$;

-- Enable RLS ----------------------------------------------------------------
alter table public.organizations   enable row level security;
alter table public.profiles         enable row level security;
alter table public.org_members      enable row level security;
alter table public.quizzes          enable row level security;
alter table public.questions        enable row level security;
alter table public.game_sessions    enable row level security;
alter table public.game_players     enable row level security;
alter table public.game_answers     enable row level security;
alter table public.challenge_results enable row level security;

-- organizations -------------------------------------------------------------
create policy org_read on public.organizations
  for select to authenticated using (is_org_member(id));
create policy org_update on public.organizations
  for update to authenticated using (is_org_admin(id));

-- profiles ------------------------------------------------------------------
create policy profile_self_read on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profile_self_update on public.profiles
  for update to authenticated using (id = auth.uid());

-- org_members ---------------------------------------------------------------
create policy members_read on public.org_members
  for select to authenticated using (is_org_member(org_id));
create policy members_admin_write on public.org_members
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- quizzes -------------------------------------------------------------------
-- leitura: membro da org OU publicado como desafio assíncrono (público)
create policy quizzes_read on public.quizzes
  for select to anon, authenticated
  using (is_published_as_challenge or is_org_member(org_id));
create policy quizzes_write on public.quizzes
  for all to authenticated
  using (is_org_member(org_id)) with check (is_org_member(org_id));

-- questions -----------------------------------------------------------------
create policy questions_read on public.questions
  for select to anon, authenticated
  using (exists (
    select 1 from quizzes q where q.id = quiz_id
      and (q.is_published_as_challenge or is_org_member(q.org_id))
  ));
create policy questions_write on public.questions
  for all to authenticated
  using (exists (select 1 from quizzes q where q.id = quiz_id and is_org_member(q.org_id)))
  with check (exists (select 1 from quizzes q where q.id = quiz_id and is_org_member(q.org_id)));

-- game_sessions -------------------------------------------------------------
-- leitura pública (jogador entra pelo PIN, sem login)
create policy sessions_read on public.game_sessions
  for select to anon, authenticated using (true);
-- só o host controla a partida (avançar questão, encerrar)
create policy sessions_host_update on public.game_sessions
  for update to authenticated using (host_id = auth.uid());
create policy sessions_host_delete on public.game_sessions
  for delete to authenticated using (host_id = auth.uid());
-- INSERT é feito via create_game_session() (SECURITY DEFINER)

-- game_players --------------------------------------------------------------
-- leitura pública (placar ao vivo). Escrita só via join_game()/submit_answer().
create policy players_read on public.game_players
  for select to anon, authenticated using (true);

-- game_answers --------------------------------------------------------------
-- só o host da sala lê (analytics). Escrita só via submit_answer().
create policy answers_host_read on public.game_answers
  for select to authenticated
  using (exists (select 1 from game_sessions s where s.id = session_id and s.host_id = auth.uid()));

-- challenge_results ---------------------------------------------------------
create policy challenge_read on public.challenge_results
  for select to anon, authenticated using (true);
create policy challenge_insert on public.challenge_results
  for insert to anon, authenticated with check (true);
create policy challenge_admin_write on public.challenge_results
  for all to authenticated
  using (exists (select 1 from quizzes q where q.id = quiz_id and is_org_admin(q.org_id)));

-- ============================================================================
-- Realtime — publica as tabelas do jogo ao vivo para o canal do Supabase
-- ============================================================================
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.game_players;
