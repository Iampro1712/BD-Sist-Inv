# Changelog

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.1-4F46E5?style=flat-square)](#101---2026-07-24)
[![Keep a Changelog](https://img.shields.io/badge/Keep%20a%20Changelog-1.1.0-orange?style=flat-square)](https://keepachangelog.com/es-ES/1.1.0/)
[![Semantic Versioning](https://img.shields.io/badge/semver-2.0.0-blue?style=flat-square)](https://semver.org/lang/es/)

</div>

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

---

## [1.0.1] - 2026-07-24

### Fixed

- Revertido `SECURE_SSL_REDIRECT=True` (introducido en 1.0.0), que rompió producción: Dokploy/Traefik no reenvía `X-Forwarded-Proto` de forma que Django lo detecte de forma fiable, así que Django respondía `301` a toda petición — incluidos los preflight `OPTIONS` de CORS, bloqueando el login y toda la API. Traefik ya fuerza HTTPS en el borde; el resto de los flags de seguridad (HSTS, cookies seguras) se mantienen sin cambios.

---

## [1.0.0] - 2026-07-24

Primera versión formalmente etiquetada del proyecto: cierra la mitigación completa
de los riesgos críticos y altos identificados en `RIESGOS_SISTEMA.txt`, unifica el
control del esquema de base de datos bajo migraciones Django, y completa el backlog
de endurecimiento de seguridad de `FIXES_SEGURIDAD.md`.

### Added

- Toggle de modo oscuro en la pantalla de login.
- Respaldo automático programado de la base de datos (`manage.py backup_db`), con retención configurable y subida redundante a Cloudflare R2; servicio dedicado en `docker-compose.yml` / `docker-compose.prod.yml`.
- Suite de tests de integración (`backend/api/tests.py`) para los flujos críticos: ventas y descuento de stock, pagos/saldos, ajustes de inventario, devoluciones, permisos por rol y los endpoints de marcas/categorías.
- Pipeline de CI (`.github/workflows/backend-ci.yml`) que bootstrapea la base de datos híbrida y corre la suite de tests en cada push/PR.
- Cifrado en reposo (Fernet/AES) para teléfono y email de clientes y proveedores (`backend/inventory/encryption.py`), con comando de migración de datos existentes (`encrypt_contact_fields`).
- Snapshot de esquema versionado (`backend/SQL_FILES/000_base_schema_snapshot.sql`) para poder levantar una base de datos de pruebas idéntica a producción.
- Migraciones Django (`0007`–`0012`) que unifican el control del esquema históricamente gestionado por SQL directo (`managed=False`) bajo migraciones reales.
- Permisos por rol (`backend/api/permissions.py`, `IsAdminOrReadOnly`): acciones destructivas de catálogo/inventario (borrar productos/clientes/proveedores, importar, ajustar stock, gestionar compras) quedan restringidas a administradores.
- Validación de devoluciones contra lo realmente vendido en la venta referenciada (no se puede devolver más de lo vendido ni un producto no vendido).
- Guard de "último administrador" también en `update` (no se puede quitar `is_staff`/`is_active` al último admin activo).
- Flags de seguridad de producción en Django (`SECURE_SSL_REDIRECT`, HSTS, cookies seguras, `CSRF_TRUSTED_ORIGINS`).

### Changed

- El login distingue ahora entre credenciales inválidas (401/400), rate limit (429) y errores de conexión/servidor, en vez de mostrar siempre "usuario o contraseña incorrectos".
- Crear una venta ahora descuenta stock de forma atómica (con validación de stock suficiente) y registra el movimiento de inventario correspondiente; antes las ventas no afectaban el inventario.
- La acción de cancelar una orden de venta restituye el stock vendido y elimina la venta y sus pagos asociados.
- `docker-compose.yml` ya no crea un superusuario `admin/admin123` por defecto.
- Redis pasa a ser obligatorio en producción (antes opcional, lo que producía caché inconsistente entre workers de Gunicorn).
- Las credenciales de Cloudflare R2 se validan de forma estricta (fail-fast) en producción.
- Actualizadas dependencias del frontend con vulnerabilidades conocidas: `jspdf` (3 a 4.2.1), `react-router-dom` (7.13 a 7.18), y overrides de `lodash`, `tmp` y `form-data` a versiones parcheadas.
- Reducido el tiempo de vida del access token JWT (60 a 30 min) y el límite de throttle por usuario (1000 a 500/min).
- `CORS_ALLOW_CREDENTIALS` desactivado (la autenticación va por header JWT, no por cookies).

### Fixed

- Corregido el bug en vivo por el que `/api/marcas/` y `/api/categorias/` devolvían error 500 (las tablas nunca se habían creado físicamente pese a que Django las daba por existentes).
- Corregidas las acciones "completar"/"cancelar" de orden de venta, que fallaban por depender de código legado (`services.py`) incompatible con el esquema real de la base de datos.
- Quitado el flag `--reload` de Gunicorn en el entrypoint de producción.
- Corregido el conflicto de puerto 80 entre los servicios `frontend` y `nginx` en `docker-compose.prod.yml`.
- Corregida una fuga de datos en los reportes financieros: `@cache_page` cacheaba la respuesta por URL sin distinguir usuario, sirviendo una respuesta de administrador a un usuario sin permisos.

### Security

- Restringido `/api/backup/`, los 7 endpoints de reportes financieros y `/api/auditoria-productos/` a usuarios administradores (antes accesibles para cualquier usuario autenticado).
- De 44 vulnerabilidades conocidas en dependencias del frontend (2 críticas, 14 altas) a 1 moderada.

### Removed

- Eliminado código muerto: modelos `DetalleOrdenCompra` / `DetalleOrdenVenta` (tablas inexistentes en la base de datos real), el archivo `backend/api/services.py` completo y sus serializers asociados.
- Eliminada documentación obsoleta o redundante en la raíz del repositorio (bitácoras de features ya implementadas y guías desactualizadas).
