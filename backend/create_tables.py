"""
Script para crear las tablas de motos y servicios
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.db import connection

def crear_tablas():
    """Crear las tablas de motos y servicios"""
    
    print("🚀 Creando tablas de motos y servicios...")
    
    # Leer el archivo SQL
    sql_file = os.path.join(os.path.dirname(__file__), 'create_motos_tables.sql')
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Ejecutar el SQL
    with connection.cursor() as cursor:
        cursor.execute(sql)
    
    print("✅ Tablas creadas exitosamente!")
    
    # Verificar las tablas
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('motos', 'servicio_motos')
            ORDER BY table_name;
        """)
        
        print("\n📋 Tablas verificadas:")
        for row in cursor.fetchall():
            print(f"  ✓ {row[0]}")

if __name__ == '__main__':
    crear_tablas()
