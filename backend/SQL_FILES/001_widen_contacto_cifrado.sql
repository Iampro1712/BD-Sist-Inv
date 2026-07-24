-- R06: telefono/email de cliente y proveedores pasan a guardarse cifrados
-- (Fernet, ver backend/inventory/encryption.py). El texto cifrado en base64
-- no entra en varchar(50)/varchar(255) por el overhead fijo de Fernet
-- (~60 caracteres extra), asi que se amplian a TEXT antes de cifrar los
-- datos existentes con `python manage.py encrypt_contact_fields`.
--
-- ALTER COLUMN ... TYPE TEXT es instantaneo en Postgres (no reescribe la
-- tabla): varchar y text comparten representacion interna.

ALTER TABLE cliente ALTER COLUMN telefono TYPE TEXT;
ALTER TABLE cliente ALTER COLUMN email TYPE TEXT;

ALTER TABLE proveedores ALTER COLUMN telefono TYPE TEXT;
ALTER TABLE proveedores ALTER COLUMN email TYPE TEXT;
