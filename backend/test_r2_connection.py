"""
Script para probar la conexión a Cloudflare R2
"""
import os
import sys
import django
from dotenv import load_dotenv

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

import boto3
from botocore.exceptions import ClientError
from django.conf import settings

def test_r2_connection():
    """Prueba la conexión a R2"""
    
    print("=" * 60)
    print("Probando conexión a Cloudflare R2")
    print("=" * 60)
    
    print(f"\n📋 Configuración:")
    print(f"  Endpoint: {settings.R2_ACCESS_URI}")
    print(f"  Bucket: {settings.R2_BUCKET_NAME}")
    print(f"  Access Key ID: {settings.R2_ACCESS_KEY_ID[:10]}...")
    print(f"  Public URL: {settings.R2_PUBLIC_URL}")
    
    try:
        # Crear cliente
        print(f"\n🔌 Creando cliente S3...")
        client = boto3.client(
            's3',
            endpoint_url=settings.R2_ACCESS_URI,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name='auto'
        )
        print("✓ Cliente creado")
        
        # Listar buckets
        print(f"\n📦 Listando buckets...")
        response = client.list_buckets()
        print(f"✓ Buckets encontrados: {len(response['Buckets'])}")
        for bucket in response['Buckets']:
            print(f"  - {bucket['Name']}")
        
        # Verificar si el bucket existe
        print(f"\n🔍 Verificando bucket '{settings.R2_BUCKET_NAME}'...")
        try:
            client.head_bucket(Bucket=settings.R2_BUCKET_NAME)
            print(f"✓ Bucket '{settings.R2_BUCKET_NAME}' existe y es accesible")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                print(f"✗ Bucket '{settings.R2_BUCKET_NAME}' no existe")
            elif error_code == '403':
                print(f"✗ No tienes permisos para acceder al bucket '{settings.R2_BUCKET_NAME}'")
            else:
                print(f"✗ Error al verificar bucket: {error_code}")
            return False
        
        # Intentar listar objetos
        print(f"\n📄 Listando objetos en el bucket...")
        try:
            response = client.list_objects_v2(Bucket=settings.R2_BUCKET_NAME, MaxKeys=5)
            count = response.get('KeyCount', 0)
            print(f"✓ Objetos en el bucket: {count}")
            if count > 0:
                print("  Primeros objetos:")
                for obj in response.get('Contents', [])[:5]:
                    print(f"    - {obj['Key']}")
        except ClientError as e:
            print(f"✗ Error al listar objetos: {e}")
            return False
        
        print(f"\n✅ Conexión a R2 exitosa!")
        return True
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        print(f"\n✗ Error de cliente S3:")
        print(f"  Código: {error_code}")
        print(f"  Mensaje: {error_message}")
        print(f"  Response completo: {e.response}")
        return False
    except Exception as e:
        print(f"\n✗ Error inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_r2_connection()
    sys.exit(0 if success else 1)
