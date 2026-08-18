begin;

-- Find TEST-001 user
do $$
declare
    v_auth_id uuid;
    v_result jsonb;
begin
    select auth_id into v_auth_id from public.shortlisted_teams where team_id = 'TEST-001';
    
    if v_auth_id is null then
        raise notice 'TEST-001 has no auth_id yet.';
        return;
    end if;

    -- Simulate authenticated session
    perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', v_auth_id), true);
    perform set_config('role', 'authenticated', true);

    -- Try to spin
    begin
        v_result := public.execute_spin();
        raise notice 'Spin succeeded! Result: %', v_result;
    exception when others then
        raise notice 'Spin failed as expected: %', sqlerrm;
    end;
end;
$$;

rollback;
