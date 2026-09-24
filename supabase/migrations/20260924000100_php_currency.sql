-- 3rdLoop operates in the Philippines: every amount is in Philippine pesos.
update public.deals set currency = 'PHP' where currency <> 'PHP';
update public.transactions set currency = 'PHP' where currency <> 'PHP';
alter table public.deals alter column currency set default 'PHP';
alter table public.transactions alter column currency set default 'PHP';
