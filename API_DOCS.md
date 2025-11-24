# Documentación de la API - Inventrix

## Información General

**Base URL:** `http://localhost:8000/api/`

**Formato de respuesta:** JSON

**Autenticación:** No requerida (en desarrollo)

**Moneda:** Córdoba nicaragüense (C$)

---

## Índice

1. [Proveedores](#proveedores)
2. [Marcas](#marcas)
3. [Categorías](#categorías)
4. [Productos](#productos)
5. [Clientes](#clientes)
6. [Motos](#motos)
7. [Servicios de Motos](#servicios-de-motos)
8. [Catálogo de Servicios](#catálogo-de-servicios)
9. [Órdenes de Compra](#órdenes-de-compra)
10. [Órdenes de Venta](#órdenes-de-venta)
11. [Movimientos de Inventario](#movimientos-de-inventario)
12. [Reportes](#reportes)

---

## Respuestas Paginadas

La mayoría de los endpoints que retornan listas utilizan paginación:

```json
{
  "count": 100,
  "next": "http://localhost:8000/api/endpoint/?page=2",
  "previous": null,
  "results": [...]
}
```

**Parámetros de paginación:**
- `page`: Número de página (default: 1)
- `page_size`: Elementos por página (default: 20)

**Parámetros de búsqueda:**
- `search`: Búsqueda de texto en campos específicos
- `ordering`: Ordenamiento (ej: `nombre`, `-fecha`)

---

## Proveedores

### Listar Proveedores

**Endpoint:** `GET /api/proveedores/`

**Descripción:** Obtiene la lista de todos los proveedores.

**Parámetros de búsqueda:**
- `search`: Busca en nombre_empresa, persona_contacto, email, telefono

**Ejemplo de respuesta:**
```json
{
  "count": 10,
  "results": [
    {
      "id_proveedor": 1,
      "nombre_empresa": "Repuestos Motos SA",
      "persona_contacto": "Juan Pérez",
      "telefono": "8888-1234",
      "email": "contacto@repuestos.com",
      "direccion": "Managua, Nicaragua"
    }
  ]
}
```

### Obtener Proveedor

**Endpoint:** `GET /api/proveedores/{id}/`

**Descripción:** Obtiene los detalles de un proveedor específico.

### Crear Proveedor

**Endpoint:** `POST /api/proveedores/`

**Body:**
```json
{
  "nombre_empresa": "Repuestos Motos SA",
  "persona_contacto": "Juan Pérez",
  "telefono": "8888-1234",
  "email": "contacto@repuestos.com",
  "direccion": "Managua, Nicaragua"
}
```

### Actualizar Proveedor

**Endpoint:** `PUT /api/proveedores/{id}/`

**Endpoint:** `PATCH /api/proveedores/{id}/` (actualización parcial)

### Eliminar Proveedor

**Endpoint:** `DELETE /api/proveedores/{id}/`

---

## Marcas

### Listar Marcas

**Endpoint:** `GET /api/marcas/`

**Ejemplo de respuesta:**
```json
{
  "count": 5,
  "results": [
    {
      "id": 1,
      "nombre": "Honda",
      "descripcion": "Marca japonesa de motocicletas",
      "fecha_creacion": "2025-01-15T10:30:00Z",
      "productos_count": 25
    }
  ]
}
```

### Crear Marca

**Endpoint:** `POST /api/marcas/`

**Body:**
```json
{
  "nombre": "Honda",
  "descripcion": "Marca japonesa de motocicletas"
}
```

---

## Categorías

### Listar Categorías

**Endpoint:** `GET /api/categorias/`

**Ejemplo de respuesta:**
```json
{
  "count": 8,
  "results": [
    {
      "id": 1,
      "nombre": "Aceites",
      "descripcion": "Aceites para motor",
      "fecha_creacion": "2025-01-15T10:30:00Z",
      "productos_count": 15
    }
  ]
}
```

### Crear Categoría

**Endpoint:** `POST /api/categorias/`

**Body:**
```json
{
  "nombre": "Aceites",
  "descripcion": "Aceites para motor"
}
```

---

## Productos

### Listar Productos

**Endpoint:** `GET /api/productos/`

**Parámetros de búsqueda:**
- `search`: Busca en sku_producto, nombre
- `ordering`: Ordena por nombre, cantidad_actual, precio_final

**Ejemplo de respuesta:**
```json
{
  "count": 50,
  "results": [
    {
      "id_producto": 1,
      "sku_producto": "ACE-001",
      "nombre": "Aceite Castrol 20W50",
      "cantidad_actual": 25,
      "cantidad_total": 100,
      "cantidad_minima": 10,
      "precio_compra_unitario": 150,
      "precio_final": "185.00"
    }
  ]
}
```

### Obtener Producto

**Endpoint:** `GET /api/productos/{id}/`

**Descripción:** Obtiene detalles completos del producto incluyendo historial de movimientos.

### Crear Producto

**Endpoint:** `POST /api/productos/`

**Body:**
```json
{
  "sku_producto": "ACE-001",
  "nombre": "Aceite Castrol 20W50",
  "cantidad_actual": 25,
  "cantidad_total": 100,
  "cantidad_minima": 10,
  "precio_compra_unitario": 150,
  "precio_final": "185.00"
}
```

### Actualizar Producto

**Endpoint:** `PUT /api/productos/{id}/`

**Endpoint:** `PATCH /api/productos/{id}/`

### Eliminar Producto

**Endpoint:** `DELETE /api/productos/{id}/`

---

## Clientes

### Listar Clientes

**Endpoint:** `GET /api/clientes/`

**Parámetros de búsqueda:**
- `search`: Busca en nombre, telefono, email

**Ejemplo de respuesta:**
```json
{
  "count": 27,
  "results": [
    {
      "id_cliente": 1,
      "nombre": "Juan Pérez",
      "telefono": "809-555-0101",
      "email": "juan.perez@email.com"
    }
  ]
}
```

### Obtener Cliente

**Endpoint:** `GET /api/clientes/{id}/`

**Descripción:** Obtiene los detalles de un cliente específico.

### Crear Cliente

**Endpoint:** `POST /api/clientes/`

**Body:**
```json
{
  "nombre": "Juan Pérez",
  "telefono": "809-555-0101",
  "email": "juan.perez@email.com"
}
```

### Actualizar Cliente

**Endpoint:** `PUT /api/clientes/{id}/`

**Endpoint:** `PATCH /api/clientes/{id}/`

### Eliminar Cliente

**Endpoint:** `DELETE /api/clientes/{id}/`

### Obtener Órdenes de un Cliente

**Endpoint:** `GET /api/clientes/{id}/ordenes/`

**Descripción:** Obtiene todas las órdenes de venta de un cliente específico.

---

## Motos

### Listar Motos

**Endpoint:** `GET /api/motos/`

**Parámetros:**
- `cliente`: Filtra por ID de cliente (ej: `?cliente=1`)
- `search`: Busca en marca, modelo, placa, nombre del cliente

**Ejemplo de respuesta:**
```json
{
  "count": 45,
  "results": [
    {
      "id_moto": 1,
      "id_cliente": 1,
      "marca": "Honda",
      "modelo": "CB190R",
      "anio": 2022,
      "placa": "A123456",
      "servicios": [...],
      "total_servicios": 2,
      "ultimo_servicio": "2025-10-24"
    }
  ]
}
```

### Obtener Moto

**Endpoint:** `GET /api/motos/{id}/`

**Descripción:** Obtiene los detalles de una moto incluyendo todos sus servicios.

### Crear Moto

**Endpoint:** `POST /api/motos/`

**Body:**
```json
{
  "id_cliente": 1,
  "marca": "Honda",
  "modelo": "CB190R",
  "anio": 2022,
  "placa": "A123456"
}
```

**Validaciones:**
- `placa`: Debe ser única
- `anio`: Debe estar entre 1900 y año actual + 1
- `id_cliente`: Debe existir en la tabla clientes

### Actualizar Moto

**Endpoint:** `PUT /api/motos/{id}/`

**Endpoint:** `PATCH /api/motos/{id}/`

### Eliminar Moto

**Endpoint:** `DELETE /api/motos/{id}/`

**Nota:** Al eliminar una moto, se eliminan en cascada todos sus servicios asociados.

---

## Servicios de Motos

### Listar Servicios de Motos

**Endpoint:** `GET /api/servicios-motos/`

**Parámetros:**
- `moto`: Filtra por ID de moto (ej: `?moto=1`)
- `search`: Busca en tipo_servicio, descripcion, placa de la moto

**Ejemplo de respuesta:**
```json
{
  "count": 14,
  "results": [
    {
      "id_servicio": 1,
      "id_moto": 37,
      "fecha_servicio": "2025-10-24",
      "tipo_servicio": "Cambio de aceite",
      "descripcion": "Cambio de aceite y filtro, revisión general",
      "costo": "550.00"
    }
  ]
}
```

### Obtener Servicio de Moto

**Endpoint:** `GET /api/servicios-motos/{id}/`

### Crear Servicio de Moto

**Endpoint:** `POST /api/servicios-motos/`

**Body:**
```json
{
  "id_moto": 37,
  "fecha_servicio": "2025-10-24",
  "tipo_servicio": "Cambio de aceite",
  "descripcion": "Cambio de aceite y filtro, revisión general",
  "costo": 550.00
}
```

**Validaciones:**
- `id_moto`: Debe existir en la tabla motos
- `fecha_servicio`: No puede ser futura
- `costo`: Debe ser mayor a 0
- `tipo_servicio`: Campo requerido

**Nota:** El costo se puede autocompletar desde el catálogo de servicios.

### Actualizar Servicio de Moto

**Endpoint:** `PUT /api/servicios-motos/{id}/`

**Endpoint:** `PATCH /api/servicios-motos/{id}/`

### Eliminar Servicio de Moto

**Endpoint:** `DELETE /api/servicios-motos/{id}/`

---

## Catálogo de Servicios

### Listar Servicios Disponibles

**Endpoint:** `GET /api/servicios/`

**Descripción:** Obtiene el catálogo de servicios disponibles con sus precios de mano de obra. Este endpoint es de solo lectura y se utiliza para autocompletar precios al registrar servicios de motos.

**Parámetros de búsqueda:**
- `search`: Busca en nombre, tipo

**Ejemplo de respuesta:**
```json
[
  {
    "nombre": "Cambio de Aceite y Filtro",
    "precio_mano_obra": 150.0,
    "tipo": "Mantenimiento"
  },
  {
    "nombre": "Cambio de Pastillas de Freno",
    "precio_mano_obra": 200.0,
    "tipo": "Reparación"
  },
  {
    "nombre": "Limpieza de Carburador",
    "precio_mano_obra": 250.0,
    "tipo": "Mantenimiento"
  },
  {
    "nombre": "Cambio de Kit de Arrastre",
    "precio_mano_obra": 350.0,
    "tipo": "Reparación"
  },
  {
    "nombre": "Revisión General 5000km",
    "precio_mano_obra": 250.0,
    "tipo": "Mantenimiento"
  },
  {
    "nombre": "Pintura y Restauración",
    "precio_mano_obra": 1200.0,
    "tipo": "Estética"
  }
]
```

**Nota:** Este endpoint retorna servicios únicos por nombre. Los precios están en Córdobas nicaragüenses (C$).

**Uso típico:**
1. Cargar la lista al abrir el formulario de registro de servicio
2. Mostrar en un select con formato: "Nombre del Servicio - C$Precio"
3. Al seleccionar un servicio, autocompletar el campo de costo

---

## Órdenes de Compra

### Listar Órdenes de Compra

**Endpoint:** `GET /api/ordenes-compra/`

**Parámetros de búsqueda:**
- `search`: Busca en número de orden, proveedor
- `estado`: Filtra por estado

**Ejemplo de respuesta:**
```json
{
  "count": 20,
  "results": [
    {
      "id_orden": 1,
      "id_proveedor": 1,
      "proveedor_nombre": "Repuestos Motos SA",
      "id_estado": 1,
      "estado_nombre": "Pendiente",
      "fecha_creacion": "2025-01-15",
      "total": "5000.00",
      "cantidad_productos": 3
    }
  ]
}
```

### Obtener Orden de Compra

**Endpoint:** `GET /api/ordenes-compra/{id}/`

**Descripción:** Obtiene los detalles completos de una orden incluyendo todos los productos.

**Ejemplo de respuesta:**
```json
{
  "id_orden": 1,
  "id_proveedor": 1,
  "proveedor_nombre": "Repuestos Motos SA",
  "id_estado": 1,
  "estado_nombre": "Pendiente",
  "fecha_creacion": "2025-01-15",
  "total": "5000.00",
  "detalles": [
    {
      "id": 1,
      "producto": 1,
      "producto_nombre": "Aceite Castrol 20W50",
      "cantidad": 10,
      "precio_unitario": "150.00",
      "subtotal": "1500.00"
    }
  ]
}
```

### Crear Orden de Compra

**Endpoint:** `POST /api/ordenes-compra/`

**Body:**
```json
{
  "id_proveedor": 1,
  "id_estado": 1,
  "fecha_creacion": "2025-01-15",
  "detalles": [
    {
      "producto": 1,
      "cantidad": 10,
      "precio_unitario": 150.00
    }
  ]
}
```

**Validaciones:**
- `id_proveedor`: Debe existir
- `detalles`: Debe contener al menos un producto
- `cantidad`: Debe ser mayor a 0
- `precio_unitario`: Debe ser mayor a 0

**Nota:** El total se calcula automáticamente sumando los subtotales de todos los detalles.

### Actualizar Orden de Compra

**Endpoint:** `PUT /api/ordenes-compra/{id}/`

### Eliminar Orden de Compra

**Endpoint:** `DELETE /api/ordenes-compra/{id}/`

---

## Órdenes de Venta

### Listar Órdenes de Venta

**Endpoint:** `GET /api/ordenes-venta/`

**Parámetros de búsqueda:**
- `search`: Busca en número de orden, cliente
- `cliente`: Filtra por ID de cliente

**Ejemplo de respuesta:**
```json
{
  "count": 30,
  "results": [
    {
      "id_venta": 1,
      "id_cliente": 1,
      "cliente_nombre": "Juan Pérez",
      "fecha": "2025-01-15",
      "total": "3500.00",
      "cantidad_productos": 2
    }
  ]
}
```

### Obtener Orden de Venta

**Endpoint:** `GET /api/ordenes-venta/{id}/`

**Descripción:** Obtiene los detalles completos de una orden de venta incluyendo todos los productos.

**Ejemplo de respuesta:**
```json
{
  "id_venta": 1,
  "id_cliente": 1,
  "cliente_nombre": "Juan Pérez",
  "fecha": "2025-01-15",
  "total": "3500.00",
  "detalles": [
    {
      "id": 1,
      "producto": 1,
      "producto_nombre": "Aceite Castrol 20W50",
      "cantidad": 5,
      "precio_unitario": "185.00",
      "subtotal": "925.00"
    }
  ]
}
```

### Crear Orden de Venta

**Endpoint:** `POST /api/ordenes-venta/`

**Body:**
```json
{
  "id_cliente": 1,
  "fecha": "2025-01-15",
  "detalles": [
    {
      "producto": 1,
      "cantidad": 5,
      "precio_unitario": 185.00
    }
  ]
}
```

**Validaciones:**
- `id_cliente`: Debe existir
- `detalles`: Debe contener al menos un producto
- `cantidad`: Debe ser mayor a 0 y no exceder el stock disponible
- `precio_unitario`: Debe ser mayor a 0

**Nota:** 
- El total se calcula automáticamente
- Al crear una orden de venta, se reduce automáticamente el stock de los productos

### Actualizar Orden de Venta

**Endpoint:** `PUT /api/ordenes-venta/{id}/`

### Eliminar Orden de Venta

**Endpoint:** `DELETE /api/ordenes-venta/{id}/`

---

## Movimientos de Inventario

### Listar Movimientos

**Endpoint:** `GET /api/movimientos/`

**Parámetros de búsqueda:**
- `search`: Busca en nombre del producto, código, referencia
- `tipo`: Filtra por tipo (ENTRADA, SALIDA, AJUSTE)
- `producto`: Filtra por ID de producto

**Ejemplo de respuesta:**
```json
{
  "count": 100,
  "results": [
    {
      "id": 1,
      "producto": 1,
      "producto_nombre": "Aceite Castrol 20W50",
      "producto_codigo": "ACE-001",
      "tipo": "ENTRADA",
      "cantidad": 50,
      "fecha": "2025-01-15T10:30:00Z",
      "referencia": "OC-001",
      "tipo_referencia": "ORDEN_COMPRA",
      "notas": "Entrada por orden de compra"
    }
  ]
}
```

### Obtener Movimiento

**Endpoint:** `GET /api/movimientos/{id}/`

### Crear Movimiento

**Endpoint:** `POST /api/movimientos/`

**Body:**
```json
{
  "producto": 1,
  "tipo": "ENTRADA",
  "cantidad": 50,
  "referencia": "OC-001",
  "tipo_referencia": "ORDEN_COMPRA",
  "notas": "Entrada por orden de compra"
}
```

**Tipos de movimiento:**
- `ENTRADA`: Incrementa el stock
- `SALIDA`: Reduce el stock
- `AJUSTE`: Ajuste manual de inventario

**Tipos de referencia:**
- `ORDEN_COMPRA`: Movimiento generado por una orden de compra
- `ORDEN_VENTA`: Movimiento generado por una orden de venta
- `AJUSTE_MANUAL`: Ajuste manual del inventario

**Validaciones:**
- `producto`: Debe existir
- `cantidad`: Debe ser mayor a 0
- `tipo`: Debe ser ENTRADA, SALIDA o AJUSTE
- Para SALIDA: La cantidad no puede exceder el stock disponible

**Nota:** Los movimientos se crean automáticamente al procesar órdenes de compra y venta.

---

## Reportes

### Reporte de Inventario

**Endpoint:** `GET /api/reportes/inventario/`

**Descripción:** Genera un reporte del estado actual del inventario.

**Parámetros:**
- `bajo_stock`: Filtra productos con stock bajo (true/false)
- `categoria`: Filtra por ID de categoría
- `marca`: Filtra por ID de marca

**Ejemplo de respuesta:**
```json
{
  "total_productos": 50,
  "valor_total_inventario": "125000.00",
  "productos_bajo_stock": 5,
  "productos": [
    {
      "id_producto": 1,
      "sku_producto": "ACE-001",
      "nombre": "Aceite Castrol 20W50",
      "cantidad_actual": 25,
      "cantidad_minima": 10,
      "precio_compra_unitario": 150,
      "precio_final": "185.00",
      "valor_stock": "3750.00",
      "estado_stock": "normal"
    }
  ]
}
```

**Estados de stock:**
- `normal`: Stock por encima del mínimo
- `bajo`: Stock igual o menor al mínimo
- `agotado`: Stock en 0

### Reporte de Ventas

**Endpoint:** `GET /api/reportes/ventas/`

**Descripción:** Genera un reporte de ventas en un período específico.

**Parámetros:**
- `fecha_inicio`: Fecha de inicio (formato: YYYY-MM-DD)
- `fecha_fin`: Fecha de fin (formato: YYYY-MM-DD)
- `cliente`: Filtra por ID de cliente

**Ejemplo de respuesta:**
```json
{
  "periodo": {
    "fecha_inicio": "2025-01-01",
    "fecha_fin": "2025-01-31"
  },
  "total_ventas": "150000.00",
  "cantidad_ordenes": 25,
  "ticket_promedio": "6000.00",
  "ventas": [
    {
      "id_venta": 1,
      "fecha": "2025-01-15",
      "cliente_nombre": "Juan Pérez",
      "total": "3500.00",
      "cantidad_productos": 2
    }
  ]
}
```

### Reporte de Compras

**Endpoint:** `GET /api/reportes/compras/`

**Descripción:** Genera un reporte de compras en un período específico.

**Parámetros:**
- `fecha_inicio`: Fecha de inicio (formato: YYYY-MM-DD)
- `fecha_fin`: Fecha de fin (formato: YYYY-MM-DD)
- `proveedor`: Filtra por ID de proveedor

**Ejemplo de respuesta:**
```json
{
  "periodo": {
    "fecha_inicio": "2025-01-01",
    "fecha_fin": "2025-01-31"
  },
  "total_compras": "80000.00",
  "cantidad_ordenes": 15,
  "compra_promedio": "5333.33",
  "compras": [
    {
      "id_orden": 1,
      "fecha_creacion": "2025-01-15",
      "proveedor_nombre": "Repuestos Motos SA",
      "total": "5000.00",
      "estado_nombre": "Completada"
    }
  ]
}
```

### Productos Más Vendidos

**Endpoint:** `GET /api/reportes/productos_mas_vendidos/`

**Descripción:** Obtiene los productos más vendidos en un período.

**Parámetros:**
- `fecha_inicio`: Fecha de inicio (formato: YYYY-MM-DD)
- `fecha_fin`: Fecha de fin (formato: YYYY-MM-DD)
- `limit`: Número de productos a retornar (default: 10)

**Ejemplo de respuesta:**
```json
{
  "periodo": {
    "fecha_inicio": "2025-01-01",
    "fecha_fin": "2025-01-31"
  },
  "productos": [
    {
      "id_producto": 1,
      "nombre": "Aceite Castrol 20W50",
      "sku_producto": "ACE-001",
      "cantidad_vendida": 150,
      "total_ventas": "27750.00",
      "precio_promedio": "185.00"
    }
  ]
}
```

---

## Códigos de Estado HTTP

La API utiliza los siguientes códigos de estado HTTP:

- `200 OK`: Solicitud exitosa
- `201 Created`: Recurso creado exitosamente
- `204 No Content`: Recurso eliminado exitosamente
- `400 Bad Request`: Error en los datos enviados
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error del servidor

## Manejo de Errores

### Formato de Error

Cuando ocurre un error, la API retorna un objeto JSON con el siguiente formato:

```json
{
  "error": "Descripción del error",
  "details": {
    "campo": ["Mensaje de error específico"]
  }
}
```

### Ejemplos de Errores Comunes

**Error de validación:**
```json
{
  "error": "Datos inválidos",
  "details": {
    "nombre": ["Este campo es requerido"],
    "email": ["Ingrese una dirección de email válida"]
  }
}
```

**Recurso no encontrado:**
```json
{
  "error": "No encontrado",
  "message": "El recurso solicitado no existe"
}
```

**Stock insuficiente:**
```json
{
  "error": "Stock insuficiente",
  "message": "No hay suficiente stock del producto 'Aceite Castrol 20W50'. Disponible: 5, Solicitado: 10"
}
```

---

## Notas Importantes

### Moneda

Todos los precios y costos están expresados en **Córdobas nicaragüenses (C$)**.

### Fechas

Las fechas se manejan en formato ISO 8601:
- Fecha: `YYYY-MM-DD` (ej: `2025-01-15`)
- Fecha y hora: `YYYY-MM-DDTHH:MM:SSZ` (ej: `2025-01-15T10:30:00Z`)

### Transacciones

Las operaciones que afectan el inventario (órdenes de compra y venta) son transaccionales:
- Si falla alguna parte de la operación, se revierte toda la transacción
- Los movimientos de inventario se crean automáticamente

### Relaciones en Cascada

- Al eliminar un **cliente**, se eliminan sus **motos** y los **servicios** de esas motos
- Al eliminar una **moto**, se eliminan todos sus **servicios**
- Al eliminar una **orden**, se eliminan todos sus **detalles**

### Paginación

Por defecto, los endpoints que retornan listas están paginados con 20 elementos por página. Puedes ajustar esto con el parámetro `page_size`.

---

## Ejemplos de Uso

### Crear una Orden de Venta Completa

```bash
curl -X POST http://localhost:8000/api/ordenes-venta/ \
  -H "Content-Type: application/json" \
  -d '{
    "id_cliente": 1,
    "fecha": "2025-01-15",
    "detalles": [
      {
        "producto": 1,
        "cantidad": 5,
        "precio_unitario": 185.00
      },
      {
        "producto": 2,
        "cantidad": 2,
        "precio_unitario": 450.00
      }
    ]
  }'
```

### Registrar un Servicio de Moto

```bash
curl -X POST http://localhost:8000/api/servicios-motos/ \
  -H "Content-Type: application/json" \
  -d '{
    "id_moto": 1,
    "fecha_servicio": "2025-01-15",
    "tipo_servicio": "Cambio de Aceite y Filtro",
    "descripcion": "Cambio de aceite sintético y filtro de aceite",
    "costo": 150.00
  }'
```

### Buscar Productos

```bash
curl "http://localhost:8000/api/productos/?search=aceite&ordering=-cantidad_actual"
```

### Obtener Motos de un Cliente

```bash
curl "http://localhost:8000/api/motos/?cliente=1"
```

### Generar Reporte de Ventas

```bash
curl "http://localhost:8000/api/reportes/ventas/?fecha_inicio=2025-01-01&fecha_fin=2025-01-31"
```

---

## Contacto y Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contacta al equipo de desarrollo.

**Versión de la API:** 1.0

**Última actualización:** Noviembre 2025
