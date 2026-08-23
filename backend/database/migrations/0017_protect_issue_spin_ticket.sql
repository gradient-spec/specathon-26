begin;

revoke execute on function public.issue_spin_ticket() from public;
revoke execute on function public.issue_spin_ticket() from anon;
revoke execute on function public.issue_spin_ticket() from authenticated;

grant execute on function public.issue_spin_ticket() to service_role;

commit;
