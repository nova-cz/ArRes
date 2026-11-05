-- ArRES · esquema de la base de datos en Supabase
-- Pégalo completo en Supabase → SQL Editor → Run.
--
-- Esta es la "fuente única de verdad" que comparten:
--   * el agente (llamadas y WhatsApp), que usa la llave de servicio, y
--   * el panel web, que entra con usuarios de Supabase Auth y solo ve su restaurante.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists restaurantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  zona_horaria text not null default 'America/Mexico_City',
  direccion text not null default '',
  -- Número de Twilio al que el restaurante desvía sus llamadas, formato +52XXXXXXXXXX
  telefono_agente text unique,
  -- "Phone number ID" de WhatsApp Cloud API (Meta → WhatsApp → API Setup)
  whatsapp_phone_number_id text unique,
  -- Menú, precios, estacionamiento, FAQs. El agente solo dice lo que esté aquí.
  info text not null default '',
  creado_en timestamptz not null default now()
);

create table if not exists reglas (
  restaurante_id uuid primary key references restaurantes(id) on delete cascade,
  -- Turnos por día. 0 = lunes ... 6 = domingo. Día sin turnos = cerrado.
  -- Ejemplo: {"0": [], "1": [["13:00","23:00"]], "5": [["09:00","12:00"],["13:00","23:00"]]}
  horario jsonb not null,
  duracion_min int not null default 90 check (duracion_min between 15 and 600),
  intervalo_min int not null default 30 check (intervalo_min between 5 and 120),
  cupo_personas int not null default 60 check (cupo_personas > 0),
  max_personas int not null default 8 check (max_personas > 0),
  anticipacion_min int not null default 60 check (anticipacion_min >= 0),
  dias_max_adelanto int not null default 30 check (dias_max_adelanto > 0),
  -- Reservas de hasta este número de personas se confirman en la misma llamada.
  -- 0 = modo supervisado: todo espera a que el equipo apruebe.
  auto_aprobar_hasta int not null default 8 check (auto_aprobar_hasta >= 0),
  -- El panel marca en rojo lo que lleve más de estos minutos sin aprobar.
  minutos_alerta int not null default 10 check (minutos_alerta > 0),
  -- Minutos que se espera al cliente; después el equipo puede marcar "no llegó".
  tolerancia_min int not null default 15 check (tolerancia_min between 0 and 60),
  -- Con estas inasistencias (estado no_llego), sus reservas ya no se confirman solas.
  max_faltas int not null default 2 check (max_faltas > 0),
  actualizado_en timestamptz not null default now()
);

create table if not exists reservas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  nombre text not null,
  telefono text not null default '',          -- +52XXXXXXXXXX
  personas int not null default 0 check (personas >= 0),
  inicio timestamptz,                          -- vacío solo en casos escalados sin fecha
  fin timestamptz,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'escalada', 'confirmada', 'rechazada', 'cancelada',
                      'llego', 'no_llego')),
  canal text not null default 'llamada' check (canal in ('llamada', 'whatsapp', 'web', 'panel')),
  notas text not null default '',
  motivo_escalada text not null default '',    -- por qué necesita a una persona
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  notificado_en timestamptz                    -- cuándo se avisó al cliente por WhatsApp
);
create index if not exists reservas_por_fecha on reservas (restaurante_id, inicio);
create index if not exists reservas_por_estado on reservas (restaurante_id, estado);
create index if not exists reservas_por_telefono on reservas (restaurante_id, telefono, estado);

create table if not exists mensajes (
  id bigint generated always as identity primary key,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  telefono text not null,
  canal text not null check (canal in ('llamada', 'whatsapp')),
  rol text not null check (rol in ('cliente', 'agente', 'sistema')),
  texto text not null,
  creado_en timestamptz not null default now()
);
create index if not exists mensajes_por_cliente on mensajes (restaurante_id, telefono, canal, creado_en desc);

-- Quién del equipo puede ver cada restaurante en el panel.
create table if not exists miembros (
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  rol text not null default 'equipo' check (rol in ('dueno', 'equipo')),
  primary key (user_id, restaurante_id)
);

create or replace function tocar_actualizado_en() returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end $$;

drop trigger if exists reservas_actualizado on reservas;
create trigger reservas_actualizado before update on reservas
  for each row execute function tocar_actualizado_en();
drop trigger if exists reglas_actualizado on reglas;
create trigger reglas_actualizado before update on reglas
  for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- Seguridad (RLS): el panel solo ve los restaurantes donde el usuario es miembro.
-- El agente usa la llave de servicio, que no pasa por estas reglas.
-- ---------------------------------------------------------------------------

alter table restaurantes enable row level security;
alter table reglas enable row level security;
alter table reservas enable row level security;
alter table mensajes enable row level security;
alter table miembros enable row level security;

create or replace function es_miembro(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where user_id = auth.uid() and restaurante_id = rid)
$$;

drop policy if exists "ver mi restaurante" on restaurantes;
create policy "ver mi restaurante" on restaurantes for select using (es_miembro(id));
drop policy if exists "editar mi restaurante" on restaurantes;
create policy "editar mi restaurante" on restaurantes for update using (es_miembro(id));

drop policy if exists "ver mis reglas" on reglas;
create policy "ver mis reglas" on reglas for select using (es_miembro(restaurante_id));
drop policy if exists "editar mis reglas" on reglas;
create policy "editar mis reglas" on reglas for update using (es_miembro(restaurante_id));

drop policy if exists "ver mis reservas" on reservas;
create policy "ver mis reservas" on reservas for select using (es_miembro(restaurante_id));
drop policy if exists "decidir mis reservas" on reservas;
create policy "decidir mis reservas" on reservas for update using (es_miembro(restaurante_id));
drop policy if exists "crear reservas desde el panel" on reservas;
create policy "crear reservas desde el panel" on reservas for insert
  with check (es_miembro(restaurante_id));

drop policy if exists "ver mis mensajes" on mensajes;
create policy "ver mis mensajes" on mensajes for select using (es_miembro(restaurante_id));

drop policy if exists "ver mis membresías" on miembros;
create policy "ver mis membresías" on miembros for select using (user_id = auth.uid());

-- El panel recibe cambios en vivo (nueva reserva = aparece sin recargar).
do $$ begin
  alter publication supabase_realtime add table reservas;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Restaurante de demo
-- ---------------------------------------------------------------------------

insert into restaurantes (id, nombre, direccion, info)
values (
  '00000000-0000-0000-0000-000000000001',
  'La Talavera',
  'Av. Juárez 2915, colonia La Paz, Puebla.',
  'Restaurante ficticio para la demo de ArRES. Cocina poblana: mole poblano ($245), '
  'cemita de milanesa ($165), chalupas ($120), pipián verde ($230), tacos árabes ($150). '
  'Vegetariano: chiles rellenos de queso ($190), ensalada de nopales ($110). '
  'Valet parking ($50). Área para niños y terraza pet friendly. Tolerancia de 15 minutos.'
)
on conflict (id) do nothing;

insert into reglas (restaurante_id, horario)
values (
  '00000000-0000-0000-0000-000000000001',
  '{"0": [], "1": [["13:00","23:00"]], "2": [["13:00","23:00"]], "3": [["13:00","23:00"]],
    "4": [["13:00","23:00"]], "5": [["13:00","23:00"]], "6": [["13:00","19:00"]]}'
)
on conflict (restaurante_id) do nothing;
