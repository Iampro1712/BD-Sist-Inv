<div align="center">

<img src="https://img.shields.io/badge/INVENTRIX-4F46E5?style=for-the-badge&logoColor=white" alt="Inventrix" height="42"/>

### Sistema de gestión para talleres y tiendas de repuestos

Inventario, punto de venta, taller y caja en un solo lugar.<br/>
Construido para un taller de motos real en Managua, Nicaragua.

<br/>

[![Versión](https://img.shields.io/badge/versión-1.14.0-4F46E5?style=flat-square)](./CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-347_passing-22C55E?style=flat-square&logo=pytest&logoColor=white)](#calidad)
[![Changelog](https://img.shields.io/badge/changelog-Keep_a_Changelog-F59E0B?style=flat-square)](./CHANGELOG.md)
[![SemVer](https://img.shields.io/badge/semver-2.0.0-3B82F6?style=flat-square&logo=semver&logoColor=white)](https://semver.org/lang/es/)

<br/>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-REST_API-A30000?style=for-the-badge&logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Redis](https://img.shields.io/badge/Redis-cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

<br/>

**[Módulos](#módulos)** · **[Arquitectura](#arquitectura)** · **[Instalación](#instalación)** · **[Seguridad](#seguridad)** · **[Changelog](./CHANGELOG.md)**

</div>

---

## Qué es

Inventrix es el sistema que corre el día a día de un taller de motos: lo que entra,
lo que sale, lo que se debe y lo que se cobra.

No es un ERP genérico adaptado a la fuerza. Cada módulo salió de un problema
concreto del mostrador — el presupuesto que el cliente aprueba antes de que el
mecánico toque la moto, el repuesto que se descontó del inventario pero nunca se
facturó, la caja que al cierre no cuadra y nadie sabe por qué.

<table>
<tr>
<td width="33%" valign="top">

### Vender
Punto de venta con lector de código de barras, arqueo de caja por turno y
control de quién cobró qué.

</td>
<td width="33%" valign="top">

### Reparar
Órdenes de trabajo en tablero Kanban, presupuestos que el cliente aprueba y
repuestos que salen del inventario solo cuando hay autorización.

</td>
<td width="33%" valign="top">

### Controlar
Cuentas por cobrar y por pagar, rentabilidad por producto, desempeño de
proveedores y pronóstico de demanda.

</td>
</tr>
</table>

---

## Módulos

### Operación diaria

| | Módulo | Qué resuelve |
|:--:|---|---|
| <img src="https://img.shields.io/badge/-POS-F59E0B?style=flat-square" height="20"/> | **Punto de venta** | Venta rápida con lector de código de barras, múltiples métodos de pago y bloqueo si no hay caja abierta |
| <img src="https://img.shields.io/badge/-Caja-22C55E?style=flat-square" height="20"/> | **Sesiones de caja** | Apertura y cierre por turno con arqueo. El efectivo esperado se calcula desde ventas, gastos, pagos y reembolsos |
| <img src="https://img.shields.io/badge/-Taller-8B5CF6?style=flat-square" height="20"/> | **Órdenes de trabajo** | Tablero Kanban por estado: recibida → diagnóstico → presupuesto → reparación → entrega |
| <img src="https://img.shields.io/badge/-Bitácora-A855F7?style=flat-square" height="20"/> | **Bitácora de servicio** | Registro fotográfico en los 4 módulos del servicio, con las imágenes en almacenamiento externo |
| <img src="https://img.shields.io/badge/-Ventas-EAB308?style=flat-square" height="20"/> | **Órdenes de venta** | Ventas a crédito con abonos parciales, saldo pendiente y devoluciones |
| <img src="https://img.shields.io/badge/-Compras-EC4899?style=flat-square" height="20"/> | **Órdenes de compra** | Compra, recepción que suma stock de forma idempotente, y devoluciones al proveedor |

### Inventario

| | Módulo | Qué resuelve |
|:--:|---|---|
| <img src="https://img.shields.io/badge/-Productos-10B981?style=flat-square" height="20"/> | **Catálogo** | SKU, código de barras, stock mínimo, precios por proveedor e importación masiva desde Excel/CSV |
| <img src="https://img.shields.io/badge/-Ubicaciones-14B8A6?style=flat-square" height="20"/> | **Ubicaciones físicas** | Dónde está cada repuesto en la bodega: pasillo, estante, nivel |
| <img src="https://img.shields.io/badge/-Conteo-0EA5E9?style=flat-square" height="20"/> | **Conteo físico** | Hoja de conteo por ubicación y aplicación de ajustes en lote, con su rastro de movimientos |
| <img src="https://img.shields.io/badge/-Movimientos-06B6D4?style=flat-square" height="20"/> | **Trazabilidad** | Todo movimiento de stock queda registrado con su origen: venta, compra, taller o ajuste |
| <img src="https://img.shields.io/badge/-Etiquetas-6366F1?style=flat-square" height="20"/> | **Etiquetas** | Generación de etiquetas con código de barras para imprimir |

### Dinero

| | Módulo | Qué resuelve |
|:--:|---|---|
| <img src="https://img.shields.io/badge/-CxC-F59E0B?style=flat-square" height="20"/> | **Cuentas por cobrar** | Saldos de clientes con antigüedad (0-30, 31-60, 61-90, +90 días) |
| <img src="https://img.shields.io/badge/-CxP-EF4444?style=flat-square" height="20"/> | **Cuentas por pagar** | Lo que se le debe a cada proveedor, con saldo a favor si se devolvió mercadería ya pagada |
| <img src="https://img.shields.io/badge/-Gastos-DC2626?style=flat-square" height="20"/> | **Gastos** | Libro de gastos por categoría que alimenta el estado de resultados y el arqueo de caja |
| <img src="https://img.shields.io/badge/-Cotizaciones-6366F1?style=flat-square" height="20"/> | **Cotizaciones** | Proformas con PDF, y presupuestos de reparación que al aprobarse cargan los repuestos a la orden |
| <img src="https://img.shields.io/badge/-Garantías-84CC16?style=flat-square" height="20"/> | **Garantías** | Cobertura por producto vendido y gestión de reclamaciones |

### Análisis

| | Módulo | Qué resuelve |
|:--:|---|---|
| <img src="https://img.shields.io/badge/-Rentabilidad-22C55E?style=flat-square" height="20"/> | **Rentabilidad** | Margen real por producto y por servicio, no solo volumen de venta |
| <img src="https://img.shields.io/badge/-Pronóstico-4F46E5?style=flat-square" height="20"/> | **Pronóstico de demanda** | Punto de reorden calculado con la velocidad de venta real y el plazo de entrega de cada proveedor |
| <img src="https://img.shields.io/badge/-Proveedores-8B5CF6?style=flat-square" height="20"/> | **Desempeño de proveedores** | Quién entrega a tiempo, quién manda mercadería mala y quién tiene mejor precio |
| <img src="https://img.shields.io/badge/-Preventivo-0EA5E9?style=flat-square" height="20"/> | **Mantenimiento preventivo** | Qué motos tocan servicio, por kilometraje o por fecha |
| <img src="https://img.shields.io/badge/-Reportes-06B6D4?style=flat-square" height="20"/> | **Reportes** | 16 reportes con exportación a PDF y Excel |

### Administración

| | Módulo | Qué resuelve |
|:--:|---|---|
| <img src="https://img.shields.io/badge/-Usuarios-64748B?style=flat-square" height="20"/> | **Usuarios y roles** | Dueño y operador. Los costos, márgenes y reportes financieros son solo del dueño |
| <img src="https://img.shields.io/badge/-Auditoría-475569?style=flat-square" height="20"/> | **Logs de auditoría** | Todo cambio de producto queda registrado por un trigger de base de datos, con usuario e IP |
| <img src="https://img.shields.io/badge/-Respaldos-0EA5E9?style=flat-square" height="20"/> | **Respaldos** | Respaldo restaurable con `pg_dump`, verificado antes de darse por bueno |
| <img src="https://img.shields.io/badge/-IA-A855F7?style=flat-square" height="20"/> | **Proveedores de IA** | Configuración de OpenAI, Anthropic, Gemini o DeepSeek con la clave cifrada en reposo |

> [!NOTE]
> La IA **interpreta, nunca calcula dinero**. El pronóstico de demanda se computa
> de forma determinista; la IA solo agrega contexto de estacionalidad y sugerencias
> de agrupación. Si el proveedor de IA falla, los números siguen saliendo.

---

## Arquitectura

```mermaid
graph TB
    subgraph Clientes
        WEB["Web · React 19 + Vite"]
        DESK["Escritorio · JavaFX"]
    end

    subgraph Servidor
        API["Django 5.2 + DRF<br/>JWT · Throttling · Auditoría"]
    end

    subgraph Datos
        PG[("PostgreSQL 16<br/>Triggers · JSONB")]
        REDIS[("Redis<br/>Caché")]
        R2[("Object Storage<br/>Imágenes")]
    end

    WEB -->|REST| API
    DESK -->|JDBC| PG
    API --> PG
    API --> REDIS
    API --> R2
```

<table>
<tr>
<td width="50%" valign="top">

### Backend

[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat-square&logo=django&logoColor=white)](#)
[![DRF](https://img.shields.io/badge/DRF-REST-A30000?style=flat-square)](#)
[![JWT](https://img.shields.io/badge/JWT-SimpleJWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)](#)
[![Gunicorn](https://img.shields.io/badge/Gunicorn-WSGI-499848?style=flat-square&logo=gunicorn&logoColor=white)](#)

- API REST con autenticación JWT en **todos** los endpoints salvo dos
- Esquema híbrido: ORM de Django conviviendo con SQL crudo donde hace falta
- Cifrado Fernet para datos de contacto, con clave separada de la de respaldos
- Auditoría por trigger de PostgreSQL, no por señales de Django
- Transacciones atómicas con bloqueo de fila en todo lo que toca stock o dinero

</td>
<td width="50%" valign="top">

### Frontend

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](#)
[![ReactQuery](https://img.shields.io/badge/TanStack-Query-FF4154?style=flat-square&logo=reactquery&logoColor=white)](#)
[![Zustand](https://img.shields.io/badge/Zustand-state-443E38?style=flat-square)](#)
[![Recharts](https://img.shields.io/badge/Recharts-gráficos-22B5BF?style=flat-square)](#)

- 29 pantallas con carga diferida y división de código
- Caché de servidor con TanStack Query, estado de cliente con Zustand
- Modo oscuro completo y diseño adaptable a móvil
- Exportación a PDF (jsPDF) y Excel (ExcelJS) desde el navegador
- Lectura de código de barras por cámara o lector físico

</td>
</tr>
</table>

### Aplicación de escritorio

[![Estado](https://img.shields.io/badge/estado-alpha-EF4444?style=flat-square)](#)
[![Java](https://img.shields.io/badge/Java-21-007396?style=flat-square&logo=openjdk&logoColor=white)](#)
[![JavaFX](https://img.shields.io/badge/JavaFX-21-5382A1?style=flat-square&logo=java&logoColor=white)](#)

Cliente nativo de Windows para el mostrador. Se conecta por JDBC **a la misma base
de datos** que la web, así que los datos son los mismos y en tiempo real.
Reimplementa la verificación de contraseñas de Django y el cifrado de contactos
para ser compatible bit a bit con el backend.

Cubre inventario, punto de venta, clientes, proveedores y compras. Taller, caja,
gastos, cotizaciones y reportes siguen siendo exclusivos de la web. Vive en su
propio repositorio, con changelog independiente.

> [!WARNING]
> En alpha. Funciona y está probada, pero no tiene rodaje en uso real. Como
> escribe sobre la misma base de datos que la web, conviene probarla contra una
> copia y mantener la web como sistema principal.

El servidor le sirve las actualizaciones: la app consulta si hay versión nueva,
verifica el checksum SHA-256 del instalador y **se niega a instalar si no puede
comprobarlo**.

---

## Instalación

### Requisitos

[![Docker](https://img.shields.io/badge/Docker-requerido-2496ED?style=flat-square&logo=docker&logoColor=white)](#)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](#)
[![Node](https://img.shields.io/badge/Node-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](#)
[![pnpm](https://img.shields.io/badge/pnpm-gestor-F69220?style=flat-square&logo=pnpm&logoColor=white)](#)

### Puesta en marcha

```bash
git clone https://github.com/Iampro1712/BD-Sist-Inv.git
cd BD-Sist-Inv

# Variables de entorno (ver plantillas para la lista completa)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

| Servicio | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| API | `http://localhost:8000/api` |
| Admin de Django | `http://localhost:8000/admin` |

<details>
<summary><b>Instalación manual, sin Docker</b></summary>

<br/>

**Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # completar antes de continuar
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

**Frontend**

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

</details>

<details>
<summary><b>Base de datos de pruebas</b></summary>

<br/>

El esquema es **híbrido**: parte lo creó Django y parte preexistía. Las migraciones
`0001`–`0004` describen un esquema antiguo que ya no existe, así que se marcan como
aplicadas sin ejecutarse.

```bash
# Postgres desechable
docker run -d --name inventrix-test -e POSTGRES_PASSWORD=postgres \
  -p 55439:5432 postgres:16

# Cargar el esquema base y aplicar migraciones reales
psql -h localhost -p 55439 -U postgres -c "CREATE DATABASE test_inventrix_ci;"
psql -h localhost -p 55439 -U postgres -d test_inventrix_ci \
  -f backend/SQL_FILES/000_base_schema_snapshot.sql

cd backend
DB_NAME=test_inventrix_ci python manage.py migrate inventory 0004 --fake
DB_NAME=test_inventrix_ci python manage.py migrate
python manage.py test --keepdb
```

</details>

<details>
<summary><b>Datos de demostración</b></summary>

<br/>

```bash
# Historial de ventas con estacionalidad real de Nicaragua
python manage.py seed_demanda_demo

# Compras con plazos de entrega variables para el análisis de proveedores
python manage.py seed_proveedores_demo

# Ambos aceptan --limpiar para revertir, y se niegan a correr
# contra producción sin --forzar.
```

</details>

---

## Seguridad

El sistema pasó por una auditoría de 10 hallazgos (v1.11.x) y una revisión de los
endpoints públicos (v1.12.x). Lo que hay hoy:

| Área | Implementación |
|---|---|
| **Autenticación** | JWT con rotación y lista de revocación. Todos los endpoints la exigen salvo los dos de actualización de la app de escritorio |
| **Autorización** | Roles dueño/operador. Los campos financieros se anulan por serializer para el operador, no se ocultan solo en la interfaz |
| **Fuerza bruta** | Límite de 5 intentos/min en login, con la identidad del cliente tomada de la entrada que agrega el proxy, no de la que manda el cliente |
| **Cifrado en reposo** | Fernet para datos de contacto y claves de IA, con claves separadas por propósito |
| **Integridad del dinero** | Transacciones atómicas con `SELECT FOR UPDATE` en stock, pagos y caja |
| **Auditoría** | Trigger de PostgreSQL que registra usuario, IP y snapshot JSONB de cada cambio |
| **Respaldos** | `pg_dump` verificado con `pg_restore --list` antes de darse por válido; excluye tablas de sesión y token |
| **Producción** | HSTS, cookies seguras, sin `DEBUG`, `SECRET_KEY` validada al arrancar y Redis obligatorio |

> [!IMPORTANT]
> Ninguna credencial, dominio ni clave vive en el repositorio. Todo se configura
> por variables de entorno; las plantillas `.env.example` documentan qué hace
> falta sin exponer valores.

---

## Calidad

[![Tests](https://img.shields.io/badge/316-tests-22C55E?style=for-the-badge&logo=pytest&logoColor=white)](#)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](./.github/workflows/backend-ci.yml)

Los tests corren contra **PostgreSQL real**, no SQLite: buena parte del sistema usa
SQL crudo, triggers y restricciones de la base, y nada de eso se comporta igual en
otro motor.

Cada migración se valida en un Postgres desechable antes de tocar producción:
cargar el esquema base, aplicar, revertir, reaplicar. La regla de la casa es que
**producción se toca con respaldo previo y confirmación explícita**, nunca en
automático.

---

## Documentación

| Documento | Contenido |
|---|---|
| [CHANGELOG](./CHANGELOG.md) | Historial de versiones en formato Keep a Changelog |
| [Auditoría del sistema](./AUDITORIA_SISTEMA.md) | Análisis de seguridad y correcciones |
| [Correcciones de seguridad](./FIXES_SEGURIDAD.md) | Detalle de los hallazgos resueltos |
| [Respaldos](./RESPALDOS.md) | Cómo generar y restaurar un respaldo |
| [Bitácora de servicios](./BITACORA_README.md) | Los 4 módulos del registro fotográfico |

---

## Estado del proyecto

**Implementado y en uso:** inventario con ubicaciones, punto de venta con lector,
caja por turnos, taller en Kanban con presupuestos, cuentas por cobrar y pagar,
devoluciones en ambos sentidos, garantías, rentabilidad, pronóstico de demanda,
análisis de proveedores, respaldos restaurables y auditoría por trigger.

**Deliberadamente fuera de alcance, por ahora:**

| No tiene | Por qué |
|---|---|
| Facturación fiscal / DGI | Un taller bajo régimen de cuota fija no la necesita hoy. Sería lo primero al pasar a régimen general |
| Multi-sucursal | Un solo local. Agregarlo antes de necesitarlo complica cada consulta del sistema |
| Modo sin conexión | Requiere resolución de conflictos, que es un problema mayor que el que resuelve |
| App móvil nativa | La web adaptable cubre el caso; una app nativa duplicaría el mantenimiento |

---

<div align="center">

<sub>

**Inventrix** · Construido para JC Motoshop, Managua

[Reportar un problema](https://github.com/Iampro1712/BD-Sist-Inv/issues) ·
[Changelog](./CHANGELOG.md)

</sub>

<sub>Última actualización: septiembre de 2026 · v1.14.0</sub>

</div>
