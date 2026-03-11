# Dockerfile optimizado para frontend de Inventrix
FROM node:20-alpine

# Variables de entorno
ENV NODE_ENV=development

# Directorio de trabajo
WORKDIR /app

# Copiar package files primero para aprovechar cache de Docker
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Instalar dependencias
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install; fi

# Copiar código de la aplicación
COPY . .

# Exponer puerto de Vite
EXPOSE 5173

# Comando para desarrollo (con hot reload)
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
