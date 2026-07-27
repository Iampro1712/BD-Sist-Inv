"""
Respaldo automático de la base de datos (R05 - mitigación de "sin backups
automáticos"). Pensado para ejecutarse por cron/servicio programado.

Genera un volcado JSON, lo guarda en BACKUP_DIR (con retención de los últimos
N archivos) y, si R2 está configurado, sube también una copia a Cloudflare R2
en la carpeta "backups" (redundancia fuera del disco del contenedor).
"""
import io
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from api.backup_utils import generar_backup_json


class Command(BaseCommand):
    help = 'Genera un respaldo JSON de las tablas de negocio y aplica retención.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--retener', type=int, default=int(os.getenv('BACKUP_RETENER', '14')),
            help='Cantidad de respaldos locales a conservar (los más recientes).',
        )

    def handle(self, *args, **options):
        backup_dir = Path(os.getenv('BACKUP_DIR', settings.BASE_DIR / 'backups'))
        backup_dir.mkdir(parents=True, exist_ok=True)

        contenido, nombre = generar_backup_json()
        destino = backup_dir / nombre
        destino.write_text(contenido, encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Respaldo local creado: {destino}'))

        # Copia remota, solo a un bucket PRIVADO y con el contenido cifrado.
        #
        # Antes esto subía el volcado al bucket con dominio público, así que la
        # base entera quedaba descargable sin autenticación. Ahora hacen falta
        # dos cosas y, si falta alguna, no se sube: es mejor tener solo la copia
        # local que una copia remota expuesta.
        try:
            from api.storage import r2_storage

            bucket = getattr(settings, 'R2_BACKUP_BUCKET', None)
            clave_cifrado = getattr(settings, 'BACKUP_ENCRYPTION_KEY', None)

            if not bucket:
                self.stdout.write(
                    'Sin R2_BACKUP_BUCKET: el respaldo queda solo en disco local. '
                    'Configurá un bucket privado (no el del CDN público) para '
                    'tener copia remota.')
            elif not clave_cifrado:
                self.stderr.write(self.style.WARNING(
                    'Sin BACKUP_ENCRYPTION_KEY: no se sube. El respaldo lleva '
                    'datos de clientes y precios; se cifra antes de salir del '
                    'servidor. Generá una clave con:\n'
                    '  python -c "from cryptography.fernet import Fernet; '
                    'print(Fernet.generate_key().decode())"'))
            elif not r2_storage.enabled:
                self.stderr.write('R2 no configurado: el respaldo queda en disco local.')
            else:
                from cryptography.fernet import Fernet
                cifrado = Fernet(clave_cifrado).encrypt(destino.read_bytes())
                clave = r2_storage.subir_respaldo(cifrado, nombre + '.enc')
                if clave:
                    self.stdout.write(self.style.SUCCESS(
                        f'Respaldo cifrado en bucket privado: {clave}'))
                else:
                    self.stderr.write('No se pudo subir el respaldo (revisar logs).')
        except Exception as e:
            self.stderr.write(f'Error al subir el respaldo: {e}')

        # Retención: conservar solo los N más recientes.
        retener = options['retener']
        respaldos = sorted(backup_dir.glob('inventrix-backup-*.json'), reverse=True)
        for viejo in respaldos[retener:]:
            viejo.unlink(missing_ok=True)
            self.stdout.write(f'Eliminado respaldo antiguo: {viejo.name}')
