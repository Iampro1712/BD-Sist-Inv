# Implementación de Pago por Adelantado en Inventrix

## 📋 Resumen Ejecutivo

Este documento detalla dónde y cómo implementar la funcionalidad de **pago por adelantado** (anticipo/abono) en el sistema de inventario Inventrix. La funcionalidad permitirá a los clientes realizar pagos parciales sobre una orden de venta antes de la entrega final.

---

## 🎯 Objetivos

1. Permitir registrar pagos parciales (abonos) en órdenes de venta
2. Rastrear el saldo pendiente de cada orden
3. Permitir múltiples pagos hasta cubrir el total
4. Generar historial de pagos por orden
5. Mostrar estado de pago en listados y detalles

---

## 🗄️ Cambios en la Base de Datos

### 1. Nueva tabla: `pagos_venta`

```sql
CREATE TABLE pagos_venta (
    id_pago SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
    monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    referencia VARCHAR(100),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagos_venta_id_venta ON pagos_venta(id_venta);
CREATE INDEX idx_pagos_venta_fecha ON pagos_venta(fecha_pago);
```

### 2. Agregar columnas a la tabla `ventas`

```sql
ALTER TABLE ventas
ADD COLUMN monto_pagado DECIMAL(10, 2) DEFAULT 0 NOT NULL,
ADD COLUMN saldo_pendiente DECIMAL(10, 2),
ADD COLUMN estado_pago VARCHAR(20) DEFAULT 'pendiente';

-- Actualizar saldo pendiente basado en el total
UPDATE ventas SET saldo_pendiente = total - monto_pagado;
```


**Estados de pago:**
- `pendiente`: No se ha recibido ningún pago
- `parcial`: Se ha recibido un abono pero no el total
- `pagado`: Se ha pagado el total completo

---

## 🐍 Backend - Django

### 1. Modelo (`backend/inventory/models.py`)

Agregar después del modelo `OrdenVenta`:

```python
class PagoVenta(models.Model):
    """Modelo para registrar pagos/abonos de una venta"""
    METODO_PAGO_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('tarjeta', 'Tarjeta'),
        ('transferencia', 'Transferencia'),
        ('deposito', 'Depósito'),
        ('cheque', 'Cheque'),
    ]

    id_pago = models.AutoField(primary_key=True)
    id_venta = models.ForeignKey(
        OrdenVenta,
        on_delete=models.CASCADE,
        related_name='pagos',
        db_column='id_venta'
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = models.DateField(default=date.today)
    metodo_pago = models.CharField(max_length=50, choices=METODO_PAGO_CHOICES, default='efectivo')
    referencia = models.CharField(max_length=100, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'pagos_venta'
        verbose_name = 'Pago de Venta'
        verbose_name_plural = 'Pagos de Ventas'
        ordering = ['-fecha_pago']

    def __str__(self):
        return f"Pago #{self.id_pago} - Venta #{self.id_venta.id_venta} - C${self.monto}"
```


Actualizar el modelo `OrdenVenta` para incluir los nuevos campos:

```python
class OrdenVenta(models.Model):
    """Modelo para órdenes de venta (tabla ventas)"""
    ESTADO_PAGO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('parcial', 'Pago Parcial'),
        ('pagado', 'Pagado'),
    ]

    id_venta = models.AutoField(primary_key=True)
    id_cliente = models.IntegerField()
    fecha = models.DateField()
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    saldo_pendiente = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    estado_pago = models.CharField(max_length=20, choices=ESTADO_PAGO_CHOICES, default='pendiente')

    class Meta:
        managed = False
        db_table = 'ventas'
        verbose_name = 'Orden de Venta'
        verbose_name_plural = 'Órdenes de Venta'
        ordering = ['-fecha']

    def calcular_saldo(self):
        """Calcula y actualiza el saldo pendiente"""
        self.monto_pagado = self.pagos.aggregate(
            total=models.Sum('monto')
        )['total'] or 0
        self.saldo_pendiente = self.total - self.monto_pagado
        
        # Actualizar estado de pago
        if self.monto_pagado == 0:
            self.estado_pago = 'pendiente'
        elif self.monto_pagado >= self.total:
            self.estado_pago = 'pagado'
        else:
            self.estado_pago = 'parcial'
        
        self.save()

    def __str__(self):
        return f"Venta #{self.id_venta}"
```


### 2. Serializers (`backend/api/serializers.py`)

Agregar después de `OrdenVentaDetailSerializer`:

```python
class PagoVentaSerializer(serializers.ModelSerializer):
    """Serializer para pagos de venta"""
    metodo_pago_display = serializers.CharField(source='get_metodo_pago_display', read_only=True)
    
    class Meta:
        model = PagoVenta
        fields = [
            'id_pago', 'id_venta', 'monto', 'fecha_pago',
            'metodo_pago', 'metodo_pago_display', 'referencia',
            'notas', 'created_at'
        ]
        read_only_fields = ['created_at']


class PagoVentaCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear un pago/abono"""
    class Meta:
        model = PagoVenta
        fields = ['id_venta', 'monto', 'fecha_pago', 'metodo_pago', 'referencia', 'notas']
    
    def validate(self, data):
        """Validar que el monto no exceda el saldo pendiente"""
        venta = OrdenVenta.objects.get(id_venta=data['id_venta'])
        saldo = venta.total - (venta.monto_pagado or 0)
        
        if data['monto'] > saldo:
            raise serializers.ValidationError({
                'monto': f'El monto excede el saldo pendiente de C${saldo:.2f}'
            })
        
        if data['monto'] <= 0:
            raise serializers.ValidationError({
                'monto': 'El monto debe ser mayor a cero'
            })
        
        return data
    
    def create(self, validated_data):
        """Crear el pago y actualizar el saldo de la venta"""
        pago = PagoVenta.objects.create(**validated_data)
        
        # Actualizar saldo de la venta
        venta = pago.id_venta
        venta.calcular_saldo()
        
        return pago
```


Actualizar `OrdenVentaDetailSerializer` para incluir información de pagos:

```python
class OrdenVentaDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para orden de venta"""
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    estado_pago_display = serializers.CharField(source='get_estado_pago_display', read_only=True)
    productos = serializers.SerializerMethodField()
    pagos = PagoVentaSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()
    monto_pagado = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = OrdenVenta
        fields = [
            'id_venta', 'id_cliente', 'cliente_nombre', 'fecha',
            'estado_display', 'estado_pago', 'estado_pago_display',
            'total', 'monto_pagado', 'saldo_pendiente',
            'productos', 'pagos'
        ]
    
    # ... resto de métodos existentes ...
```

Y actualizar `OrdenVentaListSerializer`:

```python
class OrdenVentaListSerializer(serializers.ModelSerializer):
    """Serializer para listado de órdenes de venta"""
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    estado_pago_display = serializers.CharField(source='get_estado_pago_display', read_only=True)
    
    class Meta:
        model = OrdenVenta
        fields = [
            'id_venta', 'id_cliente', 'cliente_nombre', 'fecha',
            'estado_display', 'estado_pago', 'estado_pago_display',
            'total', 'monto_pagado', 'saldo_pendiente'
        ]
    
    # ... resto de métodos existentes ...
```


### 3. Views (`backend/api/views.py`)

Agregar después de las vistas de órdenes de venta:

```python
@api_view(['POST'])
def registrar_pago_venta(request, id_venta):
    """Registrar un pago/abono para una venta"""
    try:
        venta = OrdenVenta.objects.get(id_venta=id_venta)
    except OrdenVenta.DoesNotExist:
        return Response(
            {'error': 'Venta no encontrada'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Validar que la venta no esté completamente pagada
    if venta.estado_pago == 'pagado':
        return Response(
            {'error': 'Esta venta ya está completamente pagada'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    data = {**request.data, 'id_venta': id_venta}
    serializer = PagoVentaCreateSerializer(data=data)
    
    if serializer.is_valid():
        pago = serializer.save()
        return Response(
            PagoVentaSerializer(pago).data,
            status=status.HTTP_201_CREATED
        )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def listar_pagos_venta(request, id_venta):
    """Listar todos los pagos de una venta"""
    pagos = PagoVenta.objects.filter(id_venta=id_venta).order_by('-fecha_pago')
    serializer = PagoVentaSerializer(pagos, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
def eliminar_pago_venta(request, id_pago):
    """Eliminar un pago (solo si es el último registrado)"""
    try:
        pago = PagoVenta.objects.get(id_pago=id_pago)
    except PagoVenta.DoesNotExist:
        return Response(
            {'error': 'Pago no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verificar que sea el último pago
    ultimo_pago = PagoVenta.objects.filter(id_venta=pago.id_venta).order_by('-created_at').first()
    if pago.id_pago != ultimo_pago.id_pago:
        return Response(
            {'error': 'Solo se puede eliminar el último pago registrado'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    venta = pago.id_venta
    pago.delete()
    venta.calcular_saldo()
    
    return Response(status=status.HTTP_204_NO_CONTENT)
```


### 4. URLs (`backend/api/urls.py`)

Agregar las rutas:

```python
# En la sección de órdenes de venta
path('ordenes-venta/<int:id_venta>/pagos/', listar_pagos_venta, name='listar-pagos-venta'),
path('ordenes-venta/<int:id_venta>/registrar-pago/', registrar_pago_venta, name='registrar-pago-venta'),
path('pagos-venta/<int:id_pago>/', eliminar_pago_venta, name='eliminar-pago-venta'),
```

---

## ⚛️ Frontend - React

### 1. Servicio API (`frontend/src/services/ordenes.service.js`)

Actualizar el objeto `ordenesVentaService`:

```javascript
export const ordenesVentaService = {
  // ... métodos existentes ...

  // Métodos de pagos
  getPagos: (idVenta) => {
    return api.get(`/ordenes-venta/${idVenta}/pagos/`)
  },

  registrarPago: (idVenta, data) => {
    return api.post(`/ordenes-venta/${idVenta}/registrar-pago/`, data)
  },

  eliminarPago: (idPago) => {
    return api.delete(`/pagos-venta/${idPago}/`)
  },
}
```


### 2. Hook personalizado (`frontend/src/hooks/useOrdenesVenta.js`)

Agregar al final del archivo:

```javascript
export const usePagosVenta = (idVenta) => {
  return useQuery({
    queryKey: ['pagos-venta', idVenta],
    queryFn: () => ordenesVentaService.getPagos(idVenta).then(res => res.data),
    enabled: !!idVenta,
  })
}

export const useRegistrarPago = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ idVenta, data }) => ordenesVentaService.registrarPago(idVenta, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
      queryClient.invalidateQueries({ queryKey: ['pagos-venta', variables.idVenta] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const useEliminarPago = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ idPago, idVenta }) => ordenesVentaService.eliminarPago(idPago),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-venta'] })
      queryClient.invalidateQueries({ queryKey: ['pagos-venta', variables.idVenta] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
```


### 3. Componente de Formulario de Pago

Crear archivo: `frontend/src/components/forms/PagoForm.jsx`

```javascript
import { useState } from 'react'
import { Button } from '../ui'

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
    err ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
  }`

const PagoForm = ({ orden, onSubmit, onCancel, isLoading = false }) => {
  const saldoPendiente = orden.saldo_pendiente || orden.total

  const [formData, setFormData] = useState({
    monto: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'efectivo',
    referencia: '',
    notas: '',
  })

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      errs.monto = 'El monto debe ser mayor a cero'
    } else if (parseFloat(formData.monto) > saldoPendiente) {
      errs.monto = `El monto no puede exceder el saldo pendiente (C$${saldoPendiente})`
    }
    if (!formData.fecha_pago) errs.fecha_pago = 'La fecha es requerida'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      ...formData,
      monto: parseFloat(formData.monto),
    })
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Información de la venta */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total de la venta:</span>
            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(orden.total)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Saldo pendiente:</span>
            <p className="font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(saldoPendiente)}</p>
          </div>
        </div>
      </div>

      {/* Monto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Monto del pago <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={saldoPendiente}
          name="monto"
          value={formData.monto}
          onChange={handleChange}
          className={inputCls(errors.monto)}
          placeholder="0.00"
        />
        {errors.monto && <p className="mt-1 text-xs text-red-500">{errors.monto}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fecha de pago <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="fecha_pago"
            value={formData.fecha_pago}
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
            className={inputCls(errors.fecha_pago)}
          />
          {errors.fecha_pago && <p className="mt-1 text-xs text-red-500">{errors.fecha_pago}</p>}
        </div>

        {/* Método de pago */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Método de pago
          </label>
          <select
            name="metodo_pago"
            value={formData.metodo_pago}
            onChange={handleChange}
            className={inputCls(false)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="deposito">Depósito</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Referencia */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Referencia <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          name="referencia"
          value={formData.referencia}
          onChange={handleChange}
          className={inputCls(false)}
          placeholder="Ej: N° de comprobante, N° de transacción"
        />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          name="notas"
          value={formData.notas}
          onChange={handleChange}
          rows={2}
          placeholder="Observaciones sobre el pago..."
          className={inputCls(false) + ' resize-none'}
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          Registrar pago
        </Button>
      </div>
    </form>
  )
}

export default PagoForm
```


### 4. Actualizar OrdenVentaDetalle

Modificar: `frontend/src/components/ordenes/OrdenVentaDetalle.jsx`

Agregar sección de pagos después de la sección de productos:

```javascript
// ... imports existentes ...
import { usePagosVenta, useRegistrarPago, useEliminarPago } from '../../hooks/useOrdenesVenta'
import { useToast } from '../../hooks/useToast'
import PagoForm from '../forms/PagoForm'
import Modal from '../ui/Modal'
import { Button } from '../ui'
import { useState } from 'react'

const OrdenVentaDetalle = ({ orden }) => {
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false)
  const toast = useToast()

  const { data: pagosData } = usePagosVenta(orden.id_venta)
  const registrarPagoMutation = useRegistrarPago()
  const eliminarPagoMutation = useEliminarPago()

  const pagos = pagosData || []
  const saldoPendiente = orden.saldo_pendiente || 0
  const montoPagado = orden.monto_pagado || 0

  const handleRegistrarPago = async (data) => {
    try {
      await registrarPagoMutation.mutateAsync({ idVenta: orden.id_venta, data })
      setIsPagoModalOpen(false)
      toast.success('Pago registrado exitosamente')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al registrar el pago'
      toast.error(msg)
    }
  }

  const handleEliminarPago = async (idPago) => {
    if (!window.confirm('¿Estás seguro de eliminar este pago?')) return
    
    try {
      await eliminarPagoMutation.mutateAsync({ idPago, idVenta: orden.id_venta })
      toast.success('Pago eliminado exitosamente')
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al eliminar el pago'
      toast.error(msg)
    }
  }

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(v || 0)

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-NI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const totalItems = orden.productos?.reduce((s, p) => s + (p.cantidad || 1), 0) || 0
  const subtotal   = orden.productos?.reduce((s, p) => s + (p.subtotal || 0), 0) || 0
  const descuento  = subtotal - (orden.total || 0)

  return (
    <div className="space-y-5">

      {/* ... Secciones existentes (Header, Cliente, Productos, Totales) ... */}

      {/* NUEVA SECCIÓN: Estado de Pago */}
      <motion.div variants={fadeIn} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Estado de pago
          </p>
          {orden.estado_pago !== 'pagado' && (
            <Button size="sm" onClick={() => setIsPagoModalOpen(true)}>
              + Registrar pago
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(orden.total)}</p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
            <p className="text-xs text-green-600 dark:text-green-400 mb-1">Pagado</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(montoPagado)}</p>
          </div>
          
          <div className={`rounded-lg border p-3 ${
            saldoPendiente > 0 
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' 
              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
          }`}>
            <p className={`text-xs mb-1 ${
              saldoPendiente > 0 
                ? 'text-amber-600 dark:text-amber-400' 
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              Saldo pendiente
            </p>
            <p className={`text-lg font-bold ${
              saldoPendiente > 0 
                ? 'text-amber-700 dark:text-amber-300' 
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {formatCurrency(saldoPendiente)}
            </p>
          </div>
        </div>

        {/* Badge de estado */}
        <div className="flex justify-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            orden.estado_pago === 'pagado' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : orden.estado_pago === 'parcial'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {orden.estado_pago === 'pagado' ? '✓ Pagado completo' : 
             orden.estado_pago === 'parcial' ? '◐ Pago parcial' : '○ Pendiente de pago'}
          </span>
        </div>
      </motion.div>

      {/* NUEVA SECCIÓN: Historial de pagos */}
      {pagos.length > 0 && (
        <motion.div variants={fadeIn}>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Historial de pagos ({pagos.length})
          </p>
          
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Método</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Referencia</th>
                  <th className="px-4 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {pagos.map((pago, i) => (
                  <tr key={pago.id_pago} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(pago.fecha_pago).toLocaleDateString('es-NI', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {pago.metodo_pago_display}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(pago.monto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 font-mono">
                      {pago.referencia || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i === 0 && ( /* Solo mostrar botón eliminar para el último pago */
                        <button
                          onClick={() => handleEliminarPago(pago.id_pago)}
                          className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Eliminar pago"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ... Sección de Notas existente ... */}

      {/* Modal para registrar pago */}
      <Modal 
        isOpen={isPagoModalOpen} 
        onClose={() => setIsPagoModalOpen(false)} 
        title="Registrar Pago"
        size="md"
      >
        <PagoForm
          orden={orden}
          onSubmit={handleRegistrarPago}
          onCancel={() => setIsPagoModalOpen(false)}
          isLoading={registrarPagoMutation.isPending}
        />
      </Modal>

    </div>
  )
}

export default OrdenVentaDetalle
```


### 5. Actualizar OrdenesVenta (Listado)

Modificar: `frontend/src/pages/OrdenesVenta.jsx`

Agregar columna de estado de pago en la tabla:

```javascript
// En la tabla, agregar nueva columna después de Fecha:
<thead className="bg-gray-50 dark:bg-gray-900/50">
  <tr>
    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28"># Venta</th>
    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">Cliente</th>
    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Fecha</th>
    {/* NUEVA COLUMNA */}
    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Estado Pago</th>
    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Total</th>
    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Acciones</th>
  </tr>
</thead>

// En el cuerpo de la tabla, agregar celda de estado:
<tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
  {ordenes.map((orden) => (
    <motion.tr
      key={orden.id_venta}
      variants={fadeIn}
      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      <td className="px-6 py-5 whitespace-nowrap">
        <span className="text-sm font-mono font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          #{orden.id_venta}
        </span>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
              {(orden.cliente_nombre || '?')[0].toUpperCase()}
            </span>
          </div>
          <span className="text-base font-medium text-gray-900 dark:text-white">
            {orden.cliente_nombre}
          </span>
        </div>
      </td>
      <td className="px-6 py-5 whitespace-nowrap text-base text-gray-500 dark:text-gray-400">
        {formatDate(orden.fecha)}
      </td>
      {/* NUEVA CELDA DE ESTADO */}
      <td className="px-6 py-5 whitespace-nowrap text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          orden.estado_pago === 'pagado' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : orden.estado_pago === 'parcial'
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {orden.estado_pago === 'pagado' ? 'Pagado' : 
           orden.estado_pago === 'parcial' ? 'Parcial' : 'Pendiente'}
        </span>
      </td>
      <td className="px-6 py-5 whitespace-nowrap text-right">
        <span className="text-base font-bold text-gray-900 dark:text-white">
          {formatCurrency(orden.total)}
        </span>
        {orden.estado_pago === 'parcial' && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Saldo: {formatCurrency(orden.saldo_pendiente)}
          </p>
        )}
      </td>
      <td className="px-6 py-5 whitespace-nowrap text-right">
        <button
          onClick={() => handleOpenDetalle(orden.id_venta)}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          title="Ver detalle"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </td>
    </motion.tr>
  ))}
</tbody>
```


### 6. Opcional: Agregar filtro por estado de pago

En `OrdenesVenta.jsx`, agregar un selector de filtro:

```javascript
const [estadoPagoFiltro, setEstadoPagoFiltro] = useState('')

// En la query:
const { data, isLoading, error } = useOrdenesVenta({
  search: debouncedSearch,
  cliente: clienteFiltro || undefined,
  fecha_inicio: fechaInicio || undefined,
  fecha_fin: fechaFin || undefined,
  estado_pago: estadoPagoFiltro || undefined,
  page,
})

// En la UI de filtros, agregar:
<select
  value={estadoPagoFiltro}
  onChange={(e) => { setEstadoPagoFiltro(e.target.value); setPage(1) }}
  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
>
  <option value="">Todos los estados</option>
  <option value="pendiente">Pendiente</option>
  <option value="parcial">Pago Parcial</option>
  <option value="pagado">Pagado</option>
</select>
```

---

## 📊 Dashboard - Estadísticas de Pagos

Opcionalmente, puedes agregar widgets en el Dashboard para mostrar:

1. **Total pendiente de cobro**: Suma de todos los `saldo_pendiente > 0`
2. **Ventas con pagos parciales**: Conteo de ventas con `estado_pago = 'parcial'`
3. **Tasa de cobro**: Porcentaje de ventas completamente pagadas

Agregar en `backend/api/views.py` en la vista de dashboard:

```python
# En get_dashboard_stats()
with connection.cursor() as cursor:
    # ... código existente ...
    
    # Estadísticas de pagos
    cursor.execute("""
        SELECT 
            COUNT(*) FILTER (WHERE estado_pago = 'pendiente') as ventas_pendientes,
            COUNT(*) FILTER (WHERE estado_pago = 'parcial') as ventas_parciales,
            COUNT(*) FILTER (WHERE estado_pago = 'pagado') as ventas_pagadas,
            COALESCE(SUM(saldo_pendiente), 0) as total_por_cobrar
        FROM ventas
        WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
    """)
    pagos_stats = cursor.fetchone()
    
    return Response({
        # ... datos existentes ...
        'pagos': {
            'ventas_pendientes': pagos_stats[0],
            'ventas_parciales': pagos_stats[1],
            'ventas_pagadas': pagos_stats[2],
            'total_por_cobrar': float(pagos_stats[3]),
        }
    })
```


---

## 📝 Flujo de Trabajo

### Escenario típico:

1. **Cliente realiza una compra** → Se crea la orden de venta con `total = 1000`, `monto_pagado = 0`, `saldo_pendiente = 1000`, `estado_pago = 'pendiente'`

2. **Cliente da un anticipo de C$300**:
   - Se registra un pago: `monto = 300`, `metodo_pago = 'efectivo'`
   - La orden se actualiza: `monto_pagado = 300`, `saldo_pendiente = 700`, `estado_pago = 'parcial'`

3. **Cliente abona C$500 más**:
   - Se registra segundo pago: `monto = 500`
   - La orden se actualiza: `monto_pagado = 800`, `saldo_pendiente = 200`, `estado_pago = 'parcial'`

4. **Cliente paga los C$200 restantes**:
   - Se registra tercer pago: `monto = 200`
   - La orden se actualiza: `monto_pagado = 1000`, `saldo_pendiente = 0`, `estado_pago = 'pagado'`

---

## ✅ Checklist de Implementación

### Backend:
- [ ] Ejecutar script SQL para crear tabla `pagos_venta`
- [ ] Ejecutar script SQL para agregar columnas a `ventas`
- [ ] Agregar modelo `PagoVenta` en `models.py`
- [ ] Actualizar modelo `OrdenVenta` con nuevos campos
- [ ] Agregar serializers de pagos en `serializers.py`
- [ ] Actualizar serializers de orden de venta
- [ ] Agregar vistas para pagos en `views.py`
- [ ] Agregar rutas en `urls.py`
- [ ] Ejecutar migraciones (si usas `managed=True`)
- [ ] Probar endpoints en Postman/Thunder Client

### Frontend:
- [ ] Actualizar servicio de órdenes (`ordenes.service.js`)
- [ ] Agregar hooks de pagos (`useOrdenesVenta.js`)
- [ ] Crear componente `PagoForm.jsx`
- [ ] Actualizar `OrdenVentaDetalle.jsx` con sección de pagos
- [ ] Actualizar `OrdenesVenta.jsx` con columna de estado
- [ ] Agregar filtro por estado de pago (opcional)
- [ ] Actualizar Dashboard con estadísticas de pagos (opcional)
- [ ] Probar flujo completo en navegador

---

## 🧪 Casos de Prueba

1. **Registrar primer pago parcial**: Verificar que cambie a estado "parcial"
2. **Registrar pago que completa el total**: Verificar que cambie a "pagado"
3. **Intentar pagar más del saldo**: Debe mostrar error de validación
4. **Eliminar el último pago**: Verificar que recalcule correctamente el saldo
5. **Intentar eliminar un pago que no es el último**: Debe mostrar error
6. **Ver historial de pagos**: Verificar orden cronológico descendente
7. **Filtrar ventas por estado de pago**: Verificar que funcione correctamente
8. **Dashboard**: Verificar que muestre estadísticas actualizadas

---

## 🎨 Mejoras Futuras

1. **Notificaciones**: Enviar SMS/email al registrar un pago
2. **Reportes**: Generar reporte de cuentas por cobrar
3. **Recordatorios**: Sistema de recordatorios automáticos para pagos pendientes
4. **Múltiples métodos por pago**: Permitir combinar efectivo + tarjeta en un mismo pago
5. **Recibos de pago**: Generar PDF con comprobante de pago
6. **Programar pagos**: Establecer fechas de vencimiento para pagos parciales
7. **Intereses**: Calcular intereses por mora en pagos atrasados

---

## 📞 Soporte

Si tienes dudas durante la implementación, revisa:
- Modelos existentes en `inventory/models.py`
- Patrones de serializers en `api/serializers.py`
- Componentes similares en `frontend/src/components/`

---

**¡Buena suerte con la implementación! 🚀**
