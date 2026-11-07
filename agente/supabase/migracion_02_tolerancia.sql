-- ArRES · cambios del 5 nov 2026: confirmación en la llamada, tolerancia e inasistencias.
-- Solo si ya habías corrido esquema.sql antes. Pégalo en Supabase → SQL Editor → Run.

-- Confirmar en la misma llamada reservas de hasta 8 personas.
alter table reglas alter column auto_aprobar_hasta set default 8;
update reglas set auto_aprobar_hasta = 8;

-- Tolerancia y número de faltas permitidas.
alter table reglas add column if not exists tolerancia_min int not null default 15
  check (tolerancia_min between 0 and 60);
alter table reglas add column if not exists max_faltas int not null default 2
  check (max_faltas > 0);

-- Nuevos estados: llegó / no llegó.
alter table reservas drop constraint if exists reservas_estado_check;
alter table reservas add constraint reservas_estado_check
  check (estado in ('pendiente', 'escalada', 'confirmada', 'rechazada', 'cancelada',
                    'llego', 'no_llego'));

create index if not exists reservas_por_telefono on reservas (restaurante_id, telefono, estado);
