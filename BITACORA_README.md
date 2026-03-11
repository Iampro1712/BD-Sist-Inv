# 📋 Bitácora de Servicios con Cloudflare R2

Sistema completo de bitácora para servicios de motos con almacenamiento de imágenes en Cloudflare R2.

## 🎯 Funcionalidad

La bitácora permite llevar un registro detallado de cada servicio de moto a través de 4 módulos:

### 1. 📥 Recepción
- Estado inicial de la moto
- Nivel de gasolina
- Rayones previos
- **Fotos**: Cómo entra el vehículo al taller (protección contra reclamos)

### 2. 🔍 Diagnóstico
- Notas del mecánico sobre las fallas encontradas
- **Fotos**: Piezas rotas o desgastadas para mostrarle al cliente

### 3. 🔧 Reparación
- Registro cronológico de qué técnico hizo qué ajuste
- Trabajo realizado
- Técnico responsable
- **Fotos**: Del proceso o de las refacciones nuevas instaladas

### 4. ✅ Entrega
- Confirmación de servicio terminado
- Checklist de salida
- Firma del cliente
- **Foto**: Final de la moto lista o del comprobante firmado

## 🚀 Instalación

### Backend

1. Instalar dependencias y crear tabla:
```bash
cd backend
python setup_bitacora.py
```

2. Verificar variables de entorno en `backend/.env`:
```env
R2_ACCESS_KEY_ID=80a6da5a19b8faa7aa31a7d76a774eed
R2_SECRET_ACCESS_KEY=21e8dc4b18980c9bbaf6640d9ff2c77f1a96d9c801a54bfc450566c81924b6a7
R2_BUCKET_NAME=inventrix-eclipze
R2_PUBLIC_URL=https://cdn.eclipze.dev
```

3. Reiniciar el servidor:
```bash
python manage.py runserver
```

### Frontend

No requiere instalación adicional. Los componentes ya están integrados.

## 📁 Estructura de Archivos

### Backend
```
backend/
├── api/
│   ├── storage.py                    # Servicio de Cloudflare R2
│   ├── create_bitacora_table.sql     # Script SQL para crear tabla
│   ├── serializers.py                # Serializers de bitácora
│   ├── views.py                      # ViewSets de bitácora
│   └── urls.py                       # Rutas de API
├── inventory/
│   └── models.py                     # Modelo BitacoraServicio
├── create_bitacora_table.py          # Script para crear tabla
└── setup_bitacora.py                 # Script de configuración
```

### Frontend
```
frontend/src/
├── components/
│   ├── forms/
│   │   └── BitacoraForm.jsx          # Formulario para agregar registros
│   └── motos/
│       ├── BitacoraViewer.jsx        # Visualizador de bitácora
│       └── ServicioConBitacora.jsx   # Modal principal
├── hooks/
│   └── useBitacora.js                # Hook para manejar bitácora
└── components/clientes/
    └── ClienteDetalle.jsx            # Integración en clientes
```

## 🔌 API Endpoints

### Bitácora
- `GET /api/bitacora/` - Listar registros de bitácora
- `POST /api/bitacora/` - Crear registro con imágenes
- `GET /api/bitacora/{id}/` - Obtener registro específico
- `PUT /api/bitacora/{id}/` - Actualizar registro
- `DELETE /api/bitacora/{id}/` - Eliminar registro
- `DELETE /api/bitacora/{id}/eliminar_imagen/` - Eliminar imagen específica
- `GET /api/bitacora/por_servicio/?id_servicio={id}` - Obtener bitácora completa de un servicio

### Filtros disponibles
- `?id_servicio={id}` - Filtrar por servicio
- `?id_moto={id}` - Filtrar por moto
- `?modulo={modulo}` - Filtrar por módulo (recepcion, diagnostico, reparacion, entrega)

## 💾 Modelo de Datos

```sql
CREATE TABLE bitacora_servicio (
    id_bitacora SERIAL PRIMARY KEY,
    id_servicio INTEGER REFERENCES servicio_motos(id_servicio),
    id_moto INTEGER REFERENCES motos(id_moto),
    modulo VARCHAR(50) CHECK (modulo IN ('recepcion', 'diagnostico', 'reparacion', 'entrega')),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT,
    
    -- Campos específicos por módulo
    nivel_gasolina VARCHAR(50),
    rayones_previos TEXT,
    fallas_encontradas TEXT,
    trabajo_realizado TEXT,
    tecnico_responsable VARCHAR(255),
    checklist_salida TEXT,
    firma_cliente VARCHAR(255),
    
    -- Imágenes en R2
    imagenes JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    creado_por VARCHAR(255),
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🖼️ Almacenamiento de Imágenes

Las imágenes se almacenan en Cloudflare R2 con la siguiente estructura:

```
inventrix-eclipze/
├── recepcion/
│   └── 20260311_143022_a1b2c3d4.jpg
├── diagnostico/
│   └── 20260311_143045_e5f6g7h8.jpg
├── reparacion/
│   └── 20260311_143112_i9j0k1l2.jpg
└── entrega/
    └── 20260311_143145_m3n4o5p6.jpg
```

- Nombres únicos con timestamp y UUID
- URLs públicas accesibles desde `https://cdn.eclipze.dev/`
- Caché de 1 año para optimización

## 🎨 Uso en el Frontend

### 1. Acceder a la bitácora
```javascript
// En ClienteDetalle.jsx
<Button onClick={() => setServicioConBitacora({ servicio, moto })}>
  📋 Bitácora
</Button>
```

### 2. Agregar registro
```javascript
// El formulario maneja automáticamente la subida de imágenes
const handleCrearBitacora = async (formData) => {
  await crearBitacora(formData)
}
```

### 3. Ver registros
```javascript
// BitacoraViewer organiza automáticamente por módulos
<BitacoraViewer
  bitacoras={bitacoras}
  onEliminarImagen={handleEliminarImagen}
/>
```

## 🔒 Seguridad

- Las imágenes se suben con Content-Type correcto
- URLs únicas e impredecibles
- Validación de tipos de archivo en el frontend
- Manejo de errores en subida y eliminación

## 📊 Beneficios

1. **Protección Legal**: Fotos de recepción protegen contra reclamos
2. **Transparencia**: Cliente ve exactamente qué se hizo
3. **Trazabilidad**: Registro completo de quién hizo qué y cuándo
4. **Profesionalismo**: Documentación detallada del servicio
5. **Escalabilidad**: R2 maneja millones de imágenes sin problemas

## 🐛 Troubleshooting

### Error al subir imágenes
- Verificar credenciales de R2 en `.env`
- Verificar que el bucket existe
- Verificar permisos de escritura en R2

### Imágenes no se muestran
- Verificar que `R2_PUBLIC_URL` es correcto
- Verificar que el bucket tiene acceso público configurado
- Verificar CORS en R2

### Tabla no existe
```bash
cd backend
python create_bitacora_table.py
```

## 📝 Notas

- Las imágenes se almacenan en formato JSONB como array de URLs
- Cada módulo puede tener múltiples registros
- Los registros se ordenan por fecha descendente
- Las imágenes eliminadas se borran permanentemente de R2

## 🎉 ¡Listo!

La funcionalidad de bitácora está completamente integrada y lista para usar. Accede a cualquier cliente, selecciona una moto, y haz clic en "Bitácora" en cualquier servicio para comenzar.
