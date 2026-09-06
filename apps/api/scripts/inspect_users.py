import os
import sys
sys.path.insert(0, os.path.abspath("."))

from app.core.database import SessionLocal
from app.models.entities import Usuario

db = SessionLocal()
try:
    users = db.query(Usuario).all()
    print(f"Total usuarios en DB: {len(users)}")
    for u in users:
        print(f"---")
        print(f"Email: {u.email}")
        print(f"Nombre: {u.nombre}")
        print(f"RUT: {u.rut}")
        print(f"Estado Documentos: {u.estado_documentos}")
        print(f"Licencia Estado: {u.licencia_estado}")
        print(f"Licencia Clase: {u.licencia_clase}")
        print(f"Licencia Vencimiento: {u.licencia_vencimiento}")
        print(f"PIC URL: {u.pic_url}")
        print(f"Roles: {u.roles_activos}")
        print(f"Notas: {u.notas_auditoria}")
finally:
    db.close()
