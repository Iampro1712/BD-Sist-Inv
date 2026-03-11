"""
Servicio de almacenamiento en Cloudflare R2
"""
import boto3
from django.conf import settings
from botocore.exceptions import ClientError
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class R2Storage:
    """Cliente para interactuar con Cloudflare R2"""
    
    def __init__(self):
        try:
            self.client = boto3.client(
                's3',
                endpoint_url=settings.R2_ACCESS_URI,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name='auto'
            )
            self.bucket_name = settings.R2_BUCKET_NAME
            self.public_url = settings.R2_PUBLIC_URL
            self.enabled = True
            logger.info(f"R2 Storage inicializado correctamente")
        except Exception as e:
            logger.error(f"Error al inicializar R2 Storage: {str(e)}")
            self.enabled = False
    
    def upload_file(self, file, folder='bitacora'):
        """Sube un archivo a R2. Retorna URL o None si falla."""
        if not self.enabled:
            logger.warning("R2 Storage no está habilitado")
            return None
            
        try:
            ext = file.name.split('.')[-1] if '.' in file.name else 'jpg'
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            filename = f"{folder}/{timestamp}_{unique_id}.{ext}"
            
            logger.info(f"Subiendo: {filename}")
            
            self.client.upload_fileobj(
                file,
                self.bucket_name,
                filename,
                ExtraArgs={
                    'ContentType': file.content_type or 'image/jpeg',
                    'CacheControl': 'public, max-age=31536000'
                }
            )
            
            url = f"{self.public_url}/{filename}"
            logger.info(f"Subido exitosamente: {url}")
            return url
        
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"Error R2 ClientError: Code={error_code}, Message={error_msg}")
            return None
        except Exception as e:
            logger.error(f"Error inesperado al subir: {str(e)}")
            return None
    
    def delete_file(self, file_url):
        """Elimina un archivo de R2"""
        if not self.enabled or not file_url:
            return
            
        try:
            filename = file_url.replace(f"{self.public_url}/", "")
            self.client.delete_object(Bucket=self.bucket_name, Key=filename)
            logger.info(f"Eliminado: {filename}")
        except Exception as e:
            logger.error(f"Error al eliminar: {str(e)}")
    
    def upload_multiple_files(self, files, folder='bitacora'):
        """Sube múltiples archivos. Retorna lista de URLs (excluye None)"""
        urls = []
        for file in files:
            url = self.upload_file(file, folder)
            if url:
                urls.append(url)
        return urls


# Instancia global
r2_storage = R2Storage()
