#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
# Usar Python para verificar la conexión en lugar de nc
python << END
import time
import sys
import psycopg2
from urllib.parse import urlparse
import os

db_url = os.getenv('DATABASE_URL', '')
if db_url:
    result = urlparse(db_url)
    max_retries = 30
    retry = 0
    while retry < max_retries:
        try:
            conn = psycopg2.connect(
                database=result.path[1:],
                user=result.username,
                password=result.password,
                host=result.hostname,
                port=result.port
            )
            conn.close()
            print("PostgreSQL is ready!")
            sys.exit(0)
        except psycopg2.OperationalError:
            retry += 1
            time.sleep(1)
    print("Could not connect to PostgreSQL")
    sys.exit(1)
END

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating superuser if not exists..."
python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@inventrix.com', 'admin123')
    print('Superuser created')
else:
    print('Superuser already exists')
END

echo "Starting Gunicorn..."
exec gunicorn inventrix.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 60 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
