#!/usr/bin/env python
"""
Script para agregar la columna id_proveedor a la tabla productos
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.db import connection

def add_proveedor_to_productos():
    """Agregar columna id_proveedor a productos"""
    
    sql_file = os.path.join(os.path.dirname(__file__), 'add_proveedor_to_productos.sql')
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)
        
        print("✅ Columna id_proveedor agregada exitosamente a productos")
        
        # Verificar que la columna existe
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'productos' AND column_name = 'id_proveedor'
            """)
            result = cursor.fetchone()
            
            if result:
                print(f"✅ Verificación: Columna id_proveedor existe")
                print(f"   Tipo: {result[1]}, Nullable: {result[2]}")
            else:
                print("❌ Error: La columna no se agregó correctamente")
                
    except Exception as e:
        print(f"❌ Error al agregar la columna: {e}")
        raise

def asignar_proveedores_desde_ordenes():
    """Asignar proveedores a productos basándose en órdenes de compra existentes"""
    
    try:
        with connection.cursor() as cursor:
            # Actualizar productos con el proveedor más frecuente de sus órdenes de compra
            cursor.execute("""
                UPDATE productos p
                SET id_proveedor = (
                    SELECT oc.id_proveedor
                    FROM detalles_orden_compra doc
                    INNER JOIN orden_compra oc ON doc.orden_compra_id = oc.id_orden
                    WHERE doc.producto_id = p.id_producto
                    GROUP BY oc.id_proveedor
                    ORDER BY COUNT(*) DESC
                    LIMIT 1
                )
                WHERE EXISTS (
                    SELECT 1 
                    FROM detalles_orden_compra doc
                    WHERE doc.producto_id = p.id_producto
                )
            """)
            
            rows_updated = cursor.rowcount
            print(f"✅ {rows_updated} productos actualizados con proveedor desde órdenes de compra")
            
            # Contar productos sin proveedor
            cursor.execute("""
                SELECT COUNT(*) 
                FROM productos 
                WHERE id_proveedor IS NULL
            """)
            sin_proveedor = cursor.fetchone()[0]
            
            if sin_proveedor > 0:
                print(f"⚠️  {sin_proveedor} productos sin proveedor asignado")
                print("   Estos productos necesitarán un proveedor asignado manualmente")
            
            # Mostrar estadísticas
            cursor.execute("""
                SELECT 
                    pr.nombre_empresa,
                    COUNT(p.id_producto) as total_productos
                FROM proveedores pr
                LEFT JOIN productos p ON p.id_proveedor = pr.id_proveedor
                GROUP BY pr.id_proveedor, pr.nombre_empresa
                ORDER BY total_productos DESC
            """)
            
            print("\n📊 Productos por proveedor:")
            print("-" * 60)
            for row in cursor.fetchall():
                print(f"  {row[0]:<40} {row[1]:>3} productos")
            print("-" * 60)
                
    except Exception as e:
        print(f"❌ Error al asignar proveedores: {e}")
        raise

if __name__ == '__main__':
    print("🚀 Agregando columna id_proveedor a productos...")
    print("=" * 60)
    add_proveedor_to_productos()
    print("\n🔄 Asignando proveedores desde órdenes de compra...")
    print("=" * 60)
    asignar_proveedores_desde_ordenes()
    print("=" * 60)
    print("✨ Proceso completado")
