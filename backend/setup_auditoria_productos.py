#!/usr/bin/env python
"""
Script para configurar el sistema de auditoría de productos
Ejecuta el SQL que crea la tabla, trigger, vistas y funciones
"""
import os
import sys
import django
from pathlib import Path

# Configurar Django
sys.path.append(str(Path(__file__).parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.db import connection


def ejecutar_sql_desde_archivo(archivo):
    """Ejecuta un archivo SQL completo"""
    ruta_archivo = Path(__file__).parent / archivo
    
    print(f"📄 Leyendo archivo: {archivo}")
    with open(ruta_archivo, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    print(f"⚙️  Ejecutando SQL...")
    with connection.cursor() as cursor:
        cursor.execute(sql)
    
    print(f"✅ SQL ejecutado exitosamente")


def verificar_instalacion():
    """Verifica que el trigger y la tabla estén creados"""
    print("\n🔍 Verificando instalación...")
    
    with connection.cursor() as cursor:
        # Verificar tabla
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'auditoria_productos'
            );
        """)
        tabla_existe = cursor.fetchone()[0]
        
        # Verificar trigger
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.triggers 
                WHERE trigger_name = 'trg_auditoria_productos'
            );
        """)
        trigger_existe = cursor.fetchone()[0]
        
        # Contar registros
        if tabla_existe:
            cursor.execute("SELECT COUNT(*) FROM auditoria_productos;")
            total_registros = cursor.fetchone()[0]
        else:
            total_registros = 0
    
    print(f"\n📊 Estado de la instalación:")
    print(f"   ✓ Tabla 'auditoria_productos': {'✅ Existe' if tabla_existe else '❌ No existe'}")
    print(f"   ✓ Trigger 'trg_auditoria_productos': {'✅ Existe' if trigger_existe else '❌ No existe'}")
    print(f"   ✓ Registros de auditoría: {total_registros}")
    
    return tabla_existe and trigger_existe


def main():
    """Función principal"""
    print("=" * 60)
    print("🔧 CONFIGURACIÓN DE AUDITORÍA DE PRODUCTOS")
    print("=" * 60)
    
    try:
        # Ejecutar el SQL
        ejecutar_sql_desde_archivo('create_auditoria_productos.sql')
        
        # Verificar instalación
        if verificar_instalacion():
            print("\n✅ Sistema de auditoría configurado correctamente")
            print("\n📝 Ahora todos los cambios en productos serán auditados automáticamente:")
            print("   • Creación de productos (INSERT)")
            print("   • Modificación de productos (UPDATE)")
            print("   • Eliminación de productos (DELETE)")
            print("\n💡 Consultas útiles:")
            print("   • Ver últimos cambios: SELECT * FROM v_auditoria_reciente;")
            print("   • Ver historial de producto: SELECT * FROM fn_historial_producto(1);")
            print("   • Ver estadísticas: SELECT * FROM fn_estadisticas_auditoria();")
        else:
            print("\n⚠️  Hubo un problema con la instalación")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
