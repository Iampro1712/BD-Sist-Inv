"""
Script para crear la tabla de bitácora de servicios
"""
import os
import django
import psycopg2
from dotenv import load_dotenv

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from django.conf import settings

# Cargar variables de entorno
load_dotenv()

def create_bitacora_table():
    """Crea la tabla de bitácora en la base de datos"""
    
    # Obtener configuración de la base de datos
    db_config = settings.DATABASES['default']
    
    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(
            dbname=db_config['NAME'],
            user=db_config['USER'],
            password=db_config['PASSWORD'],
            host=db_config['HOST'],
            port=db_config['PORT']
        )
        cursor = conn.cursor()
        
        print("Conectado a la base de datos...")
        
        # Leer el script SQL
        with open('api/create_bitacora_table.sql', 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Ejecutar el script
        cursor.execute(sql_script)
        conn.commit()
        
        print("✓ Tabla bitacora_servicio creada exitosamente")
        
        # Verificar que la tabla existe
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'bitacora_servicio'
        """)
        
        if cursor.fetchone():
            print("✓ Tabla verificada en la base de datos")
        else:
            print("✗ Error: La tabla no se encontró después de crearla")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"✗ Error al crear la tabla: {str(e)}")
        raise

if __name__ == '__main__':
    create_bitacora_table()
