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

-- El texto libre de la demo ya quedó repartido en menú y preguntas: se limpia para no repetirlo.
update restaurantes set info = '' where id = '00000000-0000-0000-0000-000000000001';
