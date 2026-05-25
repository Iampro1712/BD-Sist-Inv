#!/usr/bin/env python
"""
Script para poblar la tabla producto_proveedor con datos iniciales
basados en las órdenes de compra existentes
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.db import connection

def populate_producto_proveedor():
    """Poblar tabla producto_proveedor basándose en órdenes de compra existentes"""
    
    try:
        with connection.cursor() as cursor:
            # Insertar relaciones basadas en órdenes de compra existentes
            cursor.execute("""
                INSERT INTO producto_proveedor (id_producto, id_proveedor, precio_compra, es_proveedor_principal)
                SELECT DISTINCT 
                    doc.producto_id as id_producto,
                    oc.id_proveedor,
                    doc.precio_unitario as precio_compra,
                    FALSE as es_proveedor_principal
                FROM detalles_orden_compra doc
                INNER JOIN orden_compra oc ON doc.orden_compra_id = oc.id_orden
                WHERE NOT EXISTS (
                    SELECT 1 
                    FROM producto_proveedor pp 
                    WHERE pp.id_producto = doc.producto_id 
                    AND pp.id_proveedor = oc.id_proveedor
                )
                ON CONFLICT (id_producto, id_proveedor) DO NOTHING
            """)
            
            rows_inserted = cursor.rowcount
            print(f"✅ {rows_inserted} relaciones producto-proveedor creadas desde órdenes de compra")
            
            # Si no hay órdenes de compra, crear relaciones para todos los productos con todos los proveedores
            if rows_inserted == 0:
                print("ℹ️  No hay órdenes de compra. Creando relaciones para todos los productos...")
                cursor.execute("""
                    INSERT INTO producto_proveedor (id_producto, id_proveedor, precio_compra, es_proveedor_principal)
                    SELECT 
                        p.id_producto,
                        pr.id_proveedor,
                        p.precio_compra_unitario as precio_compra,
                        FALSE as es_proveedor_principal
                    FROM productos p
                    CROSS JOIN proveedores pr
                    ON CONFLICT (id_producto, id_proveedor) DO NOTHING
                """)
                
                rows_inserted = cursor.rowcount
                print(f"✅ {rows_inserted} relaciones producto-proveedor creadas (todos con todos)")
            
            # Mostrar estadísticas
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_relaciones,
                    COUNT(DISTINCT id_producto) as productos_con_proveedor,
                    COUNT(DISTINCT id_proveedor) as proveedores_con_productos
                FROM producto_proveedor
            """)
            
            stats = cursor.fetchone()
            print("\n📊 Estadísticas:")
            print("-" * 60)
            print(f"  Total de relaciones: {stats[0]}")
            print(f"  Productos con proveedor: {stats[1]}")
            print(f"  Proveedores con productos: {stats[2]}")
            print("-" * 60)
            
            # Mostrar algunos ejemplos
            cursor.execute("""
                SELECT 
                    p.nombre as producto,
                    pr.nombre_empresa as proveedor,
                    pp.precio_compra
                FROM producto_proveedor pp
                INNER JOIN productos p ON pp.id_producto = p.id_producto
                INNER JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
                LIMIT 10
            """)
            
            print("\n📋 Ejemplos de relaciones creadas:")
            print("-" * 80)
            for row in cursor.fetchall():
                print(f"  {row[0]:<40} → {row[1]:<30} (C${row[2] or 0:.2f})")
            print("-" * 80)
                
    except Exception as e:
        print(f"❌ Error al poblar la tabla: {e}")
        raise

if __name__ == '__main__':
    print("🚀 Poblando tabla producto_proveedor...")
    print("=" * 80)
    populate_producto_proveedor()
    print("=" * 80)
    print("✨ Proceso completado")
