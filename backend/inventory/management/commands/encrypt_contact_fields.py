"""
Migra telefono/email existentes en cliente y proveedores a su forma cifrada
(R06). Idempotente: si un valor ya es un token Fernet válido, se deja igual.

Requiere que las columnas ya sean TEXT (ver
SQL_FILES/001_widen_contacto_cifrado.sql) — el texto cifrado no entra en un
varchar(50)/varchar(255).
"""
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


def _fernet():
    return Fernet(settings.FIELD_ENCRYPTION_KEY)


def _ya_cifrado(fernet, valor):
    try:
        fernet.decrypt(valor.encode())
        return True
    except InvalidToken:
        return False


TABLAS = [
    ('cliente', 'id_cliente'),
    ('proveedores', 'id_proveedor'),
]
COLUMNAS = ['telefono', 'email']


class Command(BaseCommand):
    help = 'Cifra telefono/email existentes en cliente y proveedores.'

    def handle(self, *args, **options):
        fernet = _fernet()
        total_cifrados = 0

        with connection.cursor() as cursor:
            for tabla, pk in TABLAS:
                cursor.execute(f"SELECT {pk}, telefono, email FROM {tabla}")
                filas = cursor.fetchall()

                for id_val, telefono, email in filas:
                    updates = {}
                    for columna, valor in (('telefono', telefono), ('email', email)):
                        if not valor:
                            continue
                        if _ya_cifrado(fernet, valor):
                            continue
                        updates[columna] = fernet.encrypt(valor.encode()).decode()

                    if not updates:
                        continue

                    set_clause = ', '.join(f'{col} = %s' for col in updates)
                    cursor.execute(
                        f"UPDATE {tabla} SET {set_clause} WHERE {pk} = %s",
                        [*updates.values(), id_val],
                    )
                    total_cifrados += 1
                    self.stdout.write(f'{tabla}.{pk}={id_val}: cifrado {list(updates.keys())}')

        self.stdout.write(self.style.SUCCESS(f'Listo. {total_cifrados} filas actualizadas.'))
