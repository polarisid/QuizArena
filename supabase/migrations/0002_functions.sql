-- ============================================================================
-- Funções RPC — lógica do jogo executada no servidor (autoritativa)
--
-- Por que no servidor?
--  * Anti-cheat: o cliente não decide mais quantos pontos ganhou.
--  * Idempotência: reenvio após reconexão não pontua duas vezes.
--  * Tempo confiável: os pontos por velocidade usam o relógio do servidor.
-- Jogadores são anônimos (sem login); por isso as funções são SECURITY DEFINER
-- e validam tudo pelo PIN, sem depender de auth.uid().
-- ============================================================================

-- Entra na sala (idempotente). Retorna o id do jogador.
create or replace function public.join_game(p_pin text, p_nickname text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_session uuid;
  v_player  uuid;
  v_nick    text := trim(p_nickname);
begin
  if v_nick = '' then
    raise exception 'nickname vazio';
  end if;

  select id into v_session from game_sessions where pin = p_pin;
  if v_session is null then
    raise exception 'sala não encontrada';
  end if;

  insert into game_players (session_id, nickname)
  values (v_session, v_nick)
  on conflict (session_id, nickname) do update set nickname = excluded.nickname
  returning id into v_player;

  return v_player;
end;
$$;

-- Registra uma resposta e pontua no servidor. Idempotente por (player, questão).
-- Retorna a linha inserida/existente (is_correct, points).
create or replace function public.submit_answer(
  p_pin            text,
  p_nickname       text,
  p_question_index int,
  p_chosen_index   int
)
returns table (is_correct boolean, points int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_session   game_sessions%rowtype;
  v_player    uuid;
  v_question  questions%rowtype;
  v_quiz_settings jsonb;
  v_elapsed   numeric;
  v_remaining numeric;
  v_ratio     numeric;
  v_correct   boolean;
  v_points    int;
  v_decrease  boolean;
begin
  select * into v_session from game_sessions where pin = p_pin;
  if v_session.id is null then
    raise exception 'sala não encontrada';
  end if;

  -- Só aceita resposta da questão atual e enquanto a rodada está aberta
  if v_session.status <> 'question' or v_session.current_question_index <> p_question_index then
    raise exception 'rodada não está aberta para esta questão';
  end if;

  select id into v_player from game_players
   where session_id = v_session.id and nickname = trim(p_nickname);
  if v_player is null then
    v_player := join_game(p_pin, p_nickname);
  end if;

  select q.* into v_question from questions q
   where q.quiz_id = v_session.quiz_id and q.position = p_question_index;
  if v_question.id is null then
    raise exception 'questão não encontrada';
  end if;

  select settings into v_quiz_settings from quizzes where id = v_session.quiz_id;
  v_decrease := coalesce((v_quiz_settings->>'decreasePointsOverTime')::boolean, true);

  -- Tempo decorrido pelo relógio do servidor
  v_elapsed   := extract(epoch from (now() - v_session.question_started_at));
  v_remaining := greatest(0, v_question.time_limit_seconds - v_elapsed);
  v_correct   := (p_chosen_index = v_question.correct_index);

  if not v_correct then
    v_points := 0;
  elsif not v_decrease then
    v_points := v_question.base_points;
  else
    v_ratio  := v_remaining / nullif(v_question.time_limit_seconds, 0);
    v_points := round(v_question.base_points * (0.5 + 0.5 * coalesce(v_ratio, 0)));
  end if;

  -- Idempotente: se já respondeu esta questão, não pontua de novo
  insert into game_answers (session_id, player_id, question_index, chosen_index, is_correct, points)
  values (v_session.id, v_player, p_question_index, p_chosen_index, v_correct, v_points)
  on conflict (player_id, question_index) do nothing;

  if not found then
    -- já existia: retorna o que foi registrado antes, sem re-somar
    return query
      select ga.is_correct, ga.points from game_answers ga
       where ga.player_id = v_player and ga.question_index = p_question_index;
    return;
  end if;

  update game_players set score = score + v_points where id = v_player;

  return query select v_correct, v_points;
end;
$$;

-- Cria uma sala com PIN único de 6 dígitos. Retorna o PIN.
create or replace function public.create_game_session(p_quiz_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_org  uuid;
  v_pin  text;
  v_try  int := 0;
begin
  select org_id into v_org from quizzes where id = p_quiz_id;
  if v_org is null then
    raise exception 'quiz não encontrado';
  end if;
  -- host precisa ser membro ativo da org do quiz
  if not exists (
    select 1 from org_members m
     where m.org_id = v_org and m.user_id = auth.uid() and m.status = 'active'
  ) then
    raise exception 'sem permissão para iniciar este quiz';
  end if;

  loop
    v_pin := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from game_sessions where pin = v_pin);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'falha ao gerar PIN'; end if;
  end loop;

  insert into game_sessions (pin, quiz_id, org_id, host_id)
  values (v_pin, p_quiz_id, v_org, auth.uid());

  return v_pin;
end;
$$;
