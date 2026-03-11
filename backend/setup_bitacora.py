"""
Script para configurar la funcionalidad de bitácora
Instala dependencias y crea la tabla en la base de datos
"""
import subprocess
import sys
import os

def install_dependencies():
    """Instala las dependencias necesarias"""
    print("📦 Instalando dependencias...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "boto3", "Pillow"])
        print("✓ Dependencias instaladas correctamente")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error al instalar dependencias: {e}")
        return False

def create_table():
    """Crea la tabla de bitácora"""
    print("\n📊 Creando tabla de bitácora...")
    try:
        subprocess.check_call([sys.executable, "create_bitacora_table.py"])
        print("✓ Tabla creada correctamente")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error al crear tabla: {e}")
        return False

def main():
    print("=" * 60)
    print("🚀 Configuración de Bitácora de Servicios con Cloudflare R2")
    print("=" * 60)
    
    # Verificar que estamos en el directorio correcto
    if not os.path.exists('manage.py'):
        print("✗ Error: Este script debe ejecutarse desde el directorio backend/")
        sys.exit(1)
    
    # Instalar dependencias
    if not install_dependencies():
        print("\n✗ Falló la instalación de dependencias")
        sys.exit(1)
    
    # Crear tabla
    if not create_table():
        print("\n✗ Falló la creación de la tabla")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ Configuración completada exitosamente")
    print("=" * 60)
    print("\n📝 Próximos pasos:")
    print("1. Reinicia el servidor Django")
    print("2. Accede a la sección de Clientes en el frontend")
    print("3. Selecciona un cliente y una moto")
    print("4. Haz clic en 'Bitácora' en cualquier servicio")
    print("\n🎉 ¡Listo para usar la bitácora con imágenes en R2!")

if __name__ == '__main__':
    main()
