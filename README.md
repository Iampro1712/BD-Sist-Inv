# 📦 Inventrix - Sistema de Gestión de Inventario

<div align="center">

![Inventrix Logo](https://img.shields.io/badge/Inventrix-Sistema%20de%20Inventario-blue?style=for-the-badge)

**Una solución moderna, completa y eficiente para la gestión integral de inventarios**

[![Django](https://img.shields.io/badge/Django-5.1.4-green?style=flat-square&logo=django)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Características](#-características-principales) • [Instalación](#-instalación-rápida) • [Documentación](#-documentación) • [Contribuir](#-contribuir)

</div>

---

## 🎯 ¿Por qué Inventrix?

En el mundo empresarial actual, la gestión eficiente del inventario es crucial para el éxito de cualquier negocio. **Inventrix** nace de la necesidad de proporcionar a pequeñas y medianas empresas una herramienta profesional, accesible y fácil de usar que les permita:

- **Controlar su inventario en tiempo real** sin complicaciones técnicas
- **Optimizar sus procesos** de compra y venta
- **Tomar decisiones informadas** basadas en datos y reportes detallados
- **Reducir costos** al evitar pérdidas por desabastecimiento o sobrestock
- **Mejorar la experiencia del cliente** con información precisa y actualizada

### 💡 La Historia Detrás del Proyecto

Inventrix fue desarrollado observando las dificultades que enfrentan los negocios locales en Nicaragua y Latinoamérica para gestionar su inventario. Muchas empresas aún dependen de hojas de cálculo, cuadernos o sistemas obsoletos que no se adaptan a sus necesidades reales.

Este proyecto busca democratizar el acceso a herramientas de gestión empresarial de calidad, proporcionando una solución:

- **Adaptable**: Diseñado para crecer con tu negocio
- **Intuitiva**: Interfaz moderna que cualquiera puede usar
- **Completa**: Desde productos hasta reportes avanzados
- **Local First**: Pensado para las necesidades de negocios latinoamericanos

---

## ✨ Características Principales

### 📊 Gestión Integral de Inventario

- **Control de Productos**
  - Registro completo con SKU, códigos de barras y descripciones
  - Gestión de stock actual, mínimo y máximo
  - Precios de compra y venta diferenciados
  - Seguimiento de ubicaciones físicas
  - Imágenes y documentación adjunta

- **Categorización Inteligente**
  - Organización por categorías personalizables
  - Búsqueda y filtrado avanzado
  - Etiquetas y clasificaciones múltiples

### 🛒 Gestión de Compras

- **Órdenes de Compra**
  - Creación y seguimiento de órdenes
  - Estados: Pendiente, Recibida, Cancelada
  - Cálculo automático de totales
  - Historial completo de compras

- **Gestión de Proveedores**
  - Base de datos completa de proveedores
  - Información de contacto y términos comerciales
  - Historial de transacciones
  - Evaluación de desempeño

### 💰 Gestión de Ventas

- **Órdenes de Venta**
  - Proceso de venta rápido e intuitivo
  - Múltiples productos por orden
  - Cálculo automático de totales
  - Actualización automática de inventario

- **Gestión de Clientes**
  - Registro completo de clientes
  - Historial de compras
  - Información de contacto y facturación
  - Análisis de comportamiento
  - Registros de sus motos y sus servicios

### 📈 Reportes y Análisis

- **Reportes de Inventario**
  - Estado actual del inventario
  - Productos con stock bajo o agotados
  - Valorización del inventario
  - Distribución por categorías

- **Reportes de Ventas**
  - Ventas por período
  - Análisis por cliente
  - Ticket promedio
  - Tendencias y proyecciones

- **Reportes de Compras**
  - Compras por período
  - Análisis por proveedor
  - Costos y márgenes
  - Comparativas

- **Productos Más Vendidos**
  - Top productos por cantidad
  - Top productos por ingresos
  - Análisis de rotación
  - Recomendaciones de reorden

### 📄 Exportación de Datos

- **Múltiples Formatos**
  - Exportación a PDF profesional
  - Exportación a Excel (.xlsx)
  - Formato optimizado para impresión
  - Datos listos para análisis

### 🎨 Experiencia de Usuario

- **Interfaz Moderna**
  - Diseño limpio y profesional
  - Modo oscuro completo
  - Responsive (móvil, tablet, desktop)
  - Animaciones fluidas

- **Búsqueda Global**
  - Búsqueda instantánea en todo el sistema
  - Atajo de teclado (Ctrl + /)
  - Resultados en tiempo real
  - Navegación rápida

- **Notificaciones**
  - Feedback inmediato de acciones
  - Alertas de stock bajo
  - Confirmaciones de operaciones
  - Mensajes de error claros

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

**Backend**
- **Django 5.1.4**: Framework web robusto y escalable
- **Django REST Framework**: API RESTful completa
- **PostgreSQL 16**: Base de datos relacional potente
- **Python 3.11+**: Lenguaje moderno y eficiente

**Frontend**
- **React 18.3**: Librería UI moderna y reactiva
- **Vite**: Build tool ultra rápido
- **TailwindCSS**: Estilos utility-first
- **Framer Motion**: Animaciones fluidas
- **React Query**: Gestión de estado del servidor
- **Zustand**: Gestión de estado global
- **Recharts**: Gráficos y visualizaciones
- **Axios**: Cliente HTTP

**Herramientas de Desarrollo**
- **Docker & Docker Compose**: Containerización
- **ESLint**: Linting de código
- **Prettier**: Formateo de código

### Principios de Diseño

1. **Separación de Responsabilidades**: Backend y frontend completamente desacoplados
2. **API First**: Toda la lógica de negocio expuesta vía API REST
3. **Componentización**: Componentes reutilizables y modulares
4. **Performance**: Optimización de queries y carga lazy
5. **Seguridad**: Validación en backend, sanitización de inputs
6. **Escalabilidad**: Arquitectura preparada para crecer

---

## 🚀 Instalación Rápida

### Prerrequisitos

- **Docker** y **Docker Compose** instalados
- **Git** para clonar el repositorio
- **4GB RAM** mínimo recomendado
- **Puerto 3000** (frontend) y **8000** (backend) disponibles

### Instalación con Docker (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/inventrix.git
cd inventrix

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 3. Iniciar los servicios
docker-compose up -d

# 4. Ejecutar migraciones
docker-compose exec backend python manage.py migrate

# 5. Crear superusuario (opcional)
docker-compose exec backend python manage.py createsuperuser

# 6. Acceder a la aplicación
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Admin Django: http://localhost:8000/admin
```

### Instalación Manual

<details>
<summary>Click para ver instrucciones de instalación manual</summary>

**Backend**

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar base de datos
# Editar backend/.env con tus credenciales de PostgreSQL

# Ejecutar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Iniciar servidor
python manage.py runserver
```

**Frontend**

```bash
cd frontend

# Instalar dependencias (con pnpm)
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

</details>

---

## 📚 Documentación

- **[API Documentation](./API_DOCS.md)**: Documentación completa de todos los endpoints
- **[Deployment Guide](./DEPLOYMENT.md)**: Guía detallada de despliegue en producción
- **[Contributing Guide](./CONTRIBUTING.md)**: Cómo contribuir al proyecto

---

## 🎯 Casos de Uso

### Pequeños Negocios
- Tiendas de barrio
- Ferreterías
- Farmacias
- Librerías
- Tiendas de ropa

### Negocios Medianos
- Distribuidoras
- Mayoristas
- Cadenas de tiendas
- Talleres mecánicos
- Restaurantes

### Casos Específicos
- Control de inventario multi-sucursal
- Gestión de productos perecederos
- Seguimiento de garantías
- Control de consignaciones

---

## 🌟 Roadmap

### Versión 2.0 (Próximamente)
- [ ] Multi-sucursal / Multi-almacén
- [ ] Códigos de barras y QR
- [ ] Integración con balanzas y lectores
- [ ] App móvil nativa
- [ ] Sincronización offline

### Versión 2.5
- [ ] Facturación electrónica
- [ ] Integración con sistemas contables
- [ ] API pública para integraciones
- [ ] Módulo de producción
- [ ] Control de lotes y series

### Versión 3.0
- [ ] Inteligencia artificial para predicciones
- [ ] Recomendaciones automáticas de reorden
- [ ] Análisis predictivo de demanda
- [ ] Optimización de rutas de entrega

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Este proyecto existe gracias a todas las personas que contribuyen.

Lee nuestra [Guía de Contribución](./CONTRIBUTING.md) para conocer cómo puedes ayudar.

### Formas de Contribuir

- 🐛 Reportar bugs
- 💡 Sugerir nuevas características
- 📝 Mejorar la documentación
- 🔧 Enviar pull requests
- ⭐ Dar una estrella al proyecto
- 📢 Compartir con otros

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 👥 Autores

- **Edu Dev** - *Desarrollo Inicial* - [@Iampro1712](https://github.com/Iampro1712)

---

## 🙏 Agradecimientos

- A la comunidad de Django y React por sus excelentes herramientas
- A todos los contribuidores que hacen posible este proyecto
- A las empresas que confían en Inventrix para gestionar su inventario

---

## 📞 Soporte y Contacto

- **Issues**: [GitHub Issues](https://github.com/Iampro1712/BD-Sist-Inv/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/Iampro1712/BD-Sist-Inv/discussions)
- **Email**: master_bc@icloud.com

---

<div align="center">

**⭐ Si este proyecto te ha sido útil, considera darle una estrella ⭐**

Hecho con ❤️ para la comunidad

24 De Noviembre 2025

</div>
