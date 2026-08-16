-- ============================================================================
-- QuizArena — Schema inicial (Supabase / Postgres)
-- Fundação multi-tenant para SaaS. Substitui o modelo Firestore.
--
-- Princípios de design:
--  * Multi-tenant: tudo pertence a uma `organization` (workspace).
--  * Escala do jogo ao vivo: UMA LINHA POR JOGADOR e UMA POR RESPOSTA
--    (elimina o hotspot de escrita do documento único do Firestore).
--  * Scoring é feito no servidor (ver 0003_functions.sql) — anti-cheat.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ tenancy --
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  plan       text not null default 'free',   -- free | pro | business
  created_at timestamptz not null default now()
);

-- Perfil 1:1 com auth.users (criado por trigger no signup)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Um usuário pode pertencer a várias organizações
create table public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member',   -- owner | admin | member
  status     text not null default 'active',   -- active | pending | suspended
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members(user_id);

-- ------------------------------------------------------------------ content --
create table public.quizzes (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  created_by                uuid references public.profiles(id) on delete set null,
  title                     text not null,
  description               text,
  -- flags de comportamento (showImmediateFeedback, decreasePointsOverTime, ...)
  settings                  jsonb not null default '{}'::jsonb,
  is_published_as_challenge boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index quizzes_org_idx on public.quizzes(org_id);

create table public.questions (
  id                  uuid primary key default gen_random_uuid(),
  quiz_id             uuid not null references public.quizzes(id) on delete cascade,
  position            int  not null,
  prompt              text not null,
  alternatives        jsonb not null,             -- ["A","B","C","D"]
  correct_index       int  not null,
  time_limit_seconds  int  not null default 20,
  base_points         int  not null default 1000,
  image_url           text
);
create index questions_quiz_idx on public.questions(quiz_id, position);

-- --------------------------------------------------------------- live game --
create table public.game_sessions (
  id                    uuid primary key default gen_random_uuid(),
  pin                   text unique not null,      -- código de entrada
  quiz_id               uuid not null references public.quizzes(id) on delete cascade,
  org_id                uuid not null references public.organizations(id) on delete cascade,
  host_id               uuid references public.profiles(id) on delete set null,
  status                text not null default 'waiting',  -- waiting|question|results|podium|finished
  current_question_index int not null default 0,
  question_started_at   timestamptz,
  created_at            timestamptz not null default now(),
  ended_at              timestamptz
);
create index game_sessions_pin_idx on public.game_sessions(pin);

-- UMA LINHA POR JOGADOR → sem gargalo de escrita quando há muita gente
create table public.game_players (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  nickname   text not null,
  score      int  not null default 0,
  joined_at  timestamptz not null default now(),
  unique (session_id, nickname)
);
create index game_players_session_idx on public.game_players(session_id);

-- UMA LINHA POR RESPOSTA → analytics + scoring idempotente (impede pontuar 2x)
create table public.game_answers (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.game_sessions(id) on delete cascade,
  player_id      uuid not null references public.game_players(id) on delete cascade,
  question_index int  not null,
  chosen_index   int,                       -- null = tempo esgotado
  is_correct     boolean not null default false,
  points         int  not null default 0,
  answered_at    timestamptz not null default now(),
  unique (player_id, question_index)        -- não deixa responder a mesma questão 2x
);
create index game_answers_session_q_idx on public.game_answers(session_id, question_index);

-- ---------------------------------------------------------- async challenge --
create table public.challenge_results (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  nickname       text not null,
  score          int  not null default 0,
  correct_answers int not null default 0,
  total_time_ms  int  not null default 0,
  created_at     timestamptz not null default now()
);
create index challenge_results_quiz_idx on public.challenge_results(quiz_id, score desc);

-- --------------------------------------------------------- profile trigger --
-- Cria automaticamente um profile quando um usuário se registra no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
