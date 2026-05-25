# Agregar Campo Proveedor a Productos

Este documento explica cómo agregar el campo `id_proveedor` a la tabla `productos` para asociar cada producto con su proveedor principal.

## 📋 Descripción

Se agregará una columna `id_proveedor` a la tabla `productos` que funcionará como foreign key hacia la tabla `proveedores`. Esto permite:

- Asociar cada producto con un proveedor principal
- Filtrar productos por proveedor en las órdenes de compra
- Mostrar el proveedor en el listado de productos
- Simplificar la gestión de inventario

## 🚀 Pasos de Instalación

### 1. Ejecutar el Script de Migración

```bash
cd backend
python add_proveedor_to_productos.py
```

Este script:
- ✅ Agrega la columna `id_proveedor` a la tabla `productos`
- ✅ Crea el foreign key constraint hacia `proveedores`
- ✅ Crea un índice para mejorar el rendimiento
- ✅ Asigna proveedores automáticamente basándose en órdenes de compra existentes
- ✅ Muestra estadísticas de productos por proveedor

### 2. Reiniciar el Backend

```bash
# Si estás usando el servidor de desarrollo
python manage.py runserver

# Si estás usando Docker
docker-compose restart backend
```

## 📊 Estructura de la Tabla

```sql
ALTER TABLE productos 
ADD COLUMN id_proveedor INTEGER REFERENCES proveedores(id_proveedor) ON DELETE SET NULL;
```

## 🔧 Cambios Realizados

### Backend

#### 1. Modelo (`inventory/models.py`)
```python
class Producto(models.Model):
    # ... campos existentes ...
    id_proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='productos',
        db_column='id_proveedor'
    )
```

#### 2. Serializers (`api/serializers.py`)
- Agregado campo `id_proveedor` en todos los serializers
- Agregado campo `proveedor_nombre` para mostrar el nombre del proveedor

#### 3. ViewSet (`api/views.py`)
- Filtro simplificado: `queryset.filter(id_proveedor_id=proveedor_id)`

### Frontend

#### 1. Formulario de Productos (`ProductoForm.jsx`)
- Agregado selector de proveedor
- Carga automática de lista de proveedores
- Validación opcional (puede quedar sin proveedor)

#### 2. Formulario de Orden de Compra (`OrdenCompraForm.jsx`)
- Filtra productos automáticamente por proveedor seleccionado
- Deshabilita selección de productos hasta elegir proveedor

## 🎯 Funcionalidad

### API

**Listar productos de un proveedor:**
```
GET /api/productos/?proveedor=1
```

**Respuesta incluye:**
```json
{
  "id_producto": 1,
  "sku_producto": "OIL-001",
  "nombre": "Aceite Castrol 20W50",
  "id_proveedor": 1,
  "proveedor_nombre": "Honda"
}
```

### Frontend

**Crear/Editar Producto:**
1. Llenar información del producto
2. Seleccionar proveedor del dropdown
3. Guardar

**Crear Orden de Compra:**
1. Seleccionar proveedor
2. Solo se muestran productos de ese proveedor
3. Agregar productos a la orden

## 📝 Asignación Automática de Proveedores

El script asigna proveedores automáticamente basándose en:
- **Órdenes de compra existentes**: Asigna el proveedor más frecuente
- **Sin órdenes**: Los productos quedan sin proveedor (NULL)

### Productos sin Proveedor

Los productos sin proveedor asignado:
- ✅ Se pueden crear y editar normalmente
- ✅ Aparecen en el listado general
- ⚠️ NO aparecen al filtrar por proveedor en órdenes de compra
- 💡 Deben asignarse manualmente desde el formulario de edición

## 🔍 Consultas Útiles

### Ver productos sin proveedor
```sql
SELECT id_producto, sku_producto, nombre
FROM productos
WHERE id_proveedor IS NULL;
```

### Ver productos por proveedor
```sql
SELECT 
    pr.nombre_empresa,
    COUNT(p.id_producto) as total_productos
FROM proveedores pr
LEFT JOIN productos p ON p.id_proveedor = pr.id_proveedor
GROUP BY pr.id_proveedor, pr.nombre_empresa
ORDER BY total_productos DESC;
```

### Asignar proveedor manualmente
```sql
UPDATE productos
SET id_proveedor = 1
WHERE id_producto = 10;
```

### Cambiar proveedor de múltiples productos
```sql
UPDATE productos
SET id_proveedor = 2
WHERE id_producto IN (1, 2, 3, 4, 5);
```

## ⚠️ Consideraciones

1. **NULL permitido**: Los productos pueden no tener proveedor asignado
2. **ON DELETE SET NULL**: Si se elimina un proveedor, sus productos quedan sin proveedor
3. **Proveedor único**: Cada producto tiene un solo proveedor principal
4. **Filtro en órdenes**: Solo productos con proveedor asignado aparecen en órdenes de compra

## 🐛 Solución de Problemas

### Error: "relation productos does not exist"
- Verifica que la base de datos esté corriendo
- Verifica las credenciales en `.env`

### No se muestran productos al seleccionar proveedor
1. Verifica que los productos tengan `id_proveedor` asignado:
```sql
SELECT * FROM productos WHERE id_proveedor = 1;
```

2. Si no hay productos, asígnalos:
```sql
UPDATE productos SET id_proveedor = 1 WHERE id_producto IN (...);
```

### Error al ejecutar el script
- Asegúrate de estar en el directorio `backend`
- Verifica que Django esté configurado correctamente
- Revisa el archivo `.env`

## 📚 Diferencia con Tabla Intermedia

**Tabla Intermedia (producto_proveedor):**
- ✅ Múltiples proveedores por producto
- ✅ Precios específicos por proveedor
- ❌ Más compleja
- ❌ Requiere más consultas

**Campo Directo (id_proveedor):**
- ✅ Simple y directo
- ✅ Mejor rendimiento
- ✅ Más fácil de mantener
- ❌ Solo un proveedor por producto

Para este caso de uso, el campo directo es suficiente y más eficiente.
