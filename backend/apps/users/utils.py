"""
Issue 24: reservado_por (y otros campos de "quién hizo esto") se guardaban
como texto libre, comparado con __iexact contra el nombre para mostrar del
usuario (first_name o el prefijo del email). Eso rompía con duplicados de
mayúsculas/minúsculas, ex-empleados fantasma, etc. (ver
apps/sheets/management/commands/limpiar_reservas.py).

Este resolver centraliza el MISMO criterio de coincidencia que ya usaban
ProfileDataView y AvatarsMapView, para poder resolver ese texto libre a un
User real (la FK) sin inventar una segunda fuente de verdad para el nombre.
"""
from django.contrib.auth import get_user_model


def resolve_by_display_name(nombre):
    """Devuelve el User cuyo nombre para mostrar coincide con `nombre`
    (sin distinguir mayúsculas/minúsculas), o None si no hay match."""
    if not nombre:
        return None
    nombre = str(nombre).strip()
    if not nombre:
        return None

    User = get_user_model()

    candidato = User.objects.filter(first_name__iexact=nombre).first()
    if candidato:
        return candidato

    for u in User.objects.exclude(username=''):
        prefijo = u.username.split('@')[0]
        if prefijo.lower() == nombre.lower():
            return u

    return None
