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

        # Redundancia en R2 si está configurado.
        try:
            from api.storage import r2_storage
            if r2_storage.enabled:
                # BufferedReader (open()) no permite fijar atributos arbitrarios
                # como .name/.content_type; se envuelve en BytesIO para poder
                # reusar r2_storage.upload_file tal cual lo espera.
                buf = io.BytesIO(destino.read_bytes())
                buf.name = nombre
                buf.content_type = 'application/json'
                url = r2_storage.upload_file(buf, folder='backups')
                if url:
                    self.stdout.write(self.style.SUCCESS(f'Subido a R2: {url}'))
                else:
                    self.stderr.write('No se pudo subir el respaldo a R2 (revisar logs).')
            else:
                self.stdout.write('R2 no configurado: el respaldo solo queda en disco local.')
        except Exception as e:
            self.stderr.write(f'Error al subir respaldo a R2: {e}')

        # Retención: conservar solo los N más recientes.
        retener = options['retener']
        respaldos = sorted(backup_dir.glob('inventrix-backup-*.json'), reverse=True)
        for viejo in respaldos[retener:]:
            viejo.unlink(missing_ok=True)
            self.stdout.write(f'Eliminado respaldo antiguo: {viejo.name}')
