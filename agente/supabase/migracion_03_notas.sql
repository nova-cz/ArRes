-- ArRES · notas del equipo en el panel. Pégalo en Supabase → SQL Editor → Run.
alter table restaurantes add column if not exists notas_equipo text not null default '';
