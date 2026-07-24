#!/bin/bash
set -e

echo "🔍 Waiting for PostgreSQL..."

# Esperar a que PostgreSQL esté listo usando Python
python << END
import time
import sys
import psycopg2
import os

# Obtener credenciales de variables de entorno
db_name = os.getenv('DB_NAME', 'inventrix')
db_user = os.getenv('DB_USER', 'postgres')
db_password = os.getenv('DB_PASSWORD', 'postgres')
db_host = os.getenv('DB_HOST', 'db')
db_port = os.getenv('DB_PORT', '5432')

max_retries = 30
retry = 0

while retry < max_retries:
    try:
        conn = psycopg2.connect(
            database=db_name,
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port
        )
        conn.close()
        print("✅ PostgreSQL is ready!")
        sys.exit(0)
    except psycopg2.OperationalError as e:
        retry += 1
        print(f"⏳ Waiting for PostgreSQL... ({retry}/{max_retries})")
        time.sleep(1)

print("❌ Could not connect to PostgreSQL")
sys.exit(1)
END

echo "📦 Running migrations..."
python manage.py migrate --noinput

echo "📊 Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "👤 Creating superuser if not exists..."
python manage.py shell << END
from django.contrib.auth import get_user_model
import os
User = get_user_model()

# Credenciales desde variables de entorno. Usuario y contraseña son OBLIGATORIOS:
# NO se usa el usuario 'admin' por defecto (evita el usuario/clave típicos).
admin_username = os.getenv('DJANGO_SUPERUSER_USERNAME')
admin_email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'owner@inventrix.com')
admin_password = os.getenv('DJANGO_SUPERUSER_PASSWORD')

if not admin_username or not admin_password:
    print('⚠️  Define DJANGO_SUPERUSER_USERNAME y DJANGO_SUPERUSER_PASSWORD para crear el usuario dueño.')
    print('    Se omite la creación del superusuario (no se crea "admin" por defecto).')
elif not User.objects.filter(username=admin_username).exists():
    User.objects.create_superuser(admin_username, admin_email, admin_password)
    print(f'✅ Superuser created (username: {admin_username})')
    print('⚠️  IMPORTANTE: Cambia la contraseña después del primer login!')
else:
    print('ℹ️  Superuser already exists')
END

echo "🚀 Starting Gunicorn server..."
exec gunicorn inventrix.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
