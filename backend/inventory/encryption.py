"""
Cifrado en reposo (R06) para columnas de contacto sensibles (telefono, email
de clientes y proveedores). Usa Fernet (AES-128-CBC + HMAC) con una clave
simetrica en FIELD_ENCRYPTION_KEY.

No se cifran columnas financieras (montos, totales): se usan constantemente
en SUM()/reportes con SQL crudo en todo el backend, y cifrarlas obligaria a
reescribir esas consultas para agregar en Python. Ese es un cambio aparte,
mucho mas grande.

Efecto secundario aceptado: los campos cifrados ya no se pueden buscar por
substring (ILIKE) desde la API, porque el texto cifrado no preserva orden ni
subcadenas del texto original. Se quitaron de `search_fields` en los
ViewSets correspondientes.
"""
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


def _fernet():
    return Fernet(settings.FIELD_ENCRYPTION_KEY)


def decrypt_value(value):
    """Descifra un valor leído por SQL crudo (no pasa por from_db_value).

    Usar en cualquier reporte/consulta con connection.cursor() que lea
    telefono/email de cliente o proveedores.
    """
    if not value:
        return value
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return value


class _EncryptedFieldMixin:
    """Cifra al guardar / descifra al leer. Se guarda como texto (el
    cifrado de Fernet añade overhead fijo de ~60 caracteres en base64,
    la columna real debe ser TEXT/varchar amplio)."""

    def db_type(self, connection):
        return 'text'

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ''):
            return value
        return _fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value in (None, ''):
            return value
        try:
            return _fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Valor preexistente sin cifrar (antes de la migración a
            # cifrado) o clave incorrecta: se devuelve tal cual en vez de
            # reventar la request, para no dejar la app inutilizable.
            return value

    def to_python(self, value):
        return value


class EncryptedCharField(_EncryptedFieldMixin, models.CharField):
    pass


class EncryptedEmailField(_EncryptedFieldMixin, models.EmailField):
    """Igual que EncryptedCharField, pero DRF sigue tratándolo como email
    (valida formato) al generar el serializer automáticamente."""
    pass
