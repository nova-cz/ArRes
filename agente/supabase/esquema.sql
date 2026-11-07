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

-- Notas del equipo (panel)
alter table restaurantes add column if not exists notas_equipo text not null default '';
-- ArRES · sección "Agente": identidad, sobre el negocio, menú, preguntas y promociones.
-- Pégalo en Supabase → SQL Editor → Run (también va incluido en esquema.sql).

create table if not exists agente (
  restaurante_id uuid primary key references restaurantes(id) on delete cascade,
  nombre text not null default 'Sofi',
  voz text not null default 'aura-2-celeste-es',
  tono text not null default 'calido' check (tono in ('calido', 'formal')),
  saludo text not null default '',          -- vacío = saludo estándar
  sobre_negocio text not null default ''    -- historia, cocina, ambiente (máx. ~200 palabras)
);

create table if not exists platillos (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  categoria text not null default '',
  nombre text not null,
  descripcion text not null default '',
  precio numeric(10,2),
  vegetariano boolean not null default false,
  disponible boolean not null default true,
  orden int not null default 0
);

create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  pregunta text not null,
  respuesta text not null,
  orden int not null default 0
);

create table if not exists promociones (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  texto text not null,
  termina date   -- vacío = sin fecha de fin; después de esta fecha el agente ya no la menciona
);

-- Seguridad: cada restaurante solo ve y edita lo suyo.
do $$
declare t text;
begin
  foreach t in array array['agente', 'platillos', 'faqs', 'promociones'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "mi restaurante" on %I', t);
    execute format('create policy "mi restaurante" on %I for all using (es_miembro(restaurante_id)) with check (es_miembro(restaurante_id))', t);
  end loop;
end $$;

-- Datos de la demo (La Talavera).
insert into agente (restaurante_id, sobre_negocio)
select id, 'Cocina poblana tradicional en un ambiente familiar. Recetas de la abuela, mole hecho en casa y terraza pet friendly.'
from restaurantes where id = '00000000-0000-0000-0000-000000000001'
on conflict (restaurante_id) do nothing;

insert into platillos (restaurante_id, categoria, nombre, precio, vegetariano, orden)
select '00000000-0000-0000-0000-000000000001', c, n, p, v, o from (values
  ('Platos fuertes', 'Mole poblano', 245, false, 1),
  ('Platos fuertes', 'Pipián verde', 230, false, 2),
  ('Platos fuertes', 'Chiles rellenos de queso', 190, true, 3),
  ('Antojitos', 'Cemita de milanesa', 165, false, 4),
  ('Antojitos', 'Chalupas', 120, false, 5),
  ('Antojitos', 'Tacos árabes', 150, false, 6),
  ('Entradas', 'Ensalada de nopales', 110, true, 7)
) as m(c, n, p, v, o)
where not exists (select 1 from platillos where restaurante_id = '00000000-0000-0000-0000-000000000001');

insert into faqs (restaurante_id, pregunta, respuesta, orden)
select '00000000-0000-0000-0000-000000000001', q, a, o from (values
  ('¿Hay estacionamiento?', 'Sí, con valet parking por $50.', 1),
  ('¿Puedo llevar a mi mascota?', 'Sí, en la terraza pet friendly.', 2),
  ('¿Tienen área para niños?', 'Sí, tenemos área para niños.', 3)
) as f(q, a, o)
where not exists (select 1 from faqs where restaurante_id = '00000000-0000-0000-0000-000000000001');

-- El texto libre de la demo ya quedó repartido en menú y preguntas.
update restaurantes set info = '' where id = '00000000-0000-0000-0000-000000000001';
-- ArRES · invitar al equipo y registro de restaurantes nuevos.
-- Pégalo en Supabase → SQL Editor → Run (también va en esquema.sql).

create table if not exists invitaciones (
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  email text not null,
  creado_en timestamptz not null default now(),
  primary key (restaurante_id, email)
);
alter table invitaciones enable row level security;
drop policy if exists "mi restaurante" on invitaciones;
create policy "mi restaurante" on invitaciones for all
  using (es_miembro(restaurante_id)) with check (es_miembro(restaurante_id));

create or replace function es_dueno(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where user_id = auth.uid() and restaurante_id = rid and rol = 'dueno')
$$;

-- El dueño puede quitar a alguien del equipo (pero no a sí mismo).
drop policy if exists "dueño quita miembros" on miembros;
create policy "dueño quita miembros" on miembros for delete
  using (es_dueno(restaurante_id) and user_id <> auth.uid());

-- Al entrar por primera vez, si alguien lo invitó con su correo, se le da acceso.
create or replace function aceptar_invitaciones() returns int
language plpgsql security definer set search_path = public as $$
declare correo text := lower(auth.jwt() ->> 'email'); n int;
begin
  insert into miembros (user_id, restaurante_id, rol)
  select auth.uid(), restaurante_id, 'equipo' from invitaciones where lower(email) = correo
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from invitaciones where lower(email) = correo;
  return n;
end $$;

-- Un dueño nuevo crea su restaurante con reglas y agente por defecto.
create or replace function crear_restaurante(nombre_restaurante text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from miembros where user_id = auth.uid()) then
    raise exception 'Ya tienes un restaurante';
  end if;
  insert into restaurantes (nombre) values (trim(nombre_restaurante)) returning id into rid;
  insert into reglas (restaurante_id, horario) values (rid,
    '{"0": [], "1": [["13:00","23:00"]], "2": [["13:00","23:00"]], "3": [["13:00","23:00"]],
      "4": [["13:00","23:00"]], "5": [["13:00","23:00"]], "6": [["13:00","19:00"]]}');
  insert into agente (restaurante_id) values (rid);
  insert into miembros (user_id, restaurante_id, rol) values (auth.uid(), rid, 'dueno');
  return rid;
end $$;

-- Correos del equipo (auth.users no se puede leer desde el navegador).
create or replace function equipo(rid uuid)
returns table (user_id uuid, email text, rol text)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.rol from miembros m join auth.users u on u.id = m.user_id
  where m.restaurante_id = rid and es_miembro(rid)
$$;

-- Ver a los compañeros de equipo (antes cada quien solo veía su propia fila).
drop policy if exists "ver mis membresías" on miembros;
create policy "ver mis membresías" on miembros for select using (es_miembro(restaurante_id));
