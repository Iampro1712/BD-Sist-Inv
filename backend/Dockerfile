# Dockerfile optimizado para backend de Inventrix
FROM python:3.11-slim

# Variables de entorno para optimización
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias para PostgreSQL y Pillow
#
# postgresql-client trae pg_dump y pg_restore, que son lo que hace que el
# respaldo sea restaurable: sin ellos el sistema solo puede volcar los datos a
# JSON, sin esquema ni secuencias ni disparadores, y eso no vuelve a levantar la
# base por sí solo (ver api/backup_pg.py).
#
# Se usa el paquete de la distribución en vez de fijar la versión del servidor:
# pg_dump puede volcar de servidores más viejos que él, así que un cliente nuevo
# sirve para el Postgres actual y para futuras actualizaciones. Al revés no: un
# cliente más viejo que el servidor se niega a volcar, y el comando de respaldo
# comprueba eso y avisa qué hacer.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    postgresql-client \
    libjpeg62-turbo \
    libpng16-16 \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero para aprovechar cache de Docker
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar script de entrypoint y darle permisos
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copiar código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p logs staticfiles media

# Exponer puerto
EXPOSE 8000

# Usar el script de entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
