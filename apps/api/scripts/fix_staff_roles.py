import os
import sys
sys.path.insert(0, os.path.abspath("."))

from sqlalchemy import text
from app.core.database import SessionLocal

db = SessionLocal()
try:
    print("Conectando a base de datos...")
    db.execute(text("UPDATE usuarios SET roles_activos = '[\"admin\"]'::json WHERE email ILIKE '%admin%'"))
    db.execute(text("UPDATE usuarios SET roles_activos = '[\"manager\"]'::json WHERE email ILIKE '%manager%'"))
    db.execute(text("UPDATE usuarios SET roles_activos = '[\"soporte\"]'::json WHERE email ILIKE '%soporte%'"))
    db.commit()
    print("Roles actualizados exitosamente en Postgres/JSON!")
    
    rows = db.execute(text("SELECT email, roles_activos FROM usuarios WHERE email ILIKE '%qa%'")).fetchall()
    for row in rows:
        print(f"Usuario: {row[0]} -> Roles: {row[1]}")
except Exception as e:
    db.rollback()
    # Si roles_activos es columna tipo ARRAY de varchar en vez de JSON
    try:
        db.execute(text("UPDATE usuarios SET roles_activos = ARRAY['admin'] WHERE email ILIKE '%admin%'"))
        db.execute(text("UPDATE usuarios SET roles_activos = ARRAY['manager'] WHERE email ILIKE '%manager%'"))
        db.execute(text("UPDATE usuarios SET roles_activos = ARRAY['soporte'] WHERE email ILIKE '%soporte%'"))
        db.commit()
        print("Roles actualizados exitosamente en Postgres/ARRAY!")
        rows = db.execute(text("SELECT email, roles_activos FROM usuarios WHERE email ILIKE '%qa%'")).fetchall()
        for row in rows:
            print(f"Usuario: {row[0]} -> Roles: {row[1]}")
    except Exception as err2:
        print("Error actualizando roles:", err2)
finally:
    db.close()
