-- SPECATHON 2026 – Phase 4: Spin Wheel Foundation
-- Schema for atomic, concurrency-safe, probability-based spin wheel.

begin;

create table if not exists public.wheel_config (
    id integer primary key default 1 constraint wheel_config_id_check check (id = 1),
    is_enabled boolean not null default false,
    current_mode text not null constraint wheel_config_mode_check check (current_mode in ('TEST', 'LIVE')) default 'TEST',
    prize_1_name text not null default 'Mouse and keyboard',
    prize_2_name text not null default 'Laptop stand'
);

-- Ensure there is exactly one row
insert into public.wheel_config (id, is_enabled, current_mode, prize_1_name, prize_2_name)
values (1, false, 'TEST', 'Mouse and keyboard', 'Laptop stand')
on conflict (id) do nothing;

create table if not exists public.spin_attempts (
    id uuid primary key default gen_random_uuid(),
    shortlisted_team_id uuid not null references public.shortlisted_teams(id),
    auth_id uuid not null references auth.users(id),
    mode text not null constraint spin_attempts_mode_check check (mode in ('TEST', 'LIVE')),
    result text not null constraint spin_attempts_result_check check (result in ('PRIZE_1', 'PRIZE_2', 'BETTER_LUCK_A', 'BETTER_LUCK_B')),
    created_at timestamptz not null default now()
);

-- One successful spin per team per mode
create unique index if not exists spin_attempts_team_mode_idx on public.spin_attempts(shortlisted_team_id, mode);

-- One PRIZE_1 winner per mode
create unique index if not exists spin_attempts_prize_1_mode_idx on public.spin_attempts(mode) where result = 'PRIZE_1';

-- One PRIZE_2 winner per mode
create unique index if not exists spin_attempts_prize_2_mode_idx on public.spin_attempts(mode) where result = 'PRIZE_2';

-- RLS Enablement
alter table public.wheel_config enable row level security;
alter table public.spin_attempts enable row level security;

-- wheel_config policies:
create policy "authenticated_read_wheel_config" on public.wheel_config for select to authenticated using (true);
create policy "admins_all_wheel_config" on public.wheel_config for all using (is_admin());

-- spin_attempts policies:
create policy "teams_view_own_spin" on public.spin_attempts for select using (auth.uid() = auth_id);
create policy "admins_all_spin_attempts" on public.spin_attempts for all using (is_admin());

-- Atomic spin execution RPC
create or replace function public.execute_spin()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_team_id uuid;
    v_auth_id uuid;
    v_payment_status text;
    v_config public.wheel_config%rowtype;
    v_mode text;
    v_prize_1_taken boolean;
    v_prize_2_taken boolean;
    v_result text;
    v_rand numeric;
    v_p1_prob numeric;
    v_p2_prob numeric;
    v_bla_prob numeric;
    v_blb_prob numeric;
    v_total_prob numeric;
    v_return_data jsonb;
begin
    -- 1. Get authenticated user
    v_auth_id := auth.uid();
    if v_auth_id is null then
        raise exception 'Not authenticated';
    end if;

    -- 2. Verify eligibility (shortlisted_teams, payment_status = PAID)
    select id, payment_status into v_team_id, v_payment_status
    from public.shortlisted_teams
    where auth_id = v_auth_id;

    if not found then
        raise exception 'Team not found or not mapped to this user';
    end if;

    if v_payment_status != 'PAID' then
        raise exception 'Team payment status is not PAID. Eligibility failed.';
    end if;

    -- 3. Lock config to serialize spin execution and ensure stable mode/prize checks
    select * into v_config
    from public.wheel_config
    where id = 1
    for update; -- This lock serializes all spin attempts to handle concurrency safely

    if not found or not v_config.is_enabled then
        raise exception 'Wheel is currently disabled';
    end if;

    v_mode := v_config.current_mode;

    -- 4. Check one-spin per team per mode
    if exists (select 1 from public.spin_attempts where shortlisted_team_id = v_team_id and mode = v_mode) then
        raise exception 'Team has already spun in this mode';
    end if;

    -- 5. Determine prize availability
    v_prize_1_taken := exists (select 1 from public.spin_attempts where mode = v_mode and result = 'PRIZE_1');
    v_prize_2_taken := exists (select 1 from public.spin_attempts where mode = v_mode and result = 'PRIZE_2');

    -- 6. Probability Calculation
    -- Initial: 60 total. P1=1, P2=1, BLA=29, BLB=29
    v_p1_prob := case when not v_prize_1_taken then 1.0 else 0.0 end;
    v_p2_prob := case when not v_prize_2_taken then 1.0 else 0.0 end;
    v_bla_prob := 29.0;
    v_blb_prob := 29.0;

    v_total_prob := v_p1_prob + v_p2_prob + v_bla_prob + v_blb_prob;

    -- Generate random
    v_rand := random() * v_total_prob;

    -- Select outcome
    if v_rand < v_p1_prob then
        v_result := 'PRIZE_1';
    elsif v_rand < (v_p1_prob + v_p2_prob) then
        v_result := 'PRIZE_2';
    elsif v_rand < (v_p1_prob + v_p2_prob + v_bla_prob) then
        v_result := 'BETTER_LUCK_A';
    else
        v_result := 'BETTER_LUCK_B';
    end if;

    -- 7. Record spin
    insert into public.spin_attempts (shortlisted_team_id, auth_id, mode, result)
    values (v_team_id, v_auth_id, v_mode, v_result);

    -- 8. Return result
    v_return_data := jsonb_build_object(
        'result', v_result,
        'mode', v_mode
    );

    return v_return_data;
end;
$$;

commit;
