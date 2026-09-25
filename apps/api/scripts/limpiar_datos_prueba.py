"""
Borra de la base los datos de prueba (seed/QA) y todo lo que cuelga de ellos.

Qué se considera de prueba:
  · usuarios con correo @arriendatuauto.cl o id "seed-*" (más los que pases con --email);
  · autos de esos usuarios o con id "seed-*";
  · reservas de esos usuarios, sobre esos autos o con id "seed-*".
De ahí se borra en cascada lo que depende (pagos, tarjetas, checklists, mensajes,
notificaciones, etc.), también cuando pertenece a un usuario real: p. ej. la
liquidación de un dueño real por una reserva que hizo un usuario QA.

Las cuentas de staff (admin, manager, soporte) NO se borran salvo --incluir-staff:
hoy las únicas cuentas admin son de QA y sin ellas nadie entra al panel.

Ojo: esto borra filas de la base, NO las cuentas de Supabase Auth. Si alguien
vuelve a iniciar sesión con una cuenta borrada, se le crea un usuario vacío.

Por defecto es un SIMULACRO: hace todo dentro de una transacción, muestra qué
se borraría y hace rollback. Solo con --ejecutar se guarda.

Uso (desde apps/api):
  python scripts/limpiar_datos_prueba.py                        # simulacro
  python scripts/limpiar_datos_prueba.py --email ren@gmail.com  # sumar cuentas de prueba
  python scripts/limpiar_datos_prueba.py --ejecutar             # borrar de verdad
  python scripts/limpiar_datos_prueba.py --solo-emails --email a@x.com   # solo esas cuentas
"""
import argparse
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.abspath("."))

from sqlalchemy import bindparam, inspect, text  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
import app.models.entities  # noqa: E402,F401  registra los modelos

DOMINIO_PRUEBA = "@arriendatuauto.cl"
ROLES_STAFF = ("admin", "manager", "soporte")

# FK opcionales que apuntan a un registro borrado pero cuya fila vale la pena
# conservar: se dejan en NULL en vez de borrar la fila.
FK_A_NULL = {
    ("usuarios", "referido_por_id"),
    ("certificados_antecedentes", "revisado_por_id"),
    ("certificados_antecedentes", "subido_por_id"),
    ("configuracion_plataforma", "actualizado_por_id"),
    ("disputas", "admin_asignado_id"),
    ("invitaciones_codigos", "usado_por_id"),
    ("tickets_soporte", "disputa_id"),
    ("reservas", "tarjeta_cobro_id"),
    ("reservas", "tarjeta_garantia_id"),
}


def _ids(cx, sql, **params):
    return {r[0] for r in cx.execute(text(sql), params)}


def _en(cx, sql, ids):
    """`sql` con un `:ids` expandido; vacío si no hay ids."""
    if not ids:
        return set()
    return {r[0] for r in cx.execute(text(sql).bindparams(bindparam("ids", expanding=True)), {"ids": list(ids)})}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ejecutar", action="store_true", help="guardar los cambios (sin esto es un simulacro)")
    ap.add_argument("--email", action="append", default=[], help="correo extra a tratar como de prueba")
    ap.add_argument("--incluir-staff", action="store_true", help="borrar también cuentas admin/manager/soporte")
    ap.add_argument("--solo-emails", action="store_true",
                    help="borrar SOLO las cuentas de --email (sin los datos seed/QA)")
    args = ap.parse_args()

    insp = inspect(engine)
    fks = []  # (tabla_hija, columna, tabla_padre)
    for t in insp.get_table_names():
        for fk in insp.get_foreign_keys(t):
            fks.append((t, fk["constrained_columns"][0], fk["referred_table"]))

    cx = engine.connect()
    tx = cx.begin()
    try:
        objetivo = defaultdict(set)
        if args.solo_emails and not args.email:
            ap.error("--solo-emails necesita al menos un --email")
        usuarios = set() if args.solo_emails else _ids(
            cx, "select id from usuarios where email ilike :d or id like 'seed-%'", d=f"%{DOMINIO_PRUEBA}")
        usuarios |= _en(cx, "select id from usuarios where lower(email) in :ids", {e.lower() for e in args.email})
        staff = _en(cx, "select id from usuarios where id in :ids and (" +
                    " or ".join(f"roles_activos::text ilike '%\"{r}\"%'" for r in ROLES_STAFF) + ")", usuarios)
        if not args.incluir_staff:
            usuarios -= staff
        objetivo["usuarios"] = usuarios
        semilla = not args.solo_emails
        objetivo["autos"] = (_ids(cx, "select id from autos where id like 'seed-%'") if semilla else set()) | _en(
            cx, "select id from autos where dueno_id in :ids", usuarios)
        objetivo["reservas"] = (
            (_ids(cx, "select id from reservas where id like 'seed-%'") if semilla else set())
            | _en(cx, "select id from reservas where cliente_id in :ids", usuarios)
            | _en(cx, "select id from reservas where auto_id in :ids", objetivo["autos"])
        )

        # Cascada hasta que no aparezca nada nuevo.
        cambio = True
        while cambio:
            cambio = False
            for hija, col, padre in fks:
                if (hija, col) in FK_A_NULL or not objetivo[padre]:
                    continue
                nuevos = _en(cx, f'select id from "{hija}" where "{col}" in :ids', objetivo[padre]) - objetivo[hija]
                if nuevos:
                    objetivo[hija] |= nuevos
                    cambio = True
        # Notificaciones sobre reservas o autos borrados (entidad_id no es FK).
        objetivo["notificaciones"] |= _en(
            cx, "select id from notificaciones where entidad_id in :ids", objetivo["reservas"] | objetivo["autos"])

        print("SIMULACRO (no se guarda nada)" if not args.ejecutar else "EJECUCIÓN REAL")
        print("\nCuentas de prueba a borrar:")
        for r in _en(cx, "select email || '  ' || roles_activos::text from usuarios where id in :ids", usuarios):
            print("   ", r)
        if staff and not args.incluir_staff:
            print("\nCuentas de staff de prueba que se CONSERVAN (usa --incluir-staff para borrarlas):")
            for r in _en(cx, "select email || '  ' || roles_activos::text from usuarios where id in :ids", staff):
                print("   ", r)
        dinero = _en(cx, "select tipo || ' ' || estado || ' $' || monto from pagos where id in :ids and estado='pendiente'",
                     objetivo["pagos"])
        if dinero:
            print("\nPagos PENDIENTES que desaparecen (no se transferirán):")
            for r in sorted(dinero):
                print("   ", r)

        # FK opcionales a NULL, después borrado de hijas a padres.
        for hija, col in sorted(FK_A_NULL):
            padre = next((p for h, c, p in fks if h == hija and c == col), None)
            if padre and objetivo[padre]:
                cx.execute(
                    text(f'update "{hija}" set "{col}" = null where "{col}" in :ids').bindparams(
                        bindparam("ids", expanding=True)),
                    {"ids": list(objetivo[padre])},
                )
        print("\nFilas a borrar por tabla:")
        for tabla in reversed(Base.metadata.sorted_tables):
            ids = objetivo.get(tabla.name)
            if not ids:
                continue
            res = cx.execute(
                text(f'delete from "{tabla.name}" where id in :ids').bindparams(bindparam("ids", expanding=True)),
                {"ids": list(ids)},
            )
            print(f"   {tabla.name}: {res.rowcount}")

        if args.ejecutar:
            tx.commit()
            print("\nListo: cambios guardados.")
        else:
            tx.rollback()
            print("\nSimulacro terminado: no se guardó nada. Corre con --ejecutar para borrar.")
    except Exception:
        tx.rollback()
        raise
    finally:
        cx.close()


if __name__ == "__main__":
    main()
