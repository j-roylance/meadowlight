-- Players may host any number of active projects and complete each type many times.
drop index if exists public.hosted_projects_one_active;
drop index if exists public.hosted_projects_one_complete_type;
