# 📁 Documentación de Estructura del Proyecto Inventrix

## 📋 Tabla de Contenidos
- [Backend](#backend)
- [Frontend](#frontend)
- [Archivos de Configuración](#archivos-de-configuración)
- [Scripts SQL](#scripts-sql)

---

## 🔧 BACKEND

### 📂 `/backend`

#### **Archivos de Configuración**

- **`manage.py`**
  - Script principal de Django para ejecutar comandos
  - Usado para: migraciones, servidor de desarrollo, crear superusuario
  - Ejemplo: `python manage.py runserver`

- **`requirements.txt`**
  - Lista de dependencias de Python necesarias
  - Incluye: Django, Django REST Framework, psycopg2, boto3, etc.
  - Instalar con: `pip install -r requirements.txt`

- **`.env`**
  - Variables de entorno sensibles (NO subir a Git)
  - Contiene: credenciales de base de datos, claves API, configuración de R2
  - Ejemplo: `DATABASE_URL`, `SECRET_KEY`, `R2_ACCESS_KEY`

- **`.env.example`**
  - Plantilla de variables de entorno
  - Muestra qué variables se necesitan sin exponer valores reales

- **`Dockerfile`**
  - Instrucciones para crear imagen Docker del backend
  - Define: imagen base Python, dependencias, comandos de inicio

- **`.dockerignore`**
  - Archivos que Docker debe ignorar al construir la imagen
  - Excluye: venv, __pycache__, .env, archivos temporales

- **`docker-entrypoint.sh`**
  - Script que se ejecuta al iniciar el contenedor Docker
  - Realiza: migraciones, collectstatic, inicia servidor

---

### 📂 `/backend/inventrix` (Configuración del Proyecto Django)

- **`settings.py`**
  - Configuración principal de Django
  - Define: base de datos, apps instaladas, middleware, CORS, archivos estáticos
  - Configuración de seguridad y variables de entorno

- **`urls.py`**
  - Rutas principales del proyecto
  - Conecta URLs con las apps (api, inventory)
  - Ejemplo: `/api/` → app api, `/admin/` → panel de administración

- **`wsgi.py`**
  - Punto de entrada para servidores WSGI (producción)
  - Usado por: Gunicorn, uWSGI

- **`asgi.py`**
  - Punto de entrada para servidores ASGI (WebSockets, async)
  - Para aplicaciones en tiempo real

---

### 📂 `/backend/api` (App Principal de la API)

#### **Archivos Core**

- **`models.py`**
  - Define modelos de base de datos (actualmente vacío, usa inventory)
  - Aquí irían modelos específicos de la API

- **`views.py`**
  - Vistas/endpoints de la API REST
  - Maneja: CRUD de productos, clientes, órdenes, motos, servicios
  - Endpoints para: reportes, dashboard, búsqueda global

- **`serializers.py`**
  - Convierte modelos Django a JSON y viceversa
  - Valida datos de entrada
  - Define qué campos se exponen en la API

- **`urls.py`**
  - Define rutas específicas de la API
  - Mapea URLs a vistas
  - Ejemplo: `/api/productos/`, `/api/clientes/`

- **`services.py`**
  - Lógica de negocio separada de las vistas
  - Funciones reutilizables para operaciones complejas
  - Ejemplo: cálculos de inventario, generación de reportes

#### **Manejo de Errores**

- **`exceptions.py`**
  - Excepciones personalizadas del proyecto
  - Ejemplo: `ProductoNoEncontrado`, `StockInsuficiente`

- **`exception_handler.py`**
  - Maneja errores globalmente
  - Formatea respuestas de error consistentes
  - Registra errores en logs

- **`middleware.py`**
  - Código que se ejecuta en cada request/response
  - Funciones: logging, autenticación, manejo de errores

#### **Almacenamiento**

- **`storage.py`**
  - Configuración de almacenamiento en Cloudflare R2
  - Maneja subida de imágenes de bitácora de motos
  - Funciones: upload, delete, get_url

#### **Migraciones**

- **`/migrations/`**
  - Historial de cambios en la base de datos
  - Generadas automáticamente por Django
  - Aplicar con: `python manage.py migrate`

---

### 📂 `/backend/inventory` (App de Modelos de Inventario)

- **`models.py`**
  - Define TODOS los modelos de la base de datos:
    - `Producto`: productos del inventario
    - `Cliente`: clientes del negocio
    - `Proveedor`: proveedores
    - `Moto`: motos de clientes
    - `ServicioMoto`: servicios realizados a motos
    - `BitacoraServicio`: registro con imágenes de servicios
    - `OrdenCompra`, `OrdenVenta`: órdenes de compra/venta
    - `MovimientoInventario`: entradas/salidas de stock
    - `Categoria`, `Marca`: clasificación de productos

- **`admin.py`**
  - Configuración del panel de administración de Django
  - Define cómo se muestran los modelos en `/admin/`

- **`apps.py`**
  - Configuración de la app inventory

- **`/migrations/`**
  - Migraciones específicas de inventory

---

### 📂 `/backend/logs`

- **`api.log`**
  - Registro de todas las peticiones a la API
  - Incluye: timestamp, método, URL, respuesta

- **`error.log`**
  - Registro de errores del sistema
  - Útil para debugging en producción

---

### 📂 Scripts de Base de Datos

- **`create_tables.py`**
  - Script para crear tablas iniciales en PostgreSQL
  - Ejecuta SQL directamente en la base de datos

- **`create_motos_tables.sql`**
  - SQL para crear tablas de motos y servicios
  - Incluye: índices, foreign keys, comentarios

- **`create_bitacora_table.py`**
  - Crea tabla de bitácora de servicios con soporte JSONB

- **`populate_clientes_motos.py`**
  - Script para poblar datos de prueba
  - Crea clientes y motos de ejemplo

- **`ver_datos_clientes_motos.py`**
  - Script para visualizar datos de clientes y motos
  - Útil para verificar datos en la base de datos

- **`check_tables.py`**
  - Verifica que las tablas existan en la base de datos

- **`setup_bitacora.py`**
  - Configuración inicial de la tabla bitácora

- **`test_r2_connection.py`**
  - Prueba conexión con Cloudflare R2

- **`test_r2_upload.py`**
  - Prueba subida de archivos a R2

---

## 🎨 FRONTEND

### 📂 `/frontend`

#### **Archivos de Configuración**

- **`package.json`**
  - Dependencias de Node.js
  - Scripts: `dev`, `build`, `preview`
  - Incluye: React, React Router, Axios, Tailwind CSS

- **`pnpm-lock.yaml`**
  - Lockfile de pnpm (gestor de paquetes)
  - Asegura versiones consistentes

- **`vite.config.js`**
  - Configuración de Vite (build tool)
  - Define: puerto, proxy, optimizaciones

- **`.env`**
  - Variables de entorno del frontend
  - Ejemplo: `VITE_API_URL=http://localhost:8000`

- **`.env.example`**
  - Plantilla de variables de entorno

- **`Dockerfile`**
  - Imagen Docker para el frontend
  - Build de producción con Nginx

- **`.dockerignore`**
  - Archivos ignorados por Docker

- **`eslint.config.js` / `.eslintrc.cjs`**
  - Configuración de ESLint (linter de JavaScript)
  - Define reglas de código

- **`postcss.config.js`**
  - Configuración de PostCSS (procesador CSS)
  - Usado por Tailwind CSS

- **`tailwind.config.js`**
  - Configuración de Tailwind CSS
  - Define: colores, fuentes, breakpoints personalizados

- **`index.html`**
  - Punto de entrada HTML
  - Carga el script principal de React

---

### 📂 `/frontend/src`

#### **Archivos Principales**

- **`main.jsx`**
  - Punto de entrada de React
  - Renderiza la app en el DOM
  - Configura React Router

- **`App.jsx`**
  - Componente raíz de la aplicación
  - Define rutas principales
  - Incluye: Navbar, rutas, ErrorBoundary

- **`App.css`**
  - Estilos específicos del componente App

- **`index.css`**
  - Estilos globales
  - Importa Tailwind CSS
  - Define variables CSS personalizadas

---

### 📂 `/frontend/src/pages` (Páginas/Vistas)

- **`Dashboard.jsx`**
  - Página principal con estadísticas
  - Muestra: productos bajo stock, ventas recientes, métricas

- **`Productos.jsx`**
  - Lista y gestión de productos
  - CRUD completo: crear, editar, eliminar, buscar

- **`Clientes.jsx`**
  - Gestión de clientes
  - Incluye: lista, formulario, detalles, motos asociadas

- **`Proveedores.jsx`**
  - Gestión de proveedores
  - CRUD de proveedores

- **`Categorias.jsx`**
  - Gestión de categorías de productos

- **`OrdenesCompra.jsx`**
  - Lista de órdenes de compra
  - Crear nuevas órdenes, ver detalles

- **`OrdenesVenta.jsx`**
  - Lista de órdenes de venta
  - Gestión de ventas a clientes

- **`Movimientos.jsx`**
  - Historial de movimientos de inventario
  - Entradas, salidas, ajustes

- **`Reportes.jsx`**
  - Generación de reportes
  - Exportar a Excel/PDF
  - Reportes de: ventas, inventario, rentabilidad

- **`NotFound.jsx`**
  - Página 404 cuando la ruta no existe

---

### 📂 `/frontend/src/components`

#### **📂 `/components/layout` (Estructura)**

- **`Navbar.jsx`**
  - Barra de navegación superior
  - Logo, menú, búsqueda global

- **`BottomNav.jsx`**
  - Navegación inferior para móviles
  - Acceso rápido a secciones principales

- **`GlobalSearch.jsx`**
  - Búsqueda global en toda la app
  - Busca en: productos, clientes, órdenes

#### **📂 `/components/ui` (Componentes Reutilizables)**

- **`Button.jsx`**
  - Botón personalizado con variantes
  - Tipos: primary, secondary, danger

- **`Card.jsx`**
  - Tarjeta contenedora

- **`Modal.jsx`**
  - Modal/diálogo reutilizable
  - Para formularios y confirmaciones

- **`ConfirmDialog.jsx`**
  - Diálogo de confirmación
  - Para acciones destructivas (eliminar)

- **`DataTable.jsx`**
  - Tabla de datos con paginación, ordenamiento, búsqueda
  - Componente más usado en el proyecto

- **`Input.jsx`**
  - Input de texto personalizado

- **`Select.jsx`**
  - Select/dropdown personalizado

- **`Badge.jsx`**
  - Etiqueta de estado
  - Ejemplo: "Activo", "Bajo Stock"

- **`StatCard.jsx`**
  - Tarjeta de estadística para dashboard
  - Muestra: número, título, icono

- **`Loader.jsx`**
  - Spinner de carga

- **`PageLoader.jsx`**
  - Loader de página completa

- **`Skeleton.jsx`**
  - Placeholder mientras carga contenido

- **`Toast.jsx`**
  - Notificaciones temporales
  - Tipos: success, error, info, warning

- **`EmptyState.jsx`**
  - Estado vacío cuando no hay datos

- **`ErrorState.jsx`**
  - Estado de error con opción de reintentar

- **`SimpleChart.jsx`**
  - Gráfico simple para reportes

#### **📂 `/components/forms` (Formularios)**

- **`ProductoForm.jsx`**
  - Formulario para crear/editar productos

- **`ClienteForm.jsx`**
  - Formulario de clientes

- **`ProveedorForm.jsx`**
  - Formulario de proveedores

- **`MotoForm.jsx`**
  - Formulario para registrar motos de clientes

- **`ServicioMotoForm.jsx`**
  - Formulario para servicios de motos

- **`BitacoraForm.jsx`**
  - Formulario de bitácora con subida de imágenes

- **`OrdenCompraForm.jsx`**
  - Formulario de órdenes de compra

- **`OrdenVentaForm.jsx`**
  - Formulario de órdenes de venta

- **`FormField.jsx`**
  - Campo de formulario reutilizable

- **`NumberInput.jsx`**
  - Input numérico con validación

- **`DateRangePicker.jsx`**
  - Selector de rango de fechas

- **`SearchBar.jsx`**
  - Barra de búsqueda reutilizable

#### **📂 `/components/clientes`**

- **`ClienteDetalle.jsx`**
  - Vista detallada de un cliente
  - Muestra: info, motos, historial de compras

#### **📂 `/components/productos`**

- **`ProductoDetalle.jsx`**
  - Vista detallada de un producto
  - Muestra: info, stock, movimientos

#### **📂 `/components/proveedores`**

- **`ProveedorDetalle.jsx`**
  - Vista detallada de un proveedor

#### **📂 `/components/ordenes`**

- **`OrdenCompraDetalle.jsx`**
  - Detalle de orden de compra

- **`OrdenVentaDetalle.jsx`**
  - Detalle de orden de venta

#### **📂 `/components/motos`**

- **`BitacoraViewer.jsx`**
  - Visualizador de bitácora de servicios
  - Muestra imágenes y detalles

- **`ServicioConBitacora.jsx`**
  - Componente que combina servicio y bitácora

#### **Otros Componentes**

- **`ErrorBoundary.jsx`**
  - Captura errores de React
  - Evita que la app se rompa completamente

- **`ScrollToTop.jsx`**
  - Scroll automático al cambiar de página

---

### 📂 `/frontend/src/services`

- **`api.js`**
  - Cliente HTTP con Axios
  - Configuración de base URL, interceptores
  - Funciones para todas las llamadas a la API:
    - Productos: `getProductos()`, `createProducto()`, etc.
    - Clientes: `getClientes()`, `updateCliente()`, etc.
    - Órdenes, reportes, dashboard, etc.

---

### 📂 `/frontend/src/hooks` (Custom Hooks)

- **`useClientes.js`**
  - Hook para gestionar estado de clientes
  - Incluye: fetch, create, update, delete

- **`useProveedores.js`**
  - Hook para proveedores

- **`useCategorias.js`**
  - Hook para categorías

- **`useDebounce.js`**
  - Hook para debounce (retrasar ejecución)
  - Útil para búsquedas en tiempo real

---

### 📂 `/frontend/src/utils`

- **`exportReportes.js`**
  - Funciones para exportar datos
  - Formatos: Excel, PDF, CSV
  - Usa librerías: xlsx, jspdf

- **`formatters.js`**
  - Funciones de formateo
  - Ejemplo: formatear moneda, fechas, números

- **`validators.js`**
  - Validaciones de formularios
  - Ejemplo: validar email, teléfono, SKU

---

### 📂 `/frontend/src/contexts`

- **`AuthContext.jsx`**
  - Contexto de autenticación
  - Maneja: login, logout, usuario actual

- **`ThemeContext.jsx`**
  - Contexto de tema (claro/oscuro)

---

## 📄 ARCHIVOS DE CONFIGURACIÓN RAÍZ

### Docker

- **`docker-compose.yml`**
  - Orquestación de contenedores para desarrollo
  - Define: backend, frontend, postgres, nginx

- **`docker-compose.prod.yml`**
  - Configuración para producción

### Deployment

- **`vercel.json`**
  - Configuración de Vercel (hosting frontend)
  - Define: rutas, rewrites, headers

- **`dokploy.json`**
  - Configuración de Dokploy (deployment)

- **`.vercelignore`**
  - Archivos ignorados por Vercel

### Git

- **`.gitignore`**
  - Archivos que Git debe ignorar
  - Incluye: node_modules, venv, .env, logs

---

## 📊 SCRIPTS SQL

### Archivos SQL en la Raíz

- **`7_script_sql.sql`**
  - Script SQL general del proyecto

- **`8_consultas_sql.sql`**
  - Consultas SQL de ejemplo

- **`9_procedimiento_reporte_rentabilidad.sql`**
  - Procedimiento almacenado para reporte de rentabilidad (PostgreSQL)
  - Calcula: márgenes, rotación, ranking de productos

- **`10_procedimiento_reporte_rentabilidad_sqlserver.sql`**
  - Mismo procedimiento pero para SQL Server

- **`11_trigger_auditoria_precios.sql`**
  - Trigger para auditar cambios de precios
  - Aumenta automáticamente 15% productos entre C$100-500

---

## 📚 DOCUMENTACIÓN

- **`README.md`**
  - Documentación principal del proyecto
  - Instrucciones de instalación y uso

- **`API_DOCS.md`**
  - Documentación de la API REST
  - Endpoints, parámetros, ejemplos

- **`CONTRIBUTING.md`**
  - Guía para contribuir al proyecto

- **`DEPLOYMENT.md`**
  - Guía de deployment

- **`BITACORA_README.md`**
  - Documentación específica del módulo de bitácora

- **`ESTRUCTURA_PROYECTO.md`** (este archivo)
  - Documentación completa de la estructura

---

## 🔄 Flujo de Trabajo

### Backend
1. Request llega a `urls.py`
2. Se ejecuta `middleware.py`
3. Llega a `views.py`
4. Usa `serializers.py` para validar
5. Ejecuta lógica en `services.py`
6. Accede a `models.py` (base de datos)
7. Retorna respuesta JSON

### Frontend
1. Usuario interactúa con página (`/pages`)
2. Componente usa hook (`/hooks`)
3. Hook llama a `api.js`
4. `api.js` hace request al backend
5. Respuesta actualiza estado
6. Componente se re-renderiza

---

## 🛠️ Comandos Útiles

### Backend
```bash
# Instalar dependencias
pip install -r requirements.txt

# Migraciones
python manage.py makemigrations
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Ejecutar servidor
python manage.py runserver
```

### Frontend
```bash
# Instalar dependencias
pnpm install

# Desarrollo
pnpm dev

# Build producción
pnpm build

# Preview build
pnpm preview
```

### Docker
```bash
# Levantar todo
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## 📝 Notas Importantes

1. **Nunca subir archivos `.env` a Git**
2. **Siempre usar `.env.example` como plantilla**
3. **Logs están en `/backend/logs`**
4. **Imágenes se almacenan en Cloudflare R2, no en servidor**
5. **Frontend usa Vite (más rápido que Create React App)**
6. **Backend usa Django REST Framework**
7. **Base de datos: PostgreSQL**

---

**Última actualización:** 2026
**Versión:** 1.0
