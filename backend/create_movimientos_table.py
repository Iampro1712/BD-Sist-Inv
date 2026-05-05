"""
Script para crear la tabla movimientos_inventario en la base de datos
"""
import os
import sys
import django
import psycopg2
from pathlib import Path

# Configurar Django
sys.path.append(str(Path(__file__).parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.conf import settings

def create_movimientos_table():
    """Crear tabla movimientos_inventario"""
    
    # Obtener configuración de la base de datos
    db_config = settings.DATABASES['default']
    
    # SQL para crear la tabla
    sql = """
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
        cantidad INTEGER NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        referencia VARCHAR(100),
        tipo_referencia VARCHAR(20) CHECK (tipo_referencia IN ('ORDEN_COMPRA', 'ORDEN_VENTA', 'AJUSTE_MANUAL')),
        notas TEXT
    );
    
    -- Crear índices para mejorar el rendimiento
    CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_inventario(tipo);
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(fecha DESC);
    """
    
    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(
            host=db_config['HOST'],
            port=db_config['PORT'],
            database=db_config['NAME'],
            user=db_config['USER'],
            password=db_config['PASSWORD']
        )
        
        cursor = conn.cursor()
        
        print("🔄 Creando tabla movimientos_inventario...")
        cursor.execute(sql)
        conn.commit()
        print("✅ Tabla movimientos_inventario creada exitosamente")
        
        # Verificar que la tabla existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'movimientos_inventario'
            );
        """)
        exists = cursor.fetchone()[0]
        
        if exists:
            print("✅ Verificación: La tabla movimientos_inventario existe")
            
            # Mostrar estructura de la tabla
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'movimientos_inventario'
                ORDER BY ordinal_position;
            """)
            
            print("\n📋 Estructura de la tabla:")
            for row in cursor.fetchall():
                print(f"  - {row[0]}: {row[1]} (nullable: {row[2]})")
        else:
            print("❌ Error: La tabla no se creó correctamente")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error al crear la tabla: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    print("=" * 60)
    print("CREACIÓN DE TABLA MOVIMIENTOS_INVENTARIO")
    print("=" * 60)
    create_movimientos_table()
    print("\n✅ Proceso completado")
