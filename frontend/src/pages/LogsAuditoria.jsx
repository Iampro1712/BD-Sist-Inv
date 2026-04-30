import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLogsAuditoria } from '../hooks/useLogsAuditoria'
import DataTable from '../components/ui/DataTable'
import { Badge } from '../components/ui/Badge'
import DateRangePicker from '../components/forms/DateRangePicker'
import { Button } from '../components/ui/Button'

const LogsAuditoria = () => {
  const [filters, setFilters] = useState({
    id_producto: '',
    operacion: '',
    fecha_inicio: '',
    fecha_fin: '',
    search: ''
  })

  const { logs, isLoading, error, estadisticas, isLoadingEstadisticas } = useLogsAuditoria(filters)

  // Debug: Ver qué datos estamos recibiendo
  console.log('🔍 Logs Auditoría Debug:', {
    logs,
    logsLength: logs?.length,
    logsType: typeof logs,
    isArray: Array.isArray(logs),
    isLoading,
    error,
    estadisticas
  })

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleClearFilters = () => {
    setFilters({
      id_producto: '',
      operacion: '',
      fecha_inicio: '',
      fecha_fin: '',
      search: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(value => value !== '')

  const getOperacionBadge = (operacion) => {
    const badges = {
      'INSERT': <Badge variant="success">Creación</Badge>,
      'UPDATE': <Badge variant="warning">Modificación</Badge>,
      'DELETE': <Badge variant="danger">Eliminación</Badge>
    }
    return badges[operacion] || <Badge>{operacion}</Badge>
  }

  const getTipoCambioBadge = (tipoCambio) => {
    if (tipoCambio.includes('creado')) {
      return <Badge variant="success">{tipoCambio}</Badge>
    } else if (tipoCambio.includes('eliminado')) {
      return <Badge variant="danger">{tipoCambio}</Badge>
    } else if (tipoCambio.includes('Stock')) {
      return <Badge variant="info">{tipoCambio}</Badge>
    } else if (tipoCambio.includes('Precio')) {
      return <Badge variant="warning">{tipoCambio}</Badge>
    }
    return <Badge variant="secondary">{tipoCambio}</Badge>
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-NI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const columns = [
    {
      key: 'fecha_cambio',
      label: 'Fecha',
      render: (value, log) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {formatFecha(log.fecha_cambio)}
          </div>
        </div>
      )
    },
    {
      key: 'producto',
      label: 'Producto',
      render: (value, log) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">{log.nombre_producto}</div>
          <div className="text-gray-500 dark:text-gray-400">{log.sku_producto}</div>
        </div>
      )
    },
    {
      key: 'operacion',
      label: 'Operación',
      render: (value, log) => getOperacionBadge(log.operacion)
    },
    {
      key: 'tipo_cambio',
      label: 'Tipo de Cambio',
      render: (value, log) => getTipoCambioBadge(log.tipo_cambio)
    },
    {
      key: 'cambios',
      label: 'Detalles',
      render: (value, log) => (
        <div className="text-sm space-y-1">
          {log.diferencia_cantidad !== null && log.diferencia_cantidad !== 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-gray-400">Stock:</span>
              <span className="font-medium">
                {log.cantidad_anterior || 0} → {log.cantidad_nueva || 0}
              </span>
              <span className={log.diferencia_cantidad > 0 ? 'text-green-600' : 'text-red-600'}>
                ({log.diferencia_cantidad > 0 ? '+' : ''}{log.diferencia_cantidad})
              </span>
            </div>
          )}
          {log.diferencia_precio_final !== null && parseFloat(log.diferencia_precio_final) !== 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-gray-400">Precio:</span>
              <span className="font-medium">
                C${log.precio_final_anterior || 0} → C${log.precio_final_nuevo || 0}
              </span>
              <span className={parseFloat(log.diferencia_precio_final) > 0 ? 'text-green-600' : 'text-red-600'}>
                ({parseFloat(log.diferencia_precio_final) > 0 ? '+' : ''}C${log.diferencia_precio_final})
              </span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'usuario',
      label: 'Usuario',
      render: (value, log) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-white">{log.usuario || 'Sistema'}</div>
          {log.ip_address && (
            <div className="text-gray-500 dark:text-gray-400 text-xs">{log.ip_address}</div>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs de Auditoría</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Historial completo de cambios en productos
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      {!isLoadingEstadisticas && estadisticas && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Registros</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {estadisticas.total_registros || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Creaciones</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {estadisticas.total_inserts || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Modificaciones</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                  {estadisticas.total_updates || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Eliminaciones</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {estadisticas.total_deletes || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Buscar por producto, SKU o usuario..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Operación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Operación
            </label>
            <select
              value={filters.operacion}
              onChange={(e) => handleFilterChange('operacion', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todas</option>
              <option value="INSERT">Creación</option>
              <option value="UPDATE">Modificación</option>
              <option value="DELETE">Eliminación</option>
            </select>
          </div>

          {/* Botón Limpiar */}
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="w-full"
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>

        {/* Rango de Fechas */}
        <div className="mt-4">
          <DateRangePicker
            startDate={filters.fecha_inicio}
            endDate={filters.fecha_fin}
            onStartDateChange={(value) => handleFilterChange('fecha_inicio', value)}
            onEndDateChange={(value) => handleFilterChange('fecha_fin', value)}
          />
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <DataTable
          data={logs}
          columns={columns}
          loading={isLoading}
          emptyMessage="No se encontraron registros de auditoría"
        />
      </div>
    </div>
  )
}

export default LogsAuditoria
