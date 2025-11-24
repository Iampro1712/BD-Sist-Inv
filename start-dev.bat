@echo off
echo 🚀 Iniciando Inventrix en modo desarrollo...

REM Verificar si Docker está corriendo
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker no está corriendo. Por favor inicia Docker Desktop.
    exit /b 1
)

REM Iniciar servicios con Docker Compose
echo 📦 Iniciando servicios con Docker Compose...
docker-compose up -d

echo ✅ Servicios iniciados!
echo.
echo 📍 URLs disponibles:
echo    Frontend: http://localhost:5173
echo    Backend API: http://localhost:8000
echo    Admin Django: http://localhost:8000/admin
echo.
echo 📝 Para ver los logs: docker-compose logs -f
echo 🛑 Para detener: docker-compose down
