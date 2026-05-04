# Validación de Fechas en Página de Reportes

## 📋 Resumen
Se agregó validación de fechas futuras en la página de Reportes para prevenir la generación de reportes con fechas posteriores a la fecha actual. Esta validación se aplica a los tres tipos de reportes: Ventas, Compras y Productos Más Vendidos.

## ✅ Cambios Implementados

### 1. Estado de Errores de Fecha
**Archivo**: `frontend/src/pages/Reportes.jsx`

**Nuevo estado agregado**:
```javascript
const [dateErrors, setDateErrors] = useState({
  ventas_inicio: '',
  ventas_fin: '',
  compras_inicio: '',
  compras_fin: '',
  productos_inicio: '',
  productos_fin: '',
})
```

Este estado maneja los mensajes de error para cada uno de los 6 campos de fecha en la página.

---

## 📊 Validaciones por Tipo de Reporte

### 2.1 Reporte de Ventas

**Campos validados**:
- `fecha_inicio` (Fecha Inicio)
- `fecha_fin` (Fecha Fin)

**Validación en tiempo real (onChange)**:
```javascript
onChange={(e) => {
  const value = e.target.value
  const today = new Date().toISOString().split('T')[0]
  
  if (value > today) {
    setDateErrors(prev => ({ ...prev, ventas_inicio: 'No se pueden seleccionar fechas futuras' }))
    return
  }
  
  setDateErrors(prev => ({ ...prev, ventas_inicio: '' }))
  setFiltrosVentas({ ...filtrosVentas, fecha_inicio: value })
}}
```

**Validación pre-submit (handleGenerarVentas)**:
```javascript
const handleGenerarVentas = () => {
  if (!filtrosVentas.fecha_inicio || !filtrosVentas.fecha_fin) {
    alert('Debe seleccionar un rango de fechas')
    return
  }
  
  // Validar fechas futuras
  const today = new Date().toISOString().split('T')[0]
  if (filtrosVentas.fecha_inicio > today || filtrosVentas.fecha_fin > today) {
    alert('No se pueden generar reportes con fechas futuras')
    return
  }
  
  // Validar que fecha inicio no sea mayor que fecha fin
  if (filtrosVentas.fecha_inicio > filtrosVentas.fecha_fin) {
    alert('La fecha de inicio no puede ser mayor que la fecha fin')
    return
  }
  
  setTipoReporte('ventas')
}
```

**Atributo HTML5**:
```javascript
max={new Date().toISOString().split('T')[0]}
```

---

### 2.2 Reporte de Compras

**Campos validados**:
- `fecha_inicio` (Fecha Inicio)
- `fecha_fin` (Fecha Fin)

**Validación en tiempo real (onChange)**:
```javascript
onChange={(e) => {
  const value = e.target.value
  const today = new Date().toISOString().split('T')[0]
  
  if (value > today) {
    setDateErrors(prev => ({ ...prev, compras_inicio: 'No se pueden seleccionar fechas futuras' }))
    return
  }
  
  setDateErrors(prev => ({ ...prev, compras_inicio: '' }))
  setFiltrosCompras({ ...filtrosCompras, fecha_inicio: value })
}}
```

**Validación pre-submit (handleGenerarCompras)**:
```javascript
const handleGenerarCompras = () => {
  if (!filtrosCompras.fecha_inicio || !filtrosCompras.fecha_fin) {
    alert('Debe seleccionar un rango de fechas')
    return
  }
  
  // Validar fechas futuras
  const today = new Date().toISOString().split('T')[0]
  if (filtrosCompras.fecha_inicio > today || filtrosCompras.fecha_fin > today) {
    alert('No se pueden generar reportes con fechas futuras')
    return
  }
  
  // Validar que fecha inicio no sea mayor que fecha fin
  if (filtrosCompras.fecha_inicio > filtrosCompras.fecha_fin) {
    alert('La fecha de inicio no puede ser mayor que la fecha fin')
    return
  }
  
  setTipoReporte('compras')
}
```

**Atributo HTML5**:
```javascript
max={new Date().toISOString().split('T')[0]}
```

---

### 2.3 Reporte de Productos Más Vendidos

**Campos validados**:
- `fecha_inicio` (Fecha Inicio)
- `fecha_fin` (Fecha Fin)

**Validación en tiempo real (onChange)**:
```javascript
onChange={(e) => {
  const value = e.target.value
  const today = new Date().toISOString().split('T')[0]
  
  if (value > today) {
    setDateErrors(prev => ({ ...prev, productos_inicio: 'No se pueden seleccionar fechas futuras' }))
    return
  }
  
  setDateErrors(prev => ({ ...prev, productos_inicio: '' }))
  setFiltrosProductos({ ...filtrosProductos, fecha_inicio: value })
}}
```

**Validación pre-submit (handleGenerarProductos)**:
```javascript
const handleGenerarProductos = () => {
  if (!filtrosProductos.fecha_inicio || !filtrosProductos.fecha_fin) {
    alert('Debe seleccionar un rango de fechas')
    return
  }
  
  // Validar fechas futuras
  const today = new Date().toISOString().split('T')[0]
  if (filtrosProductos.fecha_inicio > today || filtrosProductos.fecha_fin > today) {
    alert('No se pueden generar reportes con fechas futuras')
    return
  }
  
  // Validar que fecha inicio no sea mayor que fecha fin
  if (filtrosProductos.fecha_inicio > filtrosProductos.fecha_fin) {
    alert('La fecha de inicio no puede ser mayor que la fecha fin')
    return
  }
  
  setTipoReporte('productos')
}
```

**Atributo HTML5**:
```javascript
max={new Date().toISOString().split('T')[0]}
```

---

## 🔒 Niveles de Validación

### 1. **Validación HTML5 (Navegador)**
- Atributo `max` en todos los inputs de fecha
- Previene selección de fechas futuras en el calendario del navegador
- Primera línea de defensa

### 2. **Validación en Tiempo Real (onChange)**
- Se ejecuta al cambiar el valor del campo
- Muestra error inmediatamente debajo del input si se intenta ingresar fecha futura
- Previene que el valor se guarde en el estado si es inválido
- Limpia el error cuando se selecciona una fecha válida

### 3. **Validación Pre-Submit (handleGenerar...)**
- Se ejecuta al hacer clic en "Generar Reporte"
- Valida que ambas fechas estén presentes
- Valida que ninguna fecha sea futura
- **Valida que fecha_inicio ≤ fecha_fin**
- Muestra alerta si alguna validación falla
- Garantiza que no se generen reportes con fechas inválidas

---

## 📝 Mensajes de Error

### Error en Input (Tiempo Real)
```
"No se pueden seleccionar fechas futuras"
```
- Se muestra en rojo debajo del input
- Aparece inmediatamente al intentar seleccionar fecha futura
- Desaparece al seleccionar fecha válida

### Error en Submit (Alert)

**Fechas futuras**:
```
"No se pueden generar reportes con fechas futuras"
```

**Rango inválido**:
```
"La fecha de inicio no puede ser mayor que la fecha fin"
```

**Campos vacíos**:
```
"Debe seleccionar un rango de fechas"
```

- Se muestran como alerta del navegador
- Aparecen al intentar generar reporte con datos inválidos
- Previenen la generación del reporte

---

## 🎯 Comportamiento

### ✅ Permitido
- Fecha de hoy (3 de mayo de 2026)
- Fechas pasadas
- Rangos de fechas válidos donde inicio ≤ fin ≤ hoy

### ❌ No Permitido
- Cualquier fecha posterior a hoy
- Fecha de inicio mayor que fecha fin
- Muestra mensaje de error en rojo debajo del input (fechas futuras)
- Muestra alerta al intentar generar reporte (fechas futuras o rango inválido)
- Previene la generación del reporte

---

## 🧪 Testing

### Casos de Prueba - Reporte de Ventas

1. **Fecha válida (hoy)**: ✅ Debe permitir generar reporte
2. **Fecha válida (pasada)**: ✅ Debe permitir generar reporte
3. **Rango válido (inicio < fin)**: ✅ Debe permitir generar reporte
4. **Rango válido (inicio = fin)**: ✅ Debe permitir generar reporte
5. **Fecha futura en inicio**: ❌ Debe mostrar error y prevenir generación
6. **Fecha futura en fin**: ❌ Debe mostrar error y prevenir generación
7. **Ambas fechas futuras**: ❌ Debe mostrar error y prevenir generación
8. **Fecha inicio > fecha fin**: ❌ Debe mostrar "La fecha de inicio no puede ser mayor que la fecha fin"
9. **Campo vacío**: ❌ Debe mostrar "Debe seleccionar un rango de fechas"

### Casos de Prueba - Reporte de Compras

1. **Fecha válida (hoy)**: ✅ Debe permitir generar reporte
2. **Fecha válida (pasada)**: ✅ Debe permitir generar reporte
3. **Rango válido (inicio < fin)**: ✅ Debe permitir generar reporte
4. **Rango válido (inicio = fin)**: ✅ Debe permitir generar reporte
5. **Fecha futura en inicio**: ❌ Debe mostrar error y prevenir generación
6. **Fecha futura en fin**: ❌ Debe mostrar error y prevenir generación
7. **Ambas fechas futuras**: ❌ Debe mostrar error y prevenir generación
8. **Fecha inicio > fecha fin**: ❌ Debe mostrar "La fecha de inicio no puede ser mayor que la fecha fin"
9. **Campo vacío**: ❌ Debe mostrar "Debe seleccionar un rango de fechas"
10. **Con proveedor seleccionado**: ✅ Debe funcionar igual

### Casos de Prueba - Reporte de Productos

1. **Fecha válida (hoy)**: ✅ Debe permitir generar reporte
2. **Fecha válida (pasada)**: ✅ Debe permitir generar reporte
3. **Rango válido (inicio < fin)**: ✅ Debe permitir generar reporte
4. **Rango válido (inicio = fin)**: ✅ Debe permitir generar reporte
5. **Fecha futura en inicio**: ❌ Debe mostrar error y prevenir generación
6. **Fecha futura en fin**: ❌ Debe mostrar error y prevenir generación
7. **Ambas fechas futuras**: ❌ Debe mostrar error y prevenir generación
8. **Fecha inicio > fecha fin**: ❌ Debe mostrar "La fecha de inicio no puede ser mayor que la fecha fin"
9. **Campo vacío**: ❌ Debe mostrar "Debe seleccionar un rango de fechas"
10. **Con límite modificado**: ✅ Debe funcionar igual

### Verificación Manual

#### Reporte de Ventas
1. Ir a "Reportes" → Seleccionar "Ventas"
2. Intentar seleccionar fecha futura en "Fecha Inicio"
3. Verificar que muestra error debajo del input
4. Intentar seleccionar fecha futura en "Fecha Fin"
5. Verificar que muestra error debajo del input
6. Seleccionar fecha inicio mayor que fecha fin (ej: inicio=2026-05-03, fin=2026-05-01)
7. Hacer clic en "Generar Reporte"
8. Verificar que muestra alerta "La fecha de inicio no puede ser mayor que la fecha fin"
9. Intentar generar reporte con fecha futura
10. Verificar que muestra alerta y no genera reporte

#### Reporte de Compras
1. Ir a "Reportes" → Seleccionar "Compras"
2. Repetir pasos 2-7 de Ventas

#### Reporte de Productos
1. Ir a "Reportes" → Seleccionar "Productos"
2. Repetir pasos 2-7 de Ventas

---

## 📦 Build

```bash
cd frontend
pnpm run build
```

**Resultado**: ✅ Build exitoso
- 1478 módulos transformados
- Sin errores ni warnings
- Archivos generados en `frontend/dist/`
- Tiempo de build: 14.73s

---

## 🚀 Deployment

Los cambios están listos para deployment. El build de producción incluye todas las validaciones para los tres tipos de reportes.

---

## 🎨 Soporte de Dark Mode

Todos los mensajes de error y estilos incluyen soporte completo para modo oscuro:

```javascript
className="mt-1 text-sm text-red-600 dark:text-red-400"
```

---

## 📅 Fecha de Implementación

- **Fecha**: 3 de mayo de 2026
- **Versión**: 1.0.0
- **Estado**: ✅ Completado y verificado

---

## 👥 Impacto en Usuarios

### Positivo
- Previene errores de entrada de datos en reportes
- Mejora la integridad de los datos reportados
- Evita confusión con reportes de fechas futuras
- Feedback inmediato al usuario

### UX
- Mensajes de error claros y específicos
- Validación en tiempo real
- Prevención a nivel de navegador (HTML5)
- Soporte completo para dark mode

### Sin Breaking Changes
- No afecta reportes existentes
- No afecta funcionalidad de otros módulos
- Compatible con validaciones existentes en órdenes

---

## 🔗 Archivos Relacionados

- `frontend/src/pages/Reportes.jsx` - Implementación principal
- `VALIDACION_FECHAS_ORDENES.md` - Documentación de validación en órdenes (referencia)
- `VALIDACION_TELEFONO_CLIENTES.md` - Documentación de validación de teléfono (referencia)

---

## 📊 Resumen de Campos Validados

| Reporte | Campo | Validación HTML5 | Validación onChange | Validación Submit | Validación Rango |
|---------|-------|------------------|---------------------|-------------------|------------------|
| Ventas | fecha_inicio | ✅ | ✅ | ✅ | ✅ |
| Ventas | fecha_fin | ✅ | ✅ | ✅ | ✅ |
| Compras | fecha_inicio | ✅ | ✅ | ✅ | ✅ |
| Compras | fecha_fin | ✅ | ✅ | ✅ | ✅ |
| Productos | fecha_inicio | ✅ | ✅ | ✅ | ✅ |
| Productos | fecha_fin | ✅ | ✅ | ✅ | ✅ |

**Total**: 6 campos validados con cuádruple capa de validación (HTML5 + onChange + Submit + Rango)

---

**Documentación generada**: 3 de mayo de 2026
