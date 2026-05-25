# Configuración de Relación Producto-Proveedor

Este documento explica cómo configurar la relación entre productos y proveedores para filtrar productos por proveedor en las órdenes de compra.

## 📋 Requisitos Previos

- Base de datos PostgreSQL configurada
- Backend Django funcionando
- Variables de entorno configuradas en `backend/.env`

## 🚀 Pasos de Instalación

### 1. Crear la Tabla de Relación

Ejecuta el script para crear la tabla `producto_proveedor`:

```bash
cd backend
python create_producto_proveedor_table.py
```

Este script:
- ✅ Crea la tabla `producto_proveedor`
- ✅ Agrega índices para mejorar el rendimiento
- ✅ Crea triggers para actualizar timestamps
- ✅ Verifica que la tabla se creó correctamente

### 2. Poblar la Tabla con Datos

Ejecuta el script para poblar la tabla con relaciones iniciales:

```bash
python populate_producto_proveedor.py
```

Este script:
- ✅ Crea relaciones basadas en órdenes de compra existentes
- ✅ Si no hay órdenes, crea relaciones para todos los productos con todos los proveedores
- ✅ Muestra estadísticas de las relaciones creadas

### 3. Reiniciar el Backend

Reinicia el servidor Django para que cargue el nuevo modelo:

```bash
# Si estás usando el servidor de desarrollo
python manage.py runserver

# Si estás usando Docker
docker-compose restart backend
```

## 📊 Estructura de la Tabla

```sql
CREATE TABLE producto_proveedor (
    id_producto_proveedor SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES productos(id_producto),
    id_proveedor INTEGER NOT NULL REFERENCES proveedores(id_proveedor),
    precio_compra DECIMAL(10, 2),
    es_proveedor_principal BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_producto, id_proveedor)
);
```

## 🔧 Funcionalidad

### Backend

El `ProductoViewSet` ahora soporta el parámetro `proveedor`:

```python
GET /api/productos/?proveedor=1
```

Esto devuelve solo los productos asociados al proveedor con ID 1.

### Frontend

El formulario de orden de compra (`OrdenCompraForm`) ahora:
- ✅ Filtra productos automáticamente según el proveedor seleccionado
- ✅ Deshabilita la selección de productos hasta que se elija un proveedor
- ✅ Muestra mensajes informativos al usuario

## 📝 Gestión de Relaciones

### Agregar Producto a Proveedor

```sql
INSERT INTO producto_proveedor (id_producto, id_proveedor, precio_compra, es_proveedor_principal)
VALUES (1, 1, 150.00, TRUE);
```

### Ver Productos de un Proveedor

```sql
SELECT p.nombre, pp.precio_compra
FROM producto_proveedor pp
INNER JOIN productos p ON pp.id_producto = p.id_producto
WHERE pp.id_proveedor = 1;
```

### Ver Proveedores de un Producto

```sql
SELECT pr.nombre_empresa, pp.precio_compra, pp.es_proveedor_principal
FROM producto_proveedor pp
INNER JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
WHERE pp.id_producto = 1;
```

## 🎯 Casos de Uso

### 1. Nuevo Producto

Cuando creas un nuevo producto, debes asociarlo con al menos un proveedor:

```sql
-- Después de crear el producto
INSERT INTO producto_proveedor (id_producto, id_proveedor, precio_compra)
VALUES (NEW_PRODUCT_ID, PROVEEDOR_ID, PRECIO);
```

### 2. Nuevo Proveedor

Cuando agregas un nuevo proveedor, puedes asociarlo con productos existentes:

```sql
-- Asociar proveedor con múltiples productos
INSERT INTO producto_proveedor (id_producto, id_proveedor, precio_compra)
SELECT id_producto, NEW_PROVEEDOR_ID, precio_compra_unitario
FROM productos
WHERE id_producto IN (1, 2, 3, 4, 5);
```

### 3. Actualizar Precios

```sql
UPDATE producto_proveedor
SET precio_compra = 175.00
WHERE id_producto = 1 AND id_proveedor = 1;
```

## ⚠️ Notas Importantes

1. **Relación Muchos a Muchos**: Un producto puede tener múltiples proveedores y un proveedor puede tener múltiples productos.

2. **Proveedor Principal**: El campo `es_proveedor_principal` permite marcar el proveedor preferido para un producto.

3. **Precios Específicos**: Cada relación puede tener un precio de compra específico, diferente del precio general del producto.

4. **Integridad Referencial**: Las relaciones se eliminan automáticamente si se elimina el producto o el proveedor (CASCADE).

## 🐛 Solución de Problemas

### No se muestran productos al seleccionar proveedor

1. Verifica que existan relaciones en la tabla:
```sql
SELECT COUNT(*) FROM producto_proveedor WHERE id_proveedor = PROVEEDOR_ID;
```

2. Si no hay relaciones, ejecuta nuevamente:
```bash
python populate_producto_proveedor.py
```

### Error al crear la tabla

Si la tabla ya existe, puedes eliminarla y recrearla:
```sql
DROP TABLE IF EXISTS producto_proveedor CASCADE;
```

Luego ejecuta nuevamente el script de creación.

## 📚 Recursos Adicionales

- [Documentación de Django Models](https://docs.djangoproject.com/en/stable/topics/db/models/)
- [PostgreSQL Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [React Query Documentation](https://tanstack.com/query/latest)
