begin;

-- Remove the old unique constraint that included mode
alter table public.spin_attempts drop constraint if exists spin_attempts_team_mode_idx;
drop index if exists spin_attempts_team_mode_idx;

-- Add a strict one-spin-total-per-team constraint
create unique index if not exists spin_attempts_team_idx on public.spin_attempts(shortlisted_team_id);

-- Update execute_spin RPC to remove the mode check from the duplication validation
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

    -- 2. Verify eligibility
    select id, payment_status into v_team_id, v_payment_status
    from public.shortlisted_teams
    where auth_id = v_auth_id;

    if not found then
        raise exception 'Team not found or not mapped to this user';
    end if;

    if v_payment_status != 'PAID' then
        raise exception 'Team payment status is not PAID. Eligibility failed.';
    end if;

    -- 3. Lock config
    select * into v_config
    from public.wheel_config
    where id = 1
    for update;

    if not found or not v_config.is_enabled then
        raise exception 'Wheel is currently disabled';
    end if;

    v_mode := v_config.current_mode;

    -- 4. Check one-spin STRICTLY per team (ignore mode)
    if exists (select 1 from public.spin_attempts where shortlisted_team_id = v_team_id) then
        raise exception 'Team has already spun';
    end if;

    -- 5. Determine prize availability for the CURRENT mode
    v_prize_1_taken := exists (select 1 from public.spin_attempts where mode = v_mode and result = 'PRIZE_1');
    v_prize_2_taken := exists (select 1 from public.spin_attempts where mode = v_mode and result = 'PRIZE_2');

    -- 6. Probability Calculation
    v_p1_prob := case when not v_prize_1_taken then 1.0 else 0.0 end;
    v_p2_prob := case when not v_prize_2_taken then 1.0 else 0.0 end;
    v_bla_prob := 29.0;
    v_blb_prob := 29.0;

    v_total_prob := v_p1_prob + v_p2_prob + v_bla_prob + v_blb_prob;

    v_rand := random() * v_total_prob;

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
