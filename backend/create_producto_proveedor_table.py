#!/usr/bin/env python
"""
Script para crear la tabla de relación producto-proveedor
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.db import connection

def create_producto_proveedor_table():
    """Crear tabla de relación producto-proveedor"""
    
    sql_file = os.path.join(os.path.dirname(__file__), 'create_producto_proveedor_table.sql')
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
        
        print("✅ Tabla producto_proveedor creada exitosamente")
        
        # Verificar que la tabla existe
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_name = 'producto_proveedor'
            """)
            count = cursor.fetchone()[0]
            
            if count > 0:
                print("✅ Verificación: Tabla producto_proveedor existe")
                
                # Mostrar estructura de la tabla
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'producto_proveedor'
                    ORDER BY ordinal_position
                """)
                
                print("\n📋 Estructura de la tabla:")
                print("-" * 60)
                for row in cursor.fetchall():
                    print(f"  {row[0]:<30} {row[1]:<20} {'NULL' if row[2] == 'YES' else 'NOT NULL'}")
                print("-" * 60)
            else:
                print("❌ Error: La tabla no se creó correctamente")
                
    except Exception as e:
        print(f"❌ Error al crear la tabla: {e}")
        raise

if __name__ == '__main__':
    print("🚀 Creando tabla producto_proveedor...")
    print("=" * 60)
    create_producto_proveedor_table()
    print("=" * 60)
    print("✨ Proceso completado")
