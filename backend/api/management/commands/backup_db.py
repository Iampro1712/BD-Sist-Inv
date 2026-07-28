"""
Respaldo automático de la base de datos (R05). Pensado para ejecutarse por
cron/servicio programado.

Genera un volcado **restaurable** con `pg_dump` (formato custom), lo verifica,
lo guarda en BACKUP_DIR con retención de los últimos N, y si hay un bucket
privado configurado sube una copia cifrada.

Sobre el respaldo JSON: quedó como último recurso para cuando `pg_dump` no está
disponible. **No restaura la base por sí solo** —le falta el esquema, las
secuencias y los disparadores— así que cuando se cae a ese camino el comando lo
dice con todas las letras en vez de dejar creer que hay respaldo.
"""
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from api.backup_pg import (
    comprobar_disponible, generar_dump, nombre_dump, verificar_dump,
)
from api.backup_utils import generar_backup_json

# Los dos formatos que puede dejar este comando, para la retención.
PATRONES = ('inventrix-*.dump', 'inventrix-backup-*.json')


class Command(BaseCommand):
    help = ('Genera un respaldo restaurable de la base (pg_dump), lo verifica, '
            'lo sube cifrado a un bucket privado y aplica retención.')

    def add_arguments(self, parser):
        parser.add_argument(
            '--retener', type=int, default=int(os.getenv('BACKUP_RETENER', '14')),
            help='Cantidad de respaldos locales a conservar (los más recientes).',
        )
        parser.add_argument(
            '--sin-subir', action='store_true',
            help='Solo respaldo local, sin copia remota. Útil para probar.',
        )

    def handle(self, *args, **options):
        backup_dir = Path(os.getenv('BACKUP_DIR', settings.BASE_DIR / 'backups'))
        backup_dir.mkdir(parents=True, exist_ok=True)

        destino, restaurable = self._crear(backup_dir)
        if destino is None:
            return

        if not options['sin_subir']:
            self._subir(destino)

        self._aplicar_retencion(backup_dir, options['retener'])

        if not restaurable:
            # Se repite al final a propósito: es lo último que ve quien revisa la
            # salida del cron, y es lo que importa.
            self.stderr.write(self.style.ERROR(
                'ATENCIÓN: el respaldo de hoy NO restaura la base por sí solo.'))

    # -- Creación --------------------------------------------------------------

    def _crear(self, backup_dir):
        """Devuelve (ruta, es_restaurable). (None, False) si no hubo respaldo."""
        disponible, detalle = comprobar_disponible()

        if disponible:
            destino = backup_dir / nombre_dump()
            ok, info = generar_dump(destino)
            if ok:
                # Verificar antes de darlo por bueno: un archivo truncado pasa
                # desapercibido hasta el día que hace falta.
                valido, detalle_verif = verificar_dump(destino)
                if valido:
                    self.stdout.write(self.style.SUCCESS(
                        f'Respaldo restaurable: {destino.name} '
                        f'({info}, {detalle_verif})'))
                    return destino, True

                self.stderr.write(self.style.ERROR(
                    f'El respaldo se creó pero no pasó la verificación: '
                    f'{detalle_verif}. Se descarta.'))
                destino.unlink(missing_ok=True)
            else:
                self.stderr.write(self.style.ERROR(f'pg_dump: {info}'))
        else:
            self.stderr.write(self.style.WARNING(
                f'Sin respaldo restaurable: {detalle}'))

        return self._json_de_emergencia(backup_dir), False

    def _json_de_emergencia(self, backup_dir):
        """Volcado JSON cuando pg_dump no se pudo usar.

        Guarda los datos del negocio, que es mejor que nada, pero para volver a
        levantar el sistema desde acá hace falta reconstruir el esquema con las
        migraciones y reajustar los contadores a mano.
        """
        try:
            contenido, nombre = generar_backup_json()
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f'Tampoco se pudo generar el respaldo JSON: {e}. '
                f'NO HAY RESPALDO DE HOY.'))
            return None

        destino = backup_dir / nombre
        destino.write_text(contenido, encoding='utf-8')
        self.stdout.write(self.style.WARNING(
            f'Respaldo JSON (solo datos) creado: {destino.name}\n'
            f'  No incluye esquema, secuencias ni disparadores: para restaurar '
            f'hacen falta además las migraciones y reajustar los contadores.'))
        return destino

    # -- Copia remota ----------------------------------------------------------

    def _subir(self, destino):
        """Sube una copia cifrada al bucket privado.

        Hacen falta bucket privado Y clave de cifrado; si falta alguno no se
        sube. Es mejor tener solo la copia local que una copia remota expuesta:
        el respaldo entero quedó descargable sin autenticación una vez y no se
        repite.
        """
        try:
            from api.storage import r2_storage

            bucket = getattr(settings, 'R2_BACKUP_BUCKET', None)
            clave_cifrado = getattr(settings, 'BACKUP_ENCRYPTION_KEY', None)

            if not bucket:
                self.stdout.write(
                    'Sin R2_BACKUP_BUCKET: el respaldo queda solo en disco local. '
                    'Configurá un bucket privado (no el del CDN público) para '
                    'tener copia remota.')
                return
            if not clave_cifrado:
                self.stderr.write(self.style.WARNING(
                    'Sin BACKUP_ENCRYPTION_KEY: no se sube. El respaldo lleva '
                    'datos de clientes y precios; se cifra antes de salir del '
                    'servidor. Generá una clave con:\n'
                    '  python -c "from cryptography.fernet import Fernet; '
                    'print(Fernet.generate_key().decode())"'))
                return
            if not r2_storage.enabled:
                self.stderr.write('R2 no configurado: el respaldo queda en disco local.')
                return

            from cryptography.fernet import Fernet
            cifrado = Fernet(clave_cifrado).encrypt(destino.read_bytes())
            clave = r2_storage.subir_respaldo(cifrado, destino.name + '.enc')
            if clave:
                self.stdout.write(self.style.SUCCESS(
                    f'Copia cifrada en bucket privado: {clave}'))
            else:
                self.stderr.write('No se pudo subir el respaldo (revisar logs).')
        except Exception as e:
            self.stderr.write(f'Error al subir el respaldo: {e}')

    # -- Retención -------------------------------------------------------------

    def _aplicar_retencion(self, backup_dir, retener):
        """Conserva los N más recientes de cada formato.

        Por formato y no en conjunto: si se mezclaran, una racha de respaldos
        JSON de emergencia podría desplazar al último `.dump` restaurable, que es
        justo el que hay que conservar.
        """
        for patron in PATRONES:
            archivos = sorted(backup_dir.glob(patron), reverse=True)
            for viejo in archivos[retener:]:
                viejo.unlink(missing_ok=True)
                self.stdout.write(f'Eliminado respaldo antiguo: {viejo.name}')
