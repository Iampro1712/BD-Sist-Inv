# Guía de Deployment - Inventrix

## Variables de Entorno Requeridas

### Backend (Django)

```env
# Configuración básica
DEBUG=False
SECRET_KEY=your-super-secret-key-here-min-50-chars
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,api.yourdomain.com

# Base de datos
DB_NAME=inventrix
DB_USER=inventrix_user
DB_PASSWORD=secure-database-password
DB_HOST=db
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Frontend (React + Vite)

```env
VITE_API_URL=https://api.yourdomain.com/api
```

## Deployment con Docker Compose

### Desarrollo

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar variables de entorno
nano .env

# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

### Producción

```bash
# Usar docker-compose de producción
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Detener servicios
docker-compose -f docker-compose.prod.yml down
```

## Deployment en Dokploy

### 1. Preparación

1. Crear un nuevo proyecto en Dokploy
2. Conectar el repositorio de GitHub
3. Seleccionar la rama principal (main/master)

### 2. Configuración de Servicios

#### Base de Datos (PostgreSQL)

- Tipo: PostgreSQL 15
- Variables de entorno:
  - `POSTGRES_DB`: inventrix
  - `POSTGRES_USER`: inventrix_user
  - `POSTGRES_PASSWORD`: [generar contraseña segura]

#### Backend (Django)

- Tipo: Application
- Dockerfile: `backend/Dockerfile`
- Puerto: 8000
- Variables de entorno:
  - `DEBUG`: False
  - `SECRET_KEY`: [generar clave secreta]
  - `DB_NAME`: inventrix
  - `DB_USER`: inventrix_user
  - `DB_PASSWORD`: [misma que la base de datos]
  - `DB_HOST`: [nombre del servicio de base de datos]
  - `DB_PORT`: 5432
  - `ALLOWED_HOSTS`: [tu dominio]
  - `CORS_ALLOWED_ORIGINS`: [tu dominio frontend]

#### Frontend (React)

- Tipo: Application
- Dockerfile: `frontend/Dockerfile.prod`
- Puerto: 80
- Variables de entorno:
  - `VITE_API_URL`: [URL de tu API backend]

### 3. Configuración de Dominio

1. Configurar dominio principal para el frontend
2. Configurar subdominio `api.` para el backend
3. Habilitar SSL/TLS automático

### 4. Health Checks

- Backend: `GET /api/`
- Frontend: `GET /health`

### 5. Comandos Post-Deployment

```bash
# Ejecutar migraciones (automático en docker-entrypoint.sh)
python manage.py migrate

# Crear superusuario (automático en docker-entrypoint.sh)
# Usuario: admin
# Password: admin123 (cambiar después del primer login)

# Recolectar archivos estáticos (automático en Dockerfile)
python manage.py collectstatic --noinput
```

## Generar SECRET_KEY

```python
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

## Configuración de CORS

Asegúrate de que `CORS_ALLOWED_ORIGINS` incluya:
- Tu dominio principal (https://yourdomain.com)
- Subdominios si los usas (https://www.yourdomain.com)
- NO incluir trailing slashes

## Backup de Base de Datos

```bash
# Backup
docker-compose exec db pg_dump -U inventrix_user inventrix > backup.sql

# Restore
docker-compose exec -T db psql -U inventrix_user inventrix < backup.sql
```

## Logs

```bash
# Ver logs del backend
docker-compose logs -f backend

# Ver logs del frontend
docker-compose logs -f frontend

# Ver logs de la base de datos
docker-compose logs -f db

# Logs dentro del contenedor
docker-compose exec backend tail -f logs/error.log
docker-compose exec backend tail -f logs/api.log
```

## Troubleshooting

### Error de conexión a la base de datos

1. Verificar que el servicio de base de datos esté corriendo
2. Verificar las credenciales en las variables de entorno
3. Verificar que `DB_HOST` apunte al nombre correcto del servicio

### Error de CORS

1. Verificar que `CORS_ALLOWED_ORIGINS` incluya el dominio del frontend
2. No incluir trailing slashes en las URLs
3. Usar HTTPS en producción

### Error 502 Bad Gateway

1. Verificar que el backend esté corriendo
2. Verificar los logs del backend
3. Verificar que Gunicorn esté iniciado correctamente

## Monitoreo

- Logs de aplicación: `/app/logs/`
- Logs de Gunicorn: stdout/stderr
- Health checks: Configurados en Dokploy

## Escalabilidad

Para escalar horizontalmente:

```yaml
# En docker-compose.prod.yml
backend:
  deploy:
    replicas: 3
```

## Seguridad

- ✅ DEBUG=False en producción
- ✅ SECRET_KEY único y seguro
- ✅ HTTPS habilitado
- ✅ CORS configurado correctamente
- ✅ Contraseñas seguras para base de datos
- ✅ Cambiar contraseña del superusuario después del primer login
