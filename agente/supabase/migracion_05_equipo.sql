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
