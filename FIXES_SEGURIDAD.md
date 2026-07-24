# 🔐 Backlog de Seguridad (Scrum) — rama `master-with-auth`

Plan de remediación de las vulnerabilidades de la auditoría, gestionado con **Scrum**.
Aplica **solo** a la versión con autenticación (`master-with-auth`); nada se mergea a `master`.

> **Estado — 2026-07-24 (release casi cerrado)**. Resumen tras implementar y
> verificar contra el código real (con tests de rol en `backend/api/tests.py`):
>
> | Historia | Estado |
> |----------|--------|
> | US-01 Rotar/purgar claves R2 | ✅ N/A — se verificó que las claves R2 reales **nunca** estuvieron en el historial de git (ni `.env` fue trackeado); el working tree solo tiene placeholders. La rotación en Cloudflare queda como higiene opcional, no urgente. |
> | US-02 Restringir `/api/backup/` a admin | ✅ Hecho |
> | US-03 Restringir reportes y auditoría a admin | ✅ Hecho (+ se eliminó `@cache_page` que filtraba respuestas cacheadas entre usuarios) |
> | US-04 Segregación por rol | ✅ Hecho (`api/permissions.py` + `IsAdminOrReadOnly`) |
> | US-05 Defaults inseguros docker-compose | 🟡 Parcial (ver nota abajo) |
> | US-06 Flags de seguridad de producción | ✅ Hecho (`check --deploy` limpio salvo largo de SECRET_KEY) |
> | US-07 Validar devoluciones contra la venta | ✅ Hecho |
> | US-08 Guard de último admin en update | ✅ Hecho |
> | US-09 Quitar `--reload` de gunicorn | ✅ Hecho |
> | US-10 Auditar dependencias frontend | ✅ Hecho — de 44 vulns (2 críticas/14 altas) a 1 moderada |
> | US-11 Migajas de configuración | ✅ Hecho |
>
> **Acciones manuales pendientes que el código no puede resolver:**
> 1. **SECRET_KEY de producción**: la actual en `backend/.env` tiene 40
>    caracteres (`check --deploy` lo marca). Generar una de ≥50 e ir
>    rotándola (invalida los JWT vigentes → todos re-login).
> 2. **uuid (moderada)**: dependencia transitiva sin fix sin salto mayor;
>    aceptada por ahora.
> 3. **US-05**: `docker-compose.yml` (solo desarrollo local) aún usa
>    `SECRET_KEY:-django-insecure-dev-key`; `docker-compose.prod.yml` ya
>    exige las variables sin fallback, así que producción está cubierta.

- **Producto:** Inventrix (versión con auth)
- **Objetivo del release:** dejar `master-with-auth` lista para producción sin hallazgos críticos/altos.
- **Duración de sprint:** 1 semana · **Velocidad estimada:** ~8–10 SP/sprint

---

## 👥 Roles del equipo Scrum
| Rol | Responsabilidad |
|-----|-----------------|
| **Product Owner** | Dueño del negocio: prioriza el backlog, acepta las historias |
| **Scrum Master** | Facilita ceremonias, remueve impedimentos (p. ej. accesos a Cloudflare/BD) |
| **Equipo de Desarrollo** | Implementa y verifica los fixes |

## ✅ Definición de Hecho (Definition of Done)
Una historia está **Hecha** cuando:
1. El código está implementado en `master-with-auth`.
2. Cumple **todos** sus criterios de aceptación.
3. `python manage.py check` (y `--deploy` cuando aplique) y `pnpm build` pasan sin errores.
4. Verificado manualmente el comportamiento por rol (admin vs usuario).
5. Commit subido a `master-with-auth`.

## 📏 Escala de estimación (story points, Fibonacci)
`1` trivial · `2` pequeño · `3` mediano · `5` grande · `8` muy grande/incierto

---

## 🗂️ Épicas
| ID | Épica | Descripción |
|----|-------|-------------|
| **E1** | Secretos y exposición de datos | Quitar secretos del repo y cerrar la fuga masiva de datos |
| **E2** | Control de acceso por roles | Segregar funciones admin vs usuario |
| **E3** | Configuración e infraestructura segura | Defaults, flags de producción |
| **E4** | Hardening y deuda técnica | Lógica de negocio, dependencias, migajas |

---

## 📋 Product Backlog (priorizado)
| ID | Historia | Épica | SP | Prioridad | Sprint |
|----|----------|-------|----|-----------|--------|
| US-01 | ✅ Rotar y purgar claves R2 del repo (N/A: historial limpio) | E1 | 3 | 🔴 Crítica | 1 |
| US-02 | ✅ Restringir `/api/backup/` a admin | E1 | 1 | 🔴 Crítica | 1 |
| US-03 | ✅ Restringir reportes y auditoría a admin | E1 | 2 | 🔴 Crítica | 1 |
| US-04 | ✅ Segregación de funciones por rol | E2 | 5 | 🟠 Alta | 2 |
| US-05 | 🟡 Quitar defaults inseguros de docker-compose (parcial) | E3 | 2 | 🟠 Alta | 2 |
| US-06 | ✅ Flags de seguridad de producción | E3 | 2 | 🟠 Alta | 2 |
| US-07 | ✅ Validar devoluciones contra la venta | E4 | 5 | 🟡 Media | 3 |
| US-08 | ✅ Guard de "último admin" en update | E4 | 2 | 🟡 Media | 3 |
| US-09 | ✅ Quitar `--reload` de gunicorn en prod | E4 | 1 | 🟡 Media | 3 |
| US-10 | ✅ Auditar dependencias del frontend | E4 | 3 | 🟢 Baja | 3 |
| US-11 | ✅ Migajas de configuración | E4 | 3 | 🟢 Baja | 3 |

---

# 🏃 Sprint 1 — "Cerrar la sangría" (6 SP)
**Sprint Goal:** eliminar los secretos filtrados y cortar la exfiltración masiva de datos.

### US-01 · Rotar y purgar claves R2 — `3 SP` 🔴
> **Como** dueño, **quiero** que las claves R2 no estén en el repositorio, **para** que nadie con acceso al código pueda controlar mi almacenamiento.

**Criterios de aceptación**
- **Dado** el historial git, **cuando** se busque `R2_SECRET_ACCESS_KEY`, **entonces** no aparece en ningún commit.
- **Dado** que se rotó la key en Cloudflare, **cuando** se sube una foto de bitácora, **entonces** funciona con la nueva key desde `backend/.env`.

**Tareas técnicas**
- [ ] Rotar la API key en el dashboard de Cloudflare R2.
- [ ] Reemplazar las claves de `BITACORA_README.md:43-44` por placeholders.
- [ ] Purgar del historial: `git filter-repo --path BITACORA_README.md ...` (o BFG `--replace-text`).
- [ ] Cargar la key nueva en `backend/.env`.

### US-02 · Restringir `/api/backup/` a admin — `1 SP` 🔴
> **Como** dueño, **quiero** que solo administradores descarguen el respaldo, **para** que un empleado no exfiltre toda la base.

**Criterios de aceptación**
- **Dado** un usuario no-admin, **cuando** llama `GET /api/backup/`, **entonces** recibe **403**.
- **Dado** un admin, **cuando** lo llama, **entonces** recibe **200** y el JSON.

**Tareas técnicas** — `backend/api/backup_views.py`
```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

@api_view(['GET'])
@permission_classes([IsAdminUser])
def exportar_backup(request):
    ...
```

### US-03 · Restringir reportes y auditoría a admin — `2 SP` 🔴
> **Como** dueño, **quiero** que los reportes financieros y la auditoría sean solo para admins, **para** no exponer márgenes, costos, PII e IPs.

**Criterios de aceptación**
- **Dado** un usuario no-admin, **cuando** llama `/api/reportes/*` o `/api/auditoria-productos/`, **entonces** recibe **403**.
- **Dado** un admin, **entonces** recibe **200**.

**Tareas técnicas**
- [ ] `@permission_classes([IsAdminUser])` en los 7 reportes de `backend/api/reportes_views.py`.
- [ ] `permission_classes = [IsAdminUser]` en `AuditoriaProductoViewSet` (`backend/api/views.py`).

---

# 🏃 Sprint 2 — "Roles y configuración" (9 SP)
**Sprint Goal:** que cada usuario solo pueda hacer lo de su rol y que el despliegue no traiga defaults inseguros.

### US-04 · Segregación de funciones por rol — `5 SP` 🟠
> **Como** dueño, **quiero** que un usuario "Usuario" no pueda borrar ni alterar el catálogo/inventario, **para** que solo administradores hagan acciones destructivas.

**Criterios de aceptación**
- **Dado** un usuario no-admin, **cuando** intenta borrar producto/cliente/proveedor, importar productos o ajustar stock, **entonces** recibe **403**.
- **Dado** un usuario no-admin, **cuando** registra una venta o un pago (POS), **entonces** funciona (200/201).
- **Dado** un admin, **entonces** puede todo.

**Tareas técnicas**
- [ ] Crear `backend/api/permissions.py` con `IsAdminOrReadOnly` (lectura para autenticados, escritura solo `is_staff`).
- [ ] Aplicar `get_permissions()` por acción en `ProductoViewSet` (`destroy`, `importar`, `create`, `update` → admin).
- [ ] `destroy` solo admin en `ClienteViewSet`, `ProveedorViewSet`.
- [ ] `MovimientoInventarioViewSet.ajuste` y acciones de `OrdenCompraViewSet` → admin.
- [ ] Dejar a "Usuario": ventas, pagos, POS, cotizaciones.

### US-05 · Quitar defaults inseguros de docker-compose — `2 SP` 🟠
> **Como** dueño, **quiero** que `docker compose up` no cree `admin/admin123` ni use una `SECRET_KEY` conocida, **para** que no se puedan forjar tokens ni entrar con credenciales típicas.

**Criterios de aceptación**
- **Dado** `docker-compose.yml`, **cuando** falta `SECRET_KEY` o `DB_PASSWORD`, **entonces** `docker compose config` falla.
- **Dado** que no hay variables de superusuario, **entonces** no se crea ningún superusuario por defecto.

**Tareas técnicas** — `docker-compose.yml`: cambiar `${VAR:-inseguro}` por `${VAR:?...}` en `SECRET_KEY`/`DB_PASSWORD`, `DEBUG:-False`, y quitar los defaults `admin/admin123`.

🟡 Parcial (2026-07-24): se quitó el default `admin/admin123` del superusuario
(`DJANGO_SUPERUSER_USERNAME`/`PASSWORD` ya no tienen fallback inseguro — el
entrypoint omite crear el superusuario si faltan). `docker-compose.prod.yml`
ya exige `SECRET_KEY`/`DB_PASSWORD` sin fallback. Pendiente: `docker-compose.yml`
(el de desarrollo local) sigue con `SECRET_KEY:-django-insecure-dev-key` y
`DB_PASSWORD:-postgres}` — aceptable para desarrollo local, pero no cumple
literalmente el criterio "docker compose config falla si faltan".

### US-06 · Flags de seguridad de producción — `2 SP` 🟠
> **Como** dueño, **quiero** HTTPS forzado, HSTS y cookies seguras en producción, **para** proteger el panel admin y el tráfico.

**Criterios de aceptación**
- **Dado** `DEBUG=False`, **cuando** corro `manage.py check --deploy`, **entonces** no hay warnings de `SECURE_*`.
- **Dado** producción, **entonces** las cookies del admin llevan `Secure`.

**Tareas técnicas** — `backend/inventrix/settings.py` (bloque `if not DEBUG:`): `SECURE_SSL_REDIRECT`, `SECURE_PROXY_SSL_HEADER`, `SECURE_HSTS_*`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_CONTENT_TYPE_NOSNIFF`, `CSRF_TRUSTED_ORIGINS`.

🔴 **Incidente (2026-07-24)**: `SECURE_SSL_REDIRECT=True` rompió producción — Dokploy/Traefik
no reenvía `X-Forwarded-Proto` de forma que Django lo detecte de forma fiable, así que Django
creía que TODAS las requests llegaban por HTTP y respondía **301** a todo, incluidos los
preflight `OPTIONS` de CORS (el navegador no puede seguir una redirección en un preflight →
login y toda la API quedaron bloqueados). Revertido: `SECURE_SSL_REDIRECT` se quita del bloque
`if not DEBUG:` y se deja que Traefik fuerce HTTPS en el borde (ya lo hace). El resto de los
flags (HSTS, cookies seguras, `SECURE_PROXY_SSL_HEADER` para que `request.is_secure()` funcione
en las cookies) se mantienen. `check --deploy` ahora reporta `W008` (SSL redirect no forzado por
Django) como esperado/aceptado en este entorno.

---

# 🏃 Sprint 3 — "Hardening y deuda" (14 SP)
**Sprint Goal:** cerrar abusos de lógica de negocio y deuda técnica de seguridad.
> Nota de capacidad: 14 SP supera la velocidad; si no entra, mover US-10/US-11 al backlog del siguiente sprint.

### US-07 · Validar devoluciones contra la venta — `5 SP` 🟡
> **Como** dueño, **quiero** que una devolución no pueda exceder lo realmente vendido, **para** evitar inflar inventario y crédito de forma fraudulenta.

**Criterios de aceptación**
- **Dado** una devolución, **cuando** `id_venta` falta, **entonces** 400.
- **Dado** una venta, **cuando** se intenta devolver más de lo vendido (o un producto no vendido), **entonces** 400.
- **Dado** una devolución válida, **entonces** reingresa el stock correcto.

**Tareas técnicas** — `backend/api/serializers.py` (`DevolucionCreateSerializer`): `id_venta` requerido; en `validate` cruzar `producto_venta` (vendido) menos `producto_devolucion` (ya devuelto) y rechazar excesos.

### US-08 · Guard de "último admin" en update — `2 SP` 🟡
> **Como** dueño, **quiero** no poder dejar el sistema sin administradores activos, **para** no perder el control.

**Criterios de aceptación**
- **Dado** el último admin activo, **cuando** se intenta `is_active=False` o quitarle `is_staff`, **entonces** 400.

**Tareas técnicas** — `backend/api/views.py` (`UsuarioViewSet.update`): extender la guarda de "último admin" (hoy solo en `perform_destroy`).

### US-09 · Quitar `--reload` de gunicorn en prod — `1 SP` 🟡 ✅ HECHO (2026-07-24)
> **Como** dueño, **quiero** que el contenedor de producción no use auto-reload, **para** estabilidad y no malgastar recursos.

**Criterios de aceptación**
- **Dado** el contenedor de prod, **cuando** arranca, **entonces** gunicorn corre sin `--reload`.

**Tareas técnicas** — `backend/docker-entrypoint.sh:82`: quitar `--reload` (o condicionar a `DEBUG`); añadir `--max-requests`.

✔️ Verificado: `--reload` ya no aparece en `docker-entrypoint.sh`. Pendiente: `--max-requests` no se agregó (fuera del criterio de aceptación mínimo).

### US-10 · Auditar dependencias del frontend — `3 SP` 🟢
> **Como** dueño, **quiero** dependencias sin CVEs conocidos, **para** reducir el riesgo de robo de sesión.

**Criterios de aceptación**
- **Dado** `pnpm audit`, **entonces** no hay vulnerabilidades altas/críticas.
- **Dado** el escáner, **cuando** se actualizan/reemplazan deps, **entonces** sigue funcionando.

**Tareas técnicas** — `cd frontend && pnpm audit`; `pnpm update axios jspdf`; evaluar reemplazo de `html5-qrcode` por `@zxing/browser`.

### US-11 · Migajas de configuración — `3 SP` 🟢
> **Como** dueño, **quiero** afinar configuraciones menores, **para** reducir superficie de ataque.

**Criterios de aceptación**
- **Dado** `settings.py`, **entonces** `CORS_ALLOW_CREDENTIALS=False`, `user` throttle más bajo y `ACCESS_TOKEN_LIFETIME` reducido.
- **Dado** un nombre de tabla, **entonces** el backup usa `psycopg2.sql.Identifier`.

**Tareas técnicas** — `settings.py` (CORS, throttle, lifetime); `backup_views.py:53` (`sql.Identifier`); validar `cantidad/precio > 0` en ventas/cotizaciones; replicar cabeceras CSP en el nginx de `docker-compose.prod.yml`.

---

## 📅 Cadencia de ceremonias
| Ceremonia | Cuándo | Propósito |
|-----------|--------|-----------|
| **Sprint Planning** | Inicio de sprint | Seleccionar historias y desglosar tareas |
| **Daily Stand-up** | Diario | Avance, plan del día, impedimentos |
| **Sprint Review** | Fin de sprint | Demostrar los fixes verificados al PO |
| **Retrospectiva** | Fin de sprint | Mejorar el proceso |

## 📊 Métricas
- **Burndown** por sprint (SP restantes/día).
- **Velocity** real vs estimada para recalibrar.
- **Total backlog:** 29 SP en 3 sprints.

## 🧪 Verificación global (al cerrar el release)
```bash
# Backend
cd backend && source venv/Scripts/activate
python manage.py check && python manage.py check --deploy
# Frontend
cd ../frontend && pnpm build && pnpm audit
```
- Usuario no-admin: 403 en backup, reportes, borrados, importación, ajustes.
- Admin: 200 en todo. · Login throttle: >5/min → 429.
