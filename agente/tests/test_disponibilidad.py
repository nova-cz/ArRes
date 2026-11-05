from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from arres.disponibilidad import horarios_del_dia, ocupacion_maxima, revisar
from arres.modelos import CANCELADA, PENDIENTE, Reglas, Reserva

MX = ZoneInfo("America/Mexico_City")
SEMANA = [("13:00", "23:00")]
REGLAS = Reglas(horario={0: [], 1: SEMANA, 2: SEMANA, 3: SEMANA, 4: SEMANA, 5: SEMANA,
                         6: [("13:00", "19:00")]}, cupo_personas=10, max_personas=8)
# Miércoles 4 de noviembre de 2026 al mediodía
AHORA = datetime(2026, 11, 4, 12, 0, tzinfo=MX)
VIERNES_9PM = datetime(2026, 11, 6, 21, 0, tzinfo=MX)


def reserva(inicio, personas, estado=PENDIENTE):
    return Reserva("demo", "X", "+520000000000", personas, inicio,
                   inicio + timedelta(minutes=90), estado)


def test_hay_lugar():
    r = revisar(REGLAS, [], VIERNES_9PM, 4, AHORA)
    assert r.disponible and r.motivo == "ok"


def test_grupo_grande_no_tiene_alternativas():
    r = revisar(REGLAS, [], VIERNES_9PM, 12, AHORA)
    assert not r.disponible and r.motivo == "grupo_grande" and r.alternativas == []


def test_muy_pronto():
    r = revisar(REGLAS, [], AHORA + timedelta(minutes=30), 2, AHORA)
    assert r.motivo == "muy_pronto"
    assert r.alternativas and all(a >= AHORA + timedelta(minutes=60) for a in r.alternativas)


def test_lunes_cerrado_ofrece_martes():
    lunes = datetime(2026, 11, 9, 20, 0, tzinfo=MX)
    r = revisar(REGLAS, [], lunes, 2, AHORA)
    assert r.motivo == "cerrado"
    assert r.alternativas and all(a.weekday() == 1 for a in r.alternativas)


def test_ultima_mesa_debe_liberarse_antes_del_cierre():
    # Cierra a las 23:00 y la mesa dura 90 min: la última llegada es 21:30.
    assert revisar(REGLAS, [], VIERNES_9PM.replace(hour=21, minute=30), 2, AHORA).disponible
    assert revisar(REGLAS, [], VIERNES_9PM.replace(hour=22), 2, AHORA).motivo == "fuera_de_horario"


def test_las_pendientes_ocupan_lugar_y_se_ofrecen_alternativas():
    existentes = [reserva(VIERNES_9PM - timedelta(minutes=30), 8)]
    r = revisar(REGLAS, existentes, VIERNES_9PM, 4, AHORA)
    assert r.motivo == "sin_cupo"
    assert 1 <= len(r.alternativas) <= 3
    for alternativa in r.alternativas:
        assert revisar(REGLAS, existentes, alternativa, 4, AHORA).disponible


def test_las_canceladas_no_ocupan_lugar():
    existentes = [reserva(VIERNES_9PM, 10, CANCELADA)]
    assert revisar(REGLAS, existentes, VIERNES_9PM, 4, AHORA).disponible


def test_ocupacion_cuenta_solo_lo_simultaneo():
    # 6 personas de 19:00 a 20:30 y 6 de 20:30 a 22:00 nunca coinciden.
    temprano = reserva(VIERNES_9PM.replace(hour=19), 6)
    tarde = reserva(VIERNES_9PM.replace(hour=20, minute=30), 6)
    inicio = VIERNES_9PM.replace(hour=19)
    assert ocupacion_maxima([temprano, tarde], inicio, inicio + timedelta(hours=3)) == 6


def test_turno_que_cruza_medianoche():
    reglas = Reglas(horario={4: [("20:00", "02:00")]}, duracion_min=60)
    horarios = horarios_del_dia(reglas, VIERNES_9PM.date(), MX)
    assert horarios[-1] == datetime(2026, 11, 7, 1, 0, tzinfo=MX)
    assert revisar(reglas, [], datetime(2026, 11, 7, 0, 30, tzinfo=MX), 2, AHORA).disponible


def test_muy_lejos():
    r = revisar(REGLAS, [], VIERNES_9PM + timedelta(days=60), 2, AHORA)
    assert r.motivo == "muy_lejos"
