"""
Crea (o actualiza) el dueño y el auto de prueba para validar la pasarela real
de Mercado Pago con montos mínimos: $1.000 de arriendo al día y $1.000 de
garantía (hold). Idempotente: se puede correr varias veces.

El dueño es una cuenta aparte, sin tarjetas y con nombre/RUT propios, para que
el antifraude del checkout (autofinanciamiento) no bloquee al arrendatario que
paga con sus tarjetas reales. No tiene contraseña: nadie inicia sesión con él.

Uso (desde apps/api):  python scripts/seed_auto_prueba_pasarela.py
      Para sacarlo del marketplace:  python scripts/seed_auto_prueba_pasarela.py --pausar
"""
import os
import sys

sys.path.insert(0, os.path.abspath("."))

from app.core.database import SessionLocal  # noqa: E402
from app.models.entities import Auto, Usuario  # noqa: E402

EMAIL_DUENO = "pruebas.pasarela@arriendomiautoya.cl"
PATENTE = "TEST01"
TARIFA_DIA = 1000
GARANTIA = 1000


def main(pausar: bool) -> None:
    db = SessionLocal()
    try:
        dueno = db.query(Usuario).filter(Usuario.email == EMAIL_DUENO).first()
        if not dueno:
            dueno = Usuario(
                email=EMAIL_DUENO,
                nombre="Arrienda Tu Auto Pruebas",
                roles_activos=["dueno"],
                estado_documentos="verificado",
            )
            db.add(dueno)
            db.flush()

        # Fotos prestadas de un auto ya publicado, para que la ficha se vea normal.
        modelo_fotos = (
            db.query(Auto)
            .filter(Auto.estado == "activo", Auto.patente != PATENTE)
            .order_by(Auto.fecha_publicacion.desc().nullslast())
            .first()
        )

        auto = db.query(Auto).filter(Auto.patente == PATENTE).first()
        if not auto:
            auto = Auto(
                dueno_id=dueno.id,
                marca="PRUEBA",
                modelo="Pasarela Mercado Pago (no reservar)",
                anio=2020,
                patente=PATENTE,
                ubicacion_base="Concepción",
                categoria="economico",
                transmision="mecanica",
                combustible="bencina",
                asientos=5,
                puertas=4,
                descripcion="Auto de prueba interna de la pasarela de pagos. No es un vehículo real.",
                fotos=list(modelo_fotos.fotos or []) if modelo_fotos else [],
                latitud=getattr(modelo_fotos, "latitud", None),
                longitud=getattr(modelo_fotos, "longitud", None),
            )
            db.add(auto)
        auto.tarifa_dia = TARIFA_DIA
        auto.garantia_clp = GARANTIA
        auto.documentos_verificados = True
        auto.estado = "pausado" if pausar else "activo"
        db.commit()
        print(f"Dueño: {dueno.id} ({dueno.email})")
        print(f"Auto:  {auto.id} patente={auto.patente} tarifa={auto.tarifa_dia} "
              f"garantía={auto.garantia_clp} estado={auto.estado}")
    finally:
        db.close()


if __name__ == "__main__":
    main(pausar="--pausar" in sys.argv)
