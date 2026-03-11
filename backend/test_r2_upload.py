"""
Script para probar la subida de archivos a R2
"""
import os
import sys
import django
from io import BytesIO

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from api.storage import r2_storage

def test_upload():
    """Prueba subir un archivo de prueba"""
    
    print("=" * 60)
    print("Probando subida de archivo a R2")
    print("=" * 60)
    
    # Crear un archivo de prueba en memoria
    print("\n📝 Creando archivo de prueba...")
    test_content = b"Este es un archivo de prueba para R2"
    test_file = BytesIO(test_content)
    test_file.name = "test_image.jpg"
    test_file.content_type = "image/jpeg"
    
    # Intentar subir
    print(f"\n📤 Subiendo archivo...")
    url = r2_storage.upload_file(test_file, folder='test')
    
    if url:
        print(f"✅ Archivo subido exitosamente!")
        print(f"   URL: {url}")
        
        # Intentar eliminar
        print(f"\n🗑️  Eliminando archivo de prueba...")
        r2_storage.delete_file(url)
        print(f"✅ Archivo eliminado")
        
        return True
    else:
        print(f"❌ Error al subir archivo")
        return False

if __name__ == '__main__':
    success = test_upload()
    sys.exit(0 if success else 1)
