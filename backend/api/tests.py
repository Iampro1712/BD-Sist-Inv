"""
Tests de integración para los flujos críticos del negocio: ventas, stock y
pagos. Corren contra una base de datos Postgres real con el esquema híbrido
(ver backend/SQL_FILES/000_base_schema_snapshot.sql y .github/workflows/ci.yml
para cómo se bootstrapea en CI).
"""
import datetime

from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase

from inventory.models import (
    Proveedor, Producto, Cliente, MovimientoInventario, OrdenVenta, SesionCaja,
    CategoriaGasto, OrdenCompra, Moto, Servicio, ServicioMoto, BitacoraServicio,
    Cotizacion, Ubicacion, DevolucionCompra, AuditoriaProducto,
)


class VentaStockTestCase(APITestCase):
    """Crear una venta debe descontar stock; cancelarla debe restituirlo."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='tester', password='x')
        self.client.force_authenticate(user=self.user)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Test')
        self.producto = Producto.objects.create(
            sku_producto='SKU-TEST-1',
            nombre='Producto de prueba',
            cantidad_actual=10,
            cantidad_total=10,
            cantidad_minima=1,
            precio_compra_unitario=5,
            precio_final='10.00',
            id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Cliente Test')

    def _crear_venta(self, cantidad, precio_unitario=5):
        return self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': str(cantidad * precio_unitario),
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': cantidad,
                'precio_unitario': precio_unitario,
            }],
        }, format='json')

    def test_crear_venta_descuenta_stock(self):
        response = self._crear_venta(cantidad=3)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 7)

        movimiento = MovimientoInventario.objects.get(
            producto=self.producto, tipo='SALIDA', tipo_referencia='ORDEN_VENTA'
        )
        self.assertEqual(movimiento.cantidad, 3)

    def test_crear_venta_con_stock_insuficiente_no_descuenta_nada(self):
        response = self._crear_venta(cantidad=999)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)
        self.assertFalse(OrdenVenta.objects.filter(id_cliente=self.cliente.id_cliente).exists())

    def test_cancelar_venta_restituye_stock_y_elimina_la_venta(self):
        crear = self._crear_venta(cantidad=4)
        id_venta = crear.data['id_venta']

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 6)

        cancelar = self.client.post(f'/api/ordenes-venta/{id_venta}/cancelar/', {
            'motivo': 'prueba automatizada',
        }, format='json')
        self.assertEqual(cancelar.status_code, status.HTTP_200_OK, cancelar.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)
        self.assertFalse(OrdenVenta.objects.filter(pk=id_venta).exists())


class PagoVentaTestCase(APITestCase):
    """Registrar/eliminar pagos debe recalcular saldo y estado_pago correctamente."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='tester2', password='x')
        self.client.force_authenticate(user=self.user)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Test 2')
        self.producto = Producto.objects.create(
            sku_producto='SKU-TEST-2',
            nombre='Producto de prueba 2',
            cantidad_actual=10,
            cantidad_total=10,
            cantidad_minima=1,
            precio_compra_unitario=5,
            precio_final='10.00',
            id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Cliente Test 2')

        # Registrar pagos requiere una caja abierta (feature de caja).
        self.client.post('/api/caja/abrir/', {'monto_apertura': '0.00'}, format='json')

        venta = self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': '100',
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': 5,
                'precio_unitario': 20,
            }],
        }, format='json')
        self.id_venta = venta.data['id_venta']

    def test_registrar_pago_parcial_actualiza_saldo_y_estado(self):
        response = self.client.post(
            f'/api/ordenes-venta/{self.id_venta}/registrar-pago/',
            {'monto': '40.00', 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        orden = OrdenVenta.objects.get(pk=self.id_venta)
        self.assertEqual(orden.estado_pago, 'parcial')
        self.assertEqual(orden.monto_pagado, 40)
        self.assertEqual(orden.saldo_pendiente, 60)

    def test_registrar_pago_completo_marca_como_pagado(self):
        response = self.client.post(
            f'/api/ordenes-venta/{self.id_venta}/registrar-pago/',
            {'monto': '100.00', 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        orden = OrdenVenta.objects.get(pk=self.id_venta)
        self.assertEqual(orden.estado_pago, 'pagado')
        self.assertEqual(orden.saldo_pendiente, 0)

    def test_pago_no_puede_exceder_el_saldo_pendiente(self):
        response = self.client.post(
            f'/api/ordenes-venta/{self.id_venta}/registrar-pago/',
            {'monto': '150.00', 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        orden = OrdenVenta.objects.get(pk=self.id_venta)
        self.assertEqual(orden.estado_pago, 'pendiente')


class MovimientoInventarioAjusteTestCase(APITestCase):
    """El ajuste manual de inventario debe fijar la cantidad exacta indicada.

    Ajustar stock es acción de administrador (US-04), por eso el usuario de
    prueba es is_staff=True."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='tester3', password='x', is_staff=True)
        self.client.force_authenticate(user=self.user)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Test 3')
        self.producto = Producto.objects.create(
            sku_producto='SKU-TEST-3',
            nombre='Producto de prueba 3',
            cantidad_actual=10,
            cantidad_total=10,
            cantidad_minima=1,
            precio_compra_unitario=5,
            precio_final='10.00',
            id_proveedor=self.proveedor,
        )

    def test_ajuste_manual_suma_la_cantidad_como_delta(self):
        # 'cantidad' es un delta sobre el stock actual, no un valor absoluto.
        response = self.client.post('/api/movimientos/ajuste/', {
            'producto_id': self.producto.id_producto,
            'cantidad': 15,
            'notas': 'Conteo físico',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 25)

    def test_ajuste_manual_rechaza_stock_negativo(self):
        response = self.client.post('/api/movimientos/ajuste/', {
            'producto_id': self.producto.id_producto,
            'cantidad': -999,
            'notas': 'Ajuste inválido',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)


class MarcaCategoriaTestCase(APITestCase):
    """R03: marcas/categorias no existían físicamente (bug en vivo, ver
    migración 0011_crear_marcas_categorias). Estas tablas ahora sí existen."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='tester4', password='x')
        self.client.force_authenticate(user=self.user)

    def test_listar_marcas(self):
        response = self.client.get('/api/marcas/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_listar_categorias(self):
        response = self.client.get('/api/categorias/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)


class PermisosAdminTestCase(APITestCase):
    """US-02/US-03: backup, reportes financieros y auditoría son solo para
    administradores. Un usuario autenticado no-admin recibe 403."""

    # Endpoints que deben quedar restringidos a administradores.
    ADMIN_ONLY = [
        '/api/backup/',
        '/api/reportes/inventario/',
        '/api/reportes/ventas/',
        '/api/reportes/compras/',
        '/api/reportes/productos_mas_vendidos/',
        '/api/reportes/cuentas-por-cobrar/',
        '/api/reportes/rentabilidad/',
        '/api/reportes/stock-muerto/',
        '/api/auditoria-productos/',
    ]

    def setUp(self):
        User = get_user_model()
        self.empleado = User.objects.create_user(username='empleado', password='x')
        self.admin = User.objects.create_user(
            username='jefe', password='x', is_staff=True
        )

    def test_no_admin_recibe_403(self):
        self.client.force_authenticate(user=self.empleado)
        for url in self.ADMIN_ONLY:
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url).status_code,
                    status.HTTP_403_FORBIDDEN,
                    f'{url} deberia estar restringido a admin',
                )

    def test_admin_no_recibe_403(self):
        # Algunos reportes exigen fecha_inicio/fecha_fin y responden 400 sin
        # ellos; lo que se verifica aquí es que el permiso deja pasar al admin
        # (nunca 403/401), no el contenido del reporte.
        self.client.force_authenticate(user=self.admin)
        for url in self.ADMIN_ONLY:
            with self.subTest(url=url):
                code = self.client.get(url).status_code
                self.assertNotIn(
                    code,
                    (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                    f'{url} no deberia bloquear a un admin (fue {code})',
                )


class SegregacionRolTestCase(APITestCase):
    """US-04: acciones destructivas de catálogo/inventario son solo de admin;
    el usuario no-admin conserva ventas, pagos, alta de clientes, etc."""

    def setUp(self):
        User = get_user_model()
        self.empleado = User.objects.create_user(username='vendedor', password='x')
        self.admin = User.objects.create_user(
            username='duena', password='x', is_staff=True
        )
        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Rol')
        self.producto = Producto.objects.create(
            sku_producto='SKU-ROL', nombre='Producto rol',
            cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
            precio_compra_unitario=5, precio_final='10.00', id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Cliente Rol')

    def test_no_admin_no_puede_borrar_producto(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.delete(f'/api/productos/{self.producto.id_producto}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_admin_no_puede_crear_producto(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.post('/api/productos/', {
            'sku_producto': 'X', 'nombre': 'Y', 'cantidad_actual': 1,
            'cantidad_minima': 0, 'cantidad_total': 1,
            'precio_compra_unitario': 1, 'precio_final': '2.00',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_admin_no_puede_ajustar_stock(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.post('/api/movimientos/ajuste/', {
            'producto_id': self.producto.id_producto, 'cantidad': 5,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_admin_no_puede_borrar_cliente(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.delete(f'/api/clientes/{self.cliente.id_cliente}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_admin_si_puede_crear_cliente(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.post('/api/clientes/', {'nombre': 'Nuevo Cliente'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_no_admin_si_puede_registrar_venta(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': '10.00',
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': 1, 'precio_unitario': 10,
            }],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_admin_si_puede_borrar_producto(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.delete(f'/api/productos/{self.producto.id_producto}/')
        self.assertIn(r.status_code, (status.HTTP_204_NO_CONTENT, status.HTTP_200_OK))


class DevolucionValidacionTestCase(APITestCase):
    """US-07: una devolución no puede exceder lo vendido ni omitir la venta."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='dev', password='x')
        self.client.force_authenticate(user=self.user)
        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Dev')
        self.producto = Producto.objects.create(
            sku_producto='SKU-DEV', nombre='Producto dev',
            cantidad_actual=20, cantidad_total=20, cantidad_minima=1,
            precio_compra_unitario=5, precio_final='10.00', id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Cliente Dev')
        venta = self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': '30.00',
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': 3, 'precio_unitario': 10,
            }],
        }, format='json')
        self.id_venta = venta.data['id_venta']

    def test_devolucion_sin_venta_es_400(self):
        r = self.client.post('/api/devoluciones/', {
            'fecha': str(datetime.date.today()),
            'detalles': [{'producto': self.producto.id_producto, 'cantidad': 1, 'precio_unitario': 10}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_devolucion_excede_lo_vendido_es_400(self):
        r = self.client.post('/api/devoluciones/', {
            'venta': self.id_venta,
            'fecha': str(datetime.date.today()),
            'detalles': [{'producto': self.producto.id_producto, 'cantidad': 99, 'precio_unitario': 10}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_devolucion_valida_procesa_y_reingresa_stock(self):
        self.producto.refresh_from_db()
        stock_antes = self.producto.cantidad_actual  # 17 (20 - 3 vendidos)
        r = self.client.post('/api/devoluciones/', {
            'venta': self.id_venta,
            'fecha': str(datetime.date.today()),
            'detalles': [{'producto': self.producto.id_producto, 'cantidad': 2, 'precio_unitario': 10}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, stock_antes + 2)


class UltimoAdminTestCase(APITestCase):
    """US-08: no se puede dejar el sistema sin administradores activos."""

    def setUp(self):
        User = get_user_model()
        self.admin1 = User.objects.create_user(username='admin1', password='x', is_staff=True)
        self.admin2 = User.objects.create_user(username='admin2', password='x', is_staff=True)
        # admin1 opera; los cambios los hace un admin (permiso IsAdminUser).
        self.client.force_authenticate(user=self.admin1)

    def test_puede_desactivar_un_admin_si_queda_otro(self):
        r = self.client.patch(f'/api/usuarios/{self.admin2.id}/', {'is_active': False}, format='json')
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_202_ACCEPTED), r.data)

    def test_no_puede_quitar_staff_al_ultimo_admin(self):
        # Dejar solo a admin1 como admin activo (desactivar admin2)...
        self.admin2.is_active = False
        self.admin2.save()
        # ...e intentar quitarle is_staff a admin1 (el último admin activo).
        r = self.client.patch(f'/api/usuarios/{self.admin1.id}/', {'is_staff': False}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class CajaTestCase(APITestCase):
    """Apertura/cierre de caja, cuadre y bloqueo de cobro sin turno abierto."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='cajero', password='x')
        self.client.force_authenticate(user=self.user)
        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Caja')
        self.producto = Producto.objects.create(
            sku_producto='SKU-CAJA', nombre='Producto caja',
            cantidad_actual=50, cantidad_total=50, cantidad_minima=1,
            precio_compra_unitario=5, precio_final='10.00', id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Cliente Caja')

    def _abrir(self, monto='100.00'):
        return self.client.post('/api/caja/abrir/', {'monto_apertura': monto}, format='json')

    def _vender(self, cantidad, precio, metodo='efectivo'):
        venta = self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': str(cantidad * precio),
            'detalles': [{'producto': self.producto.id_producto, 'cantidad': cantidad, 'precio_unitario': precio}],
        }, format='json')
        id_venta = venta.data['id_venta']
        pago = self.client.post(
            f'/api/ordenes-venta/{id_venta}/registrar-pago/',
            {'monto': str(cantidad * precio), 'metodo_pago': metodo},
            format='json',
        )
        return venta, pago

    def test_cobrar_sin_caja_abierta_se_bloquea(self):
        venta, pago = self._vender(1, 10)
        self.assertEqual(pago.status_code, status.HTTP_400_BAD_REQUEST)

    def test_abrir_caja(self):
        r = self._abrir('100.00')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data['estado'], 'abierta')

    def test_no_se_pueden_abrir_dos_cajas(self):
        self._abrir()
        r = self._abrir()
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cuadre_perfecto_da_diferencia_cero(self):
        self._abrir('100.00')
        self._vender(2, 10, 'efectivo')  # +20 efectivo
        # esperado = 100 + 20 = 120; contamos 120 -> diferencia 0
        sesion = SesionCaja.objects.get(estado='abierta')
        r = self.client.post(f'/api/caja/{sesion.id_sesion}/cerrar/',
                             {'monto_cierre_contado': '120.00'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(float(r.data['monto_esperado']), 120.0)
        self.assertEqual(float(r.data['diferencia']), 0.0)

    def test_pago_con_tarjeta_no_cuenta_en_el_cuadre(self):
        self._abrir('100.00')
        self._vender(3, 10, 'tarjeta')  # +30 tarjeta, NO toca el cajón
        sesion = SesionCaja.objects.get(estado='abierta')
        r = self.client.post(f'/api/caja/{sesion.id_sesion}/cerrar/',
                             {'monto_cierre_contado': '100.00'}, format='json')
        self.assertEqual(float(r.data['monto_esperado']), 100.0)  # solo el fondo
        self.assertEqual(float(r.data['diferencia']), 0.0)

    def test_retiro_reduce_el_esperado(self):
        self._abrir('100.00')
        self._vender(5, 10, 'efectivo')  # +50 efectivo -> esperado 150
        sesion = SesionCaja.objects.get(estado='abierta')
        self.client.post(f'/api/caja/{sesion.id_sesion}/movimientos/',
                        {'tipo': 'retiro', 'monto': '40.00', 'motivo': 'Deposito banco'}, format='json')
        # esperado = 100 + 50 - 40 = 110
        r = self.client.post(f'/api/caja/{sesion.id_sesion}/cerrar/',
                             {'monto_cierre_contado': '110.00'}, format='json')
        self.assertEqual(float(r.data['monto_esperado']), 110.0)
        self.assertEqual(float(r.data['diferencia']), 0.0)

    def test_faltante_da_diferencia_negativa(self):
        self._abrir('100.00')
        self._vender(2, 10, 'efectivo')  # esperado 120
        sesion = SesionCaja.objects.get(estado='abierta')
        r = self.client.post(f'/api/caja/{sesion.id_sesion}/cerrar/',
                             {'monto_cierre_contado': '115.00'}, format='json')
        self.assertEqual(float(r.data['diferencia']), -5.0)  # faltan 5

    def test_actual_devuelve_la_sesion_abierta_o_null(self):
        self.assertIsNone(self.client.get('/api/caja/actual/').data)
        self._abrir('100.00')
        self.assertIsNotNone(self.client.get('/api/caja/actual/').data)

    def test_cobrar_funciona_con_caja_abierta(self):
        self._abrir('100.00')
        venta, pago = self._vender(1, 10, 'efectivo')
        self.assertEqual(pago.status_code, status.HTTP_201_CREATED, pago.data)


class GastoTestCase(APITestCase):
    """Gastos operativos: integración con caja y estado de resultados."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username='jefe_g', password='x', is_staff=True)
        self.empleado = User.objects.create_user(username='emp_g', password='x')
        self.client.force_authenticate(user=self.admin)
        self.categoria = CategoriaGasto.objects.create(nombre='Servicios')

    def _abrir_caja(self, monto='500.00'):
        return self.client.post('/api/caja/abrir/', {'monto_apertura': monto}, format='json')

    def test_gasto_efectivo_requiere_caja_abierta(self):
        r = self.client.post('/api/gastos/', {
            'fecha': str(datetime.date.today()),
            'categoria': self.categoria.id_categoria,
            'monto': '100.00', 'metodo_pago': 'efectivo', 'descripcion': 'Luz',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_gasto_efectivo_reduce_el_esperado_de_caja(self):
        self._abrir_caja('500.00')
        r = self.client.post('/api/gastos/', {
            'fecha': str(datetime.date.today()),
            'categoria': self.categoria.id_categoria,
            'monto': '120.00', 'metodo_pago': 'efectivo', 'descripcion': 'Agua',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        sesion = SesionCaja.objects.get(estado='abierta')
        # esperado = 500 (fondo) - 120 (gasto efectivo) = 380
        self.assertEqual(float(sesion.calcular_esperado()), 380.0)

    def test_gasto_por_transferencia_no_toca_la_caja(self):
        self._abrir_caja('500.00')
        r = self.client.post('/api/gastos/', {
            'fecha': str(datetime.date.today()),
            'categoria': self.categoria.id_categoria,
            'monto': '300.00', 'metodo_pago': 'transferencia', 'descripcion': 'Alquiler',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        sesion = SesionCaja.objects.get(estado='abierta')
        self.assertEqual(float(sesion.calcular_esperado()), 500.0)  # intacto

    def test_no_admin_no_puede_listar_gastos(self):
        self.client.force_authenticate(user=self.empleado)
        r = self.client.get('/api/gastos/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_estado_resultados_calcula_utilidad_neta(self):
        # Venta: 1 producto, costo 5, vendido a 30 -> ingreso 30, COGS 5
        prov = Proveedor.objects.create(nombre_empresa='Prov ER')
        prod = Producto.objects.create(
            sku_producto='SKU-ER', nombre='Prod ER', cantidad_actual=10,
            cantidad_total=10, cantidad_minima=1, precio_compra_unitario=5,
            precio_final='30.00', id_proveedor=prov,
        )
        cliente = Cliente.objects.create(nombre='Cliente ER')
        self._abrir_caja('0.00')
        venta = self.client.post('/api/ordenes-venta/', {
            'cliente': cliente.id_cliente, 'fecha': str(datetime.date.today()),
            'total': '30.00',
            'detalles': [{'producto': prod.id_producto, 'cantidad': 1, 'precio_unitario': 30}],
        }, format='json')
        self.assertEqual(venta.status_code, status.HTTP_201_CREATED, venta.data)
        # Gasto operativo de 8 por transferencia (no depende de caja)
        self.client.post('/api/gastos/', {
            'fecha': str(datetime.date.today()),
            'categoria': self.categoria.id_categoria,
            'monto': '8.00', 'metodo_pago': 'transferencia',
        }, format='json')

        hoy = str(datetime.date.today())
        r = self.client.get(f'/api/reportes/estado-resultados/?fecha_inicio={hoy}&fecha_fin={hoy}')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['ingresos'], 30.0)
        self.assertEqual(r.data['costo_ventas'], 5.0)
        self.assertEqual(r.data['utilidad_bruta'], 25.0)
        self.assertEqual(r.data['gastos_total'], 8.0)
        self.assertEqual(r.data['utilidad_neta'], 17.0)  # 25 - 8


class CuentasPorPagarTestCase(APITestCase):
    """Compras con rastreo de pago a proveedor + integración con caja."""

    def setUp(self):
        from django.db import connection
        User = get_user_model()
        # Crear/gestionar compras es admin-only (US-04).
        self.admin = User.objects.create_user(username='jefe_cxp', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)
        # La tabla catálogo `estado` (FK de orden_compra.id_estado) tiene datos
        # en producción, pero el snapshot de esquema para tests viene vacío.
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)
        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov CxP')
        self.p1 = Producto.objects.create(
            sku_producto='SKU-CXP-1', nombre='Prod 1', cantidad_actual=0, cantidad_total=0,
            cantidad_minima=1, precio_compra_unitario=10, precio_final='20.00', id_proveedor=self.proveedor)
        self.p2 = Producto.objects.create(
            sku_producto='SKU-CXP-2', nombre='Prod 2', cantidad_actual=0, cantidad_total=0,
            cantidad_minima=1, precio_compra_unitario=5, precio_final='12.00', id_proveedor=self.proveedor)

    def _crear_compra(self):
        return self.client.post('/api/ordenes-compra/', {
            'proveedor': self.proveedor.id_proveedor,
            'fecha': str(datetime.date.today()),
            'detalles': [
                {'producto': self.p1.id_producto, 'cantidad': 3, 'precio_unitario': 10},  # 30
                {'producto': self.p2.id_producto, 'cantidad': 2, 'precio_unitario': 5},    # 10
            ],
        }, format='json')

    def _abrir_caja(self, monto='0.00'):
        return self.client.post('/api/caja/abrir/', {'monto_apertura': monto}, format='json')

    def test_crear_compra_persiste_detalle_y_total_correcto(self):
        r = self._crear_compra()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        id_orden = r.data['id_orden']
        detalle = self.client.get(f'/api/ordenes-compra/{id_orden}/').data
        self.assertEqual(float(detalle['total']), 40.0)  # 3*10 + 2*5, ya no el bug
        self.assertEqual(detalle['estado_pago'], 'pendiente')
        self.assertEqual(float(detalle['saldo_pendiente']), 40.0)

    def test_pago_compra_efectivo_requiere_caja(self):
        id_orden = self._crear_compra().data['id_orden']
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '40.00', 'metodo_pago': 'efectivo'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pago_compra_efectivo_reduce_caja_y_salda(self):
        id_orden = self._crear_compra().data['id_orden']
        self._abrir_caja('100.00')
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '40.00', 'metodo_pago': 'efectivo'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertEqual(orden.estado_pago, 'pagado')
        self.assertEqual(float(orden.saldo_pendiente), 0.0)
        sesion = SesionCaja.objects.get(estado='abierta')
        self.assertEqual(float(sesion.calcular_esperado()), 60.0)  # 100 - 40

    def test_pago_compra_transferencia_no_toca_caja(self):
        id_orden = self._crear_compra().data['id_orden']
        self._abrir_caja('100.00')
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '40.00', 'metodo_pago': 'transferencia'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        sesion = SesionCaja.objects.get(estado='abierta')
        self.assertEqual(float(sesion.calcular_esperado()), 100.0)  # intacto

    def test_pago_parcial_marca_parcial(self):
        id_orden = self._crear_compra().data['id_orden']
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '15.00', 'metodo_pago': 'transferencia'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertEqual(orden.estado_pago, 'parcial')
        self.assertEqual(float(orden.saldo_pendiente), 25.0)

    def test_cuentas_por_pagar_lista_pendientes(self):
        self._crear_compra()  # 40 pendiente
        r = self.client.get('/api/reportes/cuentas-por-pagar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['num_ordenes'], 1)
        self.assertEqual(r.data['total_por_pagar'], 40.0)


class AgendaTallerTestCase(APITestCase):
    """Órdenes de trabajo del taller: estados, repuestos y facturación.

    El caso más importante es que entregar genere UNA sola venta: antes, crear
    un servicio disparaba una venta automática con SQL crudo que ni siquiera
    guardaba el vínculo servicio-venta (se adivinaba por fecha+costo+cliente).
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-taller', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='mecanico', password='x')
        self.client.force_authenticate(user=self.admin)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Taller')
        self.producto = Producto.objects.create(
            sku_producto='SKU-REP-1', nombre='Filtro de aceite',
            cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
            precio_compra_unitario=30, precio_final='50.00',
            id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Dueno de Moto')
        self.moto = Moto.objects.create(
            id_cliente=self.cliente, marca='Honda', modelo='CB125',
            anio=2020, placa='TALLER-1',
        )
        self.tipo = Servicio.objects.create(
            nombre='Cambio de Aceite', tipo='Mantenimiento',
            precio_mano_obra='150.00', es_plantilla=True,
        )

    def _agendar(self, **extra):
        datos = {
            'id_moto': self.moto.id_moto,
            'fecha_servicio': str(datetime.date.today()),
            'tipo_servicio': 'Cambio de Aceite',
            'id_tipo_servicio': self.tipo.id_servicio,
        }
        datos.update(extra)
        return self.client.post('/api/servicios-motos/', datos, format='json')

    def _avanzar_hasta_lista(self, id_servicio):
        for estado in ('recibida', 'en_diagnostico', 'lista'):
            r = self.client.post(
                f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                {'estado': estado}, format='json')
            self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    # -- agendar ---------------------------------------------------------

    def test_agendar_no_crea_venta(self):
        """Agendar no debe facturar nada: el trabajo todavía no se hizo."""
        r = self._agendar()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(OrdenVenta.objects.count(), 0)

        orden = ServicioMoto.objects.get(pk=r.data['id_servicio'])
        self.assertEqual(orden.estado, 'agendada')
        self.assertIsNone(orden.id_venta_id)

    def test_agendar_congela_precio_del_catalogo(self):
        id_servicio = self._agendar().data['id_servicio']
        orden = ServicioMoto.objects.get(pk=id_servicio)
        self.assertEqual(float(orden.precio_mano_obra), 150.0)

        # Si el catálogo sube de precio, la orden ya agendada no se mueve.
        self.tipo.precio_mano_obra = '999.00'
        self.tipo.save()
        orden.refresh_from_db()
        self.assertEqual(float(orden.precio_mano_obra), 150.0)

    # -- estados ---------------------------------------------------------

    def test_transicion_invalida_se_rechaza(self):
        id_servicio = self._agendar().data['id_servicio']
        r = self.client.post(f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                             {'estado': 'lista'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('transiciones_posibles', r.data)

    def test_cambiar_estado_escribe_bitacora(self):
        """La bitácora se llenaba a mano y se abandonaba (0 reparaciones, 0
        entregas en producción); ahora la escribe el avance de estado."""
        id_servicio = self._agendar().data['id_servicio']
        r = self.client.post(f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                             {'estado': 'recibida', 'nivel_gasolina': '1/2',
                              'rayones_previos': 'Rayon en el tanque'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        bitacora = BitacoraServicio.objects.get(
            id_servicio=id_servicio, modulo='recepcion')
        self.assertEqual(bitacora.nivel_gasolina, '1/2')
        self.assertEqual(bitacora.rayones_previos, 'Rayon en el tanque')

    def test_no_se_puede_entregar_por_cambiar_estado(self):
        """Entregar tiene que pasar por la acción que genera la venta."""
        id_servicio = self._agendar().data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)
        r = self.client.post(f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                             {'estado': 'entregada'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # -- repuestos y stock -----------------------------------------------

    def test_repuesto_descuenta_stock_y_suma_al_total(self):
        id_servicio = self._agendar().data['id_servicio']
        r = self.client.post(f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
                             {'id_producto': self.producto.id_producto, 'cantidad': 2},
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 8)
        self.assertTrue(MovimientoInventario.objects.filter(
            producto=self.producto, tipo='SALIDA',
            tipo_referencia='SERVICIO_TALLER').exists())

        # 150 de mano de obra + 2 x 50 de repuestos
        orden = ServicioMoto.objects.get(pk=id_servicio)
        self.assertEqual(float(orden.costo), 250.0)

    def test_eliminar_repuesto_restituye_stock(self):
        id_servicio = self._agendar().data['id_servicio']
        rep = self.client.post(
            f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
            {'id_producto': self.producto.id_producto, 'cantidad': 3},
            format='json').data
        r = self.client.delete(
            f"/api/servicios-motos/{id_servicio}"
            f"/eliminar-repuesto/{rep['id_servicio_repuesto']}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)
        self.assertTrue(MovimientoInventario.objects.filter(
            producto=self.producto, tipo='ENTRADA',
            tipo_referencia='SERVICIO_TALLER').exists())

        orden = ServicioMoto.objects.get(pk=id_servicio)
        self.assertEqual(float(orden.costo), 150.0)

    def test_stock_insuficiente_se_rechaza(self):
        id_servicio = self._agendar().data['id_servicio']
        r = self.client.post(f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
                             {'id_producto': self.producto.id_producto, 'cantidad': 99},
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)

    # -- entrega y facturación -------------------------------------------

    def test_entregar_genera_una_sola_venta_con_total_correcto(self):
        """El corazón de la feature: una entrega, una venta, total completo."""
        id_servicio = self._agendar().data['id_servicio']
        self.client.post(f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
                         {'id_producto': self.producto.id_producto, 'cantidad': 2},
                         format='json')
        self._avanzar_hasta_lista(id_servicio)

        r = self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/',
                             {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        # UNA venta, no dos.
        self.assertEqual(OrdenVenta.objects.count(), 1)
        venta = OrdenVenta.objects.first()
        self.assertEqual(float(venta.total), 250.0)  # 150 + 2 x 50
        self.assertEqual(venta.estado_pago, 'pendiente')

        orden = ServicioMoto.objects.get(pk=id_servicio)
        self.assertEqual(orden.estado, 'entregada')
        self.assertEqual(orden.id_venta_id, venta.id_venta)
        self.assertIsNotNone(orden.fecha_entrega)

    def test_entregar_dos_veces_se_rechaza(self):
        id_servicio = self._agendar().data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)
        self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/', {}, format='json')

        r = self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/',
                             {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(OrdenVenta.objects.count(), 1)

    def test_entregar_factura_repuestos_como_lineas(self):
        """La venta queda itemizada, no como un monto opaco."""
        id_servicio = self._agendar().data['id_servicio']
        self.client.post(f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
                         {'id_producto': self.producto.id_producto, 'cantidad': 2},
                         format='json')
        self._avanzar_hasta_lista(id_servicio)
        id_venta = self.client.post(
            f'/api/servicios-motos/{id_servicio}/entregar/',
            {}, format='json').data['id_venta']

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT id_producto, cantidad FROM producto_venta WHERE id_venta = %s',
                [id_venta])
            lineas = cursor.fetchall()
        self.assertEqual(lineas, [(self.producto.id_producto, 2)])

    def test_entregar_sin_monto_se_rechaza(self):
        id_servicio = self._agendar(
            id_tipo_servicio=None, tipo_servicio='Revision de cortesia'
        ).data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)

        r = self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/',
                             {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(OrdenVenta.objects.count(), 0)

    def test_no_se_agregan_repuestos_a_orden_entregada(self):
        id_servicio = self._agendar().data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)
        self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/', {}, format='json')

        r = self.client.post(f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
                             {'id_producto': self.producto.id_producto, 'cantidad': 1},
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # -- preventivo ------------------------------------------------------

    def test_entregar_calcula_proximo_mantenimiento(self):
        id_servicio = self._agendar().data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)
        self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/',
                         {'proximo_mantenimiento_meses': 3,
                          'proximo_mantenimiento_km': 15000}, format='json')

        orden = ServicioMoto.objects.get(pk=id_servicio)
        self.assertIsNotNone(orden.proximo_mantenimiento_fecha)
        self.assertEqual(orden.proximo_mantenimiento_km, 15000)

    def test_reporte_preventivo_lista_vencidos(self):
        id_servicio = self._agendar().data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)
        self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/', {}, format='json')

        # Se fuerza una fecha ya pasada para que aparezca como vencido.
        ServicioMoto.objects.filter(pk=id_servicio).update(
            proximo_mantenimiento_fecha=datetime.date.today() - datetime.timedelta(days=10))

        r = self.client.get('/api/reportes/mantenimiento-preventivo/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['total'], 1)
        self.assertEqual(r.data['vencidos'], 1)
        self.assertEqual(r.data['motos'][0]['placa'], 'TALLER-1')

    # -- catálogo y permisos ---------------------------------------------

    def test_catalogo_solo_expone_plantillas(self):
        """Los 100 registros históricos de `servicios` no son seleccionables."""
        Servicio.objects.create(nombre='Registro historico', tipo='Reparacion',
                                precio_mano_obra='99.00', es_plantilla=False)
        r = self.client.get('/api/servicios/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        datos = r.data.get('results') if isinstance(r.data, dict) else r.data
        nombres = [s['nombre'] for s in datos]
        self.assertIn('Cambio de Aceite', nombres)
        self.assertNotIn('Registro historico', nombres)

    def test_operador_mueve_estados_pero_no_edita_catalogo(self):
        id_servicio = self._agendar().data['id_servicio']
        self.client.force_authenticate(user=self.operador)

        r = self.client.post(f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                             {'estado': 'recibida'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        r = self.client.post('/api/servicios/', {
            'nombre': 'Servicio Nuevo', 'tipo': 'Ajuste',
            'precio_mano_obra': '80.00',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporte_agenda_taller_agrupa_por_estado(self):
        id_servicio = self._agendar().data['id_servicio']
        self.client.post(f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                         {'estado': 'recibida'}, format='json')

        r = self.client.get('/api/reportes/agenda-taller/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['abiertas'], 1)
        estados = {e['estado']: e['cantidad'] for e in r.data['por_estado']}
        self.assertEqual(estados.get('recibida'), 1)

    # -- saldo de la venta generada --------------------------------------

    def test_venta_de_taller_cobra_mano_de_obra_y_repuestos(self):
        """La mano de obra no puede perderse del saldo.

        `OrdenVenta.calcular_total()` prioriza la suma de `producto_venta`, y los
        repuestos se facturan ahí, pero la mano de obra no cabe en esa tabla
        (exige un id_producto real). Si no se suma aparte, una venta de C$250 se
        daba por pagada al abonar solo los C$100 de piezas.
        """
        id_servicio = self._agendar().data['id_servicio']
        self.client.post(f'/api/servicios-motos/{id_servicio}/agregar-repuesto/',
                         {'id_producto': self.producto.id_producto, 'cantidad': 2},
                         format='json')
        self._avanzar_hasta_lista(id_servicio)
        self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/', {}, format='json')

        venta = OrdenVenta.objects.get()
        # 150 de mano de obra + 2 x 50 de repuestos
        self.assertEqual(float(venta.calcular_total()), 250.0)

        venta.calcular_saldo()
        venta.refresh_from_db()
        self.assertEqual(float(venta.saldo_pendiente), 250.0)
        self.assertEqual(venta.estado_pago, 'pendiente')

    def test_venta_de_taller_aparece_en_cuentas_por_cobrar(self):
        id_servicio = self._agendar().data['id_servicio']
        self._avanzar_hasta_lista(id_servicio)
        self.client.post(f'/api/servicios-motos/{id_servicio}/entregar/', {}, format='json')

        r = self.client.get('/api/reportes/cuentas-por-cobrar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['num_ventas'], 1)
        self.assertEqual(r.data['total_por_cobrar'], 150.0)


class SaldoVisibleTestCase(APITestCase):
    """Una venta al crédito tiene que aparecer en Cuentas por Cobrar.

    El reporte filtra por `COALESCE(saldo_pendiente, 0) > 0`, y la columna es
    nullable: los INSERT crudos que la omitían dejaban la deuda invisible hasta
    que alguien registrara un pago.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-saldo', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Saldo')
        self.producto = Producto.objects.create(
            sku_producto='SKU-SALDO-1', nombre='Producto Saldo',
            cantidad_actual=50, cantidad_total=50, cantidad_minima=1,
            precio_compra_unitario=5, precio_final='20.00',
            id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Cliente Credito')

    def test_venta_al_credito_aparece_en_cuentas_por_cobrar(self):
        r = self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': '60.00',
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': 3,
                'precio_unitario': 20,
            }],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        venta = OrdenVenta.objects.get()
        self.assertIsNotNone(venta.saldo_pendiente)
        self.assertEqual(float(venta.saldo_pendiente), 60.0)

        rep = self.client.get('/api/reportes/cuentas-por-cobrar/')
        self.assertEqual(rep.data['num_ventas'], 1)
        self.assertEqual(rep.data['total_por_cobrar'], 60.0)

    def test_cotizacion_convertida_aparece_en_cuentas_por_cobrar(self):
        cot = self.client.post('/api/cotizaciones/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': 2,
                'precio_unitario': 20,
            }],
        }, format='json')
        self.assertEqual(cot.status_code, status.HTTP_201_CREATED, cot.data)

        r = self.client.post(
            f"/api/cotizaciones/{cot.data['id_cotizacion']}/convertir-venta/", {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        rep = self.client.get('/api/reportes/cuentas-por-cobrar/')
        self.assertEqual(rep.data['num_ventas'], 1)
        self.assertEqual(rep.data['total_por_cobrar'], 40.0)


class PresupuestoReparacionTestCase(APITestCase):
    """Presupuestos de reparación: proponer sin tocar stock, y que la aprobación
    del cliente sea lo que autoriza gastar."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-pres', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='mec-pres', password='x')
        self.client.force_authenticate(user=self.admin)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Pres')
        self.producto = Producto.objects.create(
            sku_producto='SKU-PRES-1', nombre='Kit de frenos',
            cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='200.00',
            id_proveedor=self.proveedor,
        )
        self.cliente = Cliente.objects.create(nombre='Dueno Presupuesto')
        self.moto = Moto.objects.create(
            id_cliente=self.cliente, marca='Suzuki', modelo='GN125',
            anio=2019, placa='PRES-1',
        )
        self.tipo = Servicio.objects.create(
            nombre='Reparacion de frenos', tipo='Reparacion',
            precio_mano_obra='300.00', es_plantilla=True,
        )

        r = self.client.post('/api/servicios-motos/', {
            'id_moto': self.moto.id_moto,
            'fecha_servicio': str(datetime.date.today()),
            'tipo_servicio': 'Reparacion de frenos',
            'id_tipo_servicio': self.tipo.id_servicio,
        }, format='json')
        self.id_servicio = r.data['id_servicio']
        # Llevar la orden hasta diagnóstico, que es de donde sale el presupuesto.
        for estado in ('recibida', 'en_diagnostico'):
            self.client.post(f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                             {'estado': estado}, format='json')

    def _presupuestar(self, cantidad_repuesto=2, **extra):
        datos = {
            'servicios': [{
                'servicio': self.tipo.id_servicio, 'cantidad': 1, 'precio_unitario': 300,
            }],
            'productos': [{
                'producto': self.producto.id_producto,
                'cantidad': cantidad_repuesto, 'precio_unitario': 200,
            }],
        }
        datos.update(extra)
        return self.client.post(
            f'/api/servicios-motos/{self.id_servicio}/presupuestar/', datos, format='json')

    # -- presupuestar ----------------------------------------------------

    def test_presupuestar_no_toca_stock(self):
        """Descontar al presupuestar vaciaría la bodega con trabajos que el
        cliente nunca autoriza."""
        r = self._presupuestar()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)
        self.assertFalse(MovimientoInventario.objects.filter(
            producto=self.producto).exists())

        # 300 de mano de obra + 2 x 200 de repuestos
        self.assertEqual(float(r.data['total']), 700.0)
        self.assertEqual(float(r.data['subtotal_mano_obra']), 300.0)
        self.assertEqual(float(r.data['subtotal_repuestos']), 400.0)
        self.assertEqual(r.data['tipo'], 'reparacion')
        self.assertEqual(r.data['moto_detalle']['placa'], 'PRES-1')

    def test_presupuestar_copia_el_diagnostico_de_la_bitacora(self):
        BitacoraServicio.objects.filter(
            id_servicio=self.id_servicio, modulo='diagnostico'
        ).update(fallas_encontradas='Pastillas gastadas y disco rayado')

        r = self._presupuestar()
        self.assertEqual(r.data['diagnostico'], 'Pastillas gastadas y disco rayado')

    def test_no_se_duplica_presupuesto_pendiente(self):
        self._presupuestar()
        r = self._presupuestar()
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Cotizacion.objects.filter(tipo='reparacion').count(), 1)

    # -- guard de autorización -------------------------------------------

    def test_no_se_repara_con_presupuesto_pendiente(self):
        self._presupuestar()
        r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                             {'estado': 'en_reparacion'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('estado_presupuesto', r.data)

    def test_no_se_repara_con_presupuesto_rechazado(self):
        id_cot = self._presupuestar().data['id_cotizacion']
        self.client.post(f'/api/cotizaciones/{id_cot}/cambiar_estado/',
                         {'estado': 'rechazada'}, format='json')

        r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                             {'estado': 'en_reparacion'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sin_presupuesto_si_se_puede_reparar(self):
        """Un trabajo chico no necesita presupuesto: el flujo previo sigue vivo."""
        r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                             {'estado': 'en_reparacion'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    # -- aprobación ------------------------------------------------------

    def test_aprobar_carga_la_orden_y_descuenta_stock(self):
        id_cot = self._presupuestar().data['id_cotizacion']
        r = self.client.post(f'/api/cotizaciones/{id_cot}/cambiar_estado/',
                             {'estado': 'aprobada'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data['cargado_a_orden'])
        self.assertIsNotNone(r.data['fecha_aprobacion'])

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 8)
        self.assertTrue(MovimientoInventario.objects.filter(
            producto=self.producto, tipo='SALIDA',
            tipo_referencia='SERVICIO_TALLER').exists())

        orden = ServicioMoto.objects.get(pk=self.id_servicio)
        self.assertEqual(float(orden.precio_mano_obra), 300.0)
        self.assertEqual(float(orden.costo), 700.0)

        # Y ahora sí se puede reparar.
        r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                             {'estado': 'en_reparacion'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    def test_aprobar_dos_veces_no_duplica(self):
        id_cot = self._presupuestar().data['id_cotizacion']
        for estado in ('aprobada', 'pendiente', 'aprobada'):
            r = self.client.post(f'/api/cotizaciones/{id_cot}/cambiar_estado/',
                                 {'estado': estado}, format='json')
            # Se verifica el status en cada paso: un 500 silencioso haría que
            # este test pasara sin haber cargado nunca nada.
            self.assertEqual(r.status_code, status.HTTP_200_OK, r.content[:400])

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 8)  # no 6
        orden = ServicioMoto.objects.get(pk=self.id_servicio)
        self.assertEqual(orden.repuestos.count(), 1)

    def test_stock_insuficiente_aborta_la_aprobacion_completa(self):
        id_cot = self._presupuestar(cantidad_repuesto=99).data['id_cotizacion']
        r = self.client.post(f'/api/cotizaciones/{id_cot}/cambiar_estado/',
                             {'estado': 'aprobada'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        # Nada a medio cargar: ni stock movido, ni mano de obra fijada.
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 10)
        orden = ServicioMoto.objects.get(pk=self.id_servicio)
        self.assertEqual(orden.repuestos.count(), 0)
        self.assertEqual(float(orden.precio_mano_obra), 300.0)  # la del catálogo
        cot = Cotizacion.objects.get(pk=id_cot)
        self.assertEqual(cot.estado, 'pendiente')
        self.assertFalse(cot.cargado_a_orden)

    def test_flujo_completo_hasta_la_venta(self):
        id_cot = self._presupuestar().data['id_cotizacion']
        self.client.post(f'/api/cotizaciones/{id_cot}/cambiar_estado/',
                         {'estado': 'aprobada'}, format='json')
        for estado in ('en_reparacion', 'lista'):
            r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                                 {'estado': estado}, format='json')
            self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/entregar/',
                             {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        # Una sola venta, por el total presupuestado.
        self.assertEqual(OrdenVenta.objects.count(), 1)
        venta = OrdenVenta.objects.get()
        self.assertEqual(float(venta.calcular_total()), 700.0)

        rep = self.client.get('/api/reportes/cuentas-por-cobrar/')
        self.assertEqual(rep.data['total_por_cobrar'], 700.0)

    def test_proforma_de_productos_sigue_funcionando(self):
        """La cotización de productos no debe romperse por los campos nuevos."""
        r = self.client.post('/api/cotizaciones/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'detalles': [{
                'producto': self.producto.id_producto,
                'cantidad': 1, 'precio_unitario': 200,
            }],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data['tipo'], 'producto')
        self.assertEqual(float(r.data['total']), 200.0)
        self.assertIsNone(r.data['moto_detalle'])

    def test_presupuesto_sin_lineas_se_rechaza(self):
        r = self.client.post(f'/api/servicios-motos/{self.id_servicio}/presupuestar/',
                             {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_operador_puede_presupuestar(self):
        self.client.force_authenticate(user=self.operador)
        r = self._presupuestar()
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)


class UbicacionTestCase(APITestCase):
    """Ubicación física de productos y conteo por lugar."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-ubi', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='oper-ubi', password='x')
        self.client.force_authenticate(user=self.admin)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Ubi')
        self.ubicacion = Ubicacion.objects.create(
            bodega='Principal', pasillo='2', estante='A', gaveta='5')
        self.productos = [
            Producto.objects.create(
                sku_producto=f'SKU-UBI-{i}', nombre=f'Producto Ubi {i}',
                cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
                precio_compra_unitario=5, precio_final='20.00',
                id_proveedor=self.proveedor,
            )
            for i in range(1, 4)
        ]

    # -- catálogo de lugares ---------------------------------------------

    def test_no_se_repite_una_ubicacion(self):
        r = self.client.post('/api/ubicaciones/', {
            'bodega': 'Principal', 'pasillo': '2', 'estante': 'A', 'gaveta': '5',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Ubicacion.objects.count(), 1)

    def test_no_se_repite_una_ubicacion_con_niveles_vacios(self):
        """En Postgres los NULL son distintos entre sí por defecto, así que sin
        `nulls_distinct=False` dos lugares "Principal" a secas pasarían."""
        primera = self.client.post('/api/ubicaciones/', {'bodega': 'Sucursal'}, format='json')
        self.assertEqual(primera.status_code, status.HTTP_201_CREATED, primera.data)

        segunda = self.client.post('/api/ubicaciones/', {'bodega': 'Sucursal'}, format='json')
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)

    def test_codigo_salta_niveles_vacios(self):
        suelta = Ubicacion.objects.create(bodega='Sucursal', estante='B')
        self.assertEqual(suelta.codigo, 'Sucursal · EB')
        self.assertEqual(self.ubicacion.codigo, 'Principal · P2 · EA · G5')

    def test_borrar_ubicacion_no_borra_productos(self):
        self.productos[0].id_ubicacion = self.ubicacion
        self.productos[0].save()

        r = self.client.delete(f'/api/ubicaciones/{self.ubicacion.id_ubicacion}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

        self.productos[0].refresh_from_db()
        self.assertIsNone(self.productos[0].id_ubicacion_id)
        self.assertEqual(Producto.objects.count(), 3)

    def test_ubicacion_reporta_cuanto_guarda(self):
        for p in self.productos[:2]:
            p.id_ubicacion = self.ubicacion
            p.save()

        r = self.client.get('/api/ubicaciones/')
        datos = r.data.get('results') if isinstance(r.data, dict) else r.data
        fila = next(u for u in datos if u['id_ubicacion'] == self.ubicacion.id_ubicacion)
        self.assertEqual(fila['total_productos'], 2)
        self.assertEqual(fila['valor_inventario'], 400.0)  # 2 x 10 x 20
        self.assertEqual(fila['codigo'], 'Principal · P2 · EA · G5')

    def test_ver_que_hay_en_una_ubicacion(self):
        self.productos[0].id_ubicacion = self.ubicacion
        self.productos[0].save()

        r = self.client.get(f'/api/ubicaciones/{self.ubicacion.id_ubicacion}/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]['sku_producto'], 'SKU-UBI-1')

    # -- asignación ------------------------------------------------------

    def test_asignacion_masiva(self):
        ids = [p.id_producto for p in self.productos]
        r = self.client.post('/api/productos/asignar-ubicacion/', {
            'productos': ids, 'id_ubicacion': self.ubicacion.id_ubicacion,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['actualizados'], 3)
        self.assertEqual(
            Producto.objects.filter(id_ubicacion=self.ubicacion).count(), 3)

    def test_asignacion_masiva_puede_desasignar(self):
        Producto.objects.update(id_ubicacion=self.ubicacion)
        r = self.client.post('/api/productos/asignar-ubicacion/', {
            'productos': [self.productos[0].id_producto], 'id_ubicacion': None,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.productos[0].refresh_from_db()
        self.assertIsNone(self.productos[0].id_ubicacion_id)

    def test_operador_no_puede_asignar(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.post('/api/productos/asignar-ubicacion/', {
            'productos': [self.productos[0].id_producto],
            'id_ubicacion': self.ubicacion.id_ubicacion,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_filtro_sin_ubicacion(self):
        self.productos[0].id_ubicacion = self.ubicacion
        self.productos[0].save()

        r = self.client.get('/api/productos/?sin_ubicacion=true')
        datos = r.data.get('results') if isinstance(r.data, dict) else r.data
        self.assertEqual(len(datos), 2)

    def test_producto_expone_su_ubicacion(self):
        self.productos[0].id_ubicacion = self.ubicacion
        self.productos[0].save()

        r = self.client.get(f'/api/productos/{self.productos[0].id_producto}/')
        self.assertEqual(r.data['ubicacion']['codigo'], 'Principal · P2 · EA · G5')

    # -- hoja de conteo --------------------------------------------------

    def test_conteo_agrupa_por_lugar_e_incluye_sin_ubicar(self):
        self.productos[0].id_ubicacion = self.ubicacion
        self.productos[0].save()

        r = self.client.get('/api/reportes/conteo-fisico/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['total_productos'], 3)
        self.assertEqual(r.data['sin_ubicacion'], 2)
        self.assertEqual(r.data['valor_esperado'], 600.0)  # 3 x 10 x 20

        # Los sin ubicación van al final, para no quedar fuera del conteo.
        self.assertFalse(r.data['grupos'][0]['sin_ubicacion'])
        self.assertTrue(r.data['grupos'][-1]['sin_ubicacion'])

    def test_conteo_ordena_recorriendo_los_estantes(self):
        otra = Ubicacion.objects.create(bodega='Principal', pasillo='1', estante='B')
        self.productos[0].id_ubicacion = self.ubicacion   # pasillo 2
        self.productos[0].save()
        self.productos[1].id_ubicacion = otra             # pasillo 1
        self.productos[1].save()

        r = self.client.get('/api/reportes/conteo-fisico/')
        con_lugar = [g for g in r.data['grupos'] if not g['sin_ubicacion']]
        self.assertEqual(con_lugar[0]['id_ubicacion'], otra.id_ubicacion)
        self.assertEqual(con_lugar[1]['id_ubicacion'], self.ubicacion.id_ubicacion)

    # -- aplicar el conteo -----------------------------------------------

    def test_aplicar_conteo_solo_ajusta_las_diferencias(self):
        r = self.client.post('/api/movimientos/aplicar-conteo/', {'conteos': [
            {'id_producto': self.productos[0].id_producto, 'contado': 8},   # faltan 2
            {'id_producto': self.productos[1].id_producto, 'contado': 10},  # cuadra
            {'id_producto': self.productos[2].id_producto, 'contado': 13},  # sobran 3
        ]}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        self.assertEqual(r.data['contados'], 3)
        self.assertEqual(r.data['cuadrados'], 1)
        self.assertEqual(r.data['ajustados'], 2)
        self.assertEqual(r.data['faltantes'], 1)
        self.assertEqual(r.data['sobrantes'], 1)
        self.assertEqual(r.data['impacto'], 20.0)  # (-2 + 3) x 20

        for producto, esperado in zip(self.productos, (8, 10, 13)):
            producto.refresh_from_db()
            self.assertEqual(producto.cantidad_actual, esperado)

        # Solo 2 movimientos: el que cuadró no ensucia la bitácora.
        movimientos = MovimientoInventario.objects.filter(tipo='AJUSTE')
        self.assertEqual(movimientos.count(), 2)
        self.assertTrue(all(m.referencia.startswith('CONTEO-') for m in movimientos))

    def test_conteo_identico_no_genera_movimientos(self):
        r = self.client.post('/api/movimientos/aplicar-conteo/', {'conteos': [
            {'id_producto': p.id_producto, 'contado': 10} for p in self.productos
        ]}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['cuadrados'], 3)
        self.assertEqual(r.data['ajustados'], 0)
        self.assertEqual(MovimientoInventario.objects.count(), 0)

    def test_conteo_ignora_los_no_contados(self):
        """Dejar un producto en blanco no debe ponerlo en cero."""
        r = self.client.post('/api/movimientos/aplicar-conteo/', {'conteos': [
            {'id_producto': self.productos[0].id_producto, 'contado': 7},
            {'id_producto': self.productos[1].id_producto, 'contado': ''},
            {'id_producto': self.productos[2].id_producto, 'contado': None},
        ]}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['contados'], 1)

        self.productos[1].refresh_from_db()
        self.assertEqual(self.productos[1].cantidad_actual, 10)

    def test_conteo_negativo_se_rechaza_sin_tocar_nada(self):
        r = self.client.post('/api/movimientos/aplicar-conteo/', {'conteos': [
            {'id_producto': self.productos[0].id_producto, 'contado': 5},
            {'id_producto': self.productos[1].id_producto, 'contado': -3},
        ]}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        # Se valida todo antes de escribir: ni el válido se aplicó.
        self.productos[0].refresh_from_db()
        self.assertEqual(self.productos[0].cantidad_actual, 10)
        self.assertEqual(MovimientoInventario.objects.count(), 0)

    def test_operador_no_puede_aplicar_conteo(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.post('/api/movimientos/aplicar-conteo/', {'conteos': [
            {'id_producto': self.productos[0].id_producto, 'contado': 1},
        ]}, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.productos[0].refresh_from_db()
        self.assertEqual(self.productos[0].cantidad_actual, 10)

    def test_stock_muerto_muestra_la_ubicacion(self):
        self.productos[0].id_ubicacion = self.ubicacion
        self.productos[0].save()

        r = self.client.get('/api/reportes/stock-muerto/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        fila = next(p for p in r.data['productos']
                    if p['id_producto'] == self.productos[0].id_producto)
        self.assertEqual(fila['ubicacion'], 'Principal · P2 · EA · G5')


class RecepcionCompraTestCase(APITestCase):
    """Recibir una orden de compra tiene que sumar el stock.

    Antes solo cambiaba `id_estado`: la mercadería entraba a la bodega, el
    inventario no se movía, y la interfaz igual anunciaba "stock actualizado".
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-rec', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='oper-rec', password='x')
        self.client.force_authenticate(user=self.admin)

        # El catálogo `estado` (1 cancelada / 2 pendiente / 3 recibida) vive en
        # el esquema legado y no tiene modelo Django.
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente)
                VALUES (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Rec')
        self.producto_a = Producto.objects.create(
            sku_producto='SKU-REC-A', nombre='Producto A',
            cantidad_actual=5, cantidad_total=5, cantidad_minima=1,
            precio_compra_unitario=10, precio_final='25.00',
            id_proveedor=self.proveedor,
        )
        self.producto_b = Producto.objects.create(
            sku_producto='SKU-REC-B', nombre='Producto B',
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=8, precio_final='20.00',
            id_proveedor=self.proveedor,
        )

    def _crear_orden(self):
        r = self.client.post('/api/ordenes-compra/', {
            'proveedor': self.proveedor.id_proveedor,
            'fecha': str(datetime.date.today()),
            'detalles': [
                {'producto': self.producto_a.id_producto, 'cantidad': 10, 'precio_unitario': 10},
                {'producto': self.producto_b.id_producto, 'cantidad': 3, 'precio_unitario': 8},
            ],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        return r.data['id_orden']

    def test_recibir_suma_stock_y_deja_movimiento(self):
        id_orden = self._crear_orden()
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['lineas_aplicadas'], 2)
        self.assertEqual(r.data['unidades_ingresadas'], 13)

        self.producto_a.refresh_from_db()
        self.producto_b.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 15)  # 5 + 10
        self.assertEqual(self.producto_b.cantidad_actual, 3)   # 0 + 3

        movimientos = MovimientoInventario.objects.filter(
            tipo='ENTRADA', tipo_referencia='ORDEN_COMPRA')
        self.assertEqual(movimientos.count(), 2)
        self.assertTrue(all(m.referencia == f'COMPRA-{id_orden}' for m in movimientos))

        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertTrue(orden.stock_aplicado)
        self.assertEqual(orden.id_estado, OrdenCompra.ESTADO_RECIBIDA)

    def test_recibir_dos_veces_no_duplica_stock(self):
        id_orden = self._crear_orden()
        self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')

        r = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        self.producto_a.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 15)  # no 25
        self.assertEqual(MovimientoInventario.objects.count(), 2)

    def test_confirmar_tambien_suma_stock(self):
        """La interfaz usaba `confirmar` con la etiqueta "marcar como recibida",
        así que ese camino también tiene que mover inventario."""
        id_orden = self._crear_orden()
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/confirmar/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        self.producto_a.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 15)
        self.assertTrue(OrdenCompra.objects.get(pk=id_orden).stock_aplicado)

    def test_confirmar_y_luego_recibir_no_duplica(self):
        id_orden = self._crear_orden()
        self.client.post(f'/api/ordenes-compra/{id_orden}/confirmar/', {}, format='json')
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        self.producto_a.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 15)

    def test_orden_sin_cantidades_se_rechaza(self):
        """Las órdenes creadas antes de que se guardaran las cantidades no se
        pueden recibir: se rechaza en vez de fingir que se recibió sin mover nada."""
        id_orden = self._crear_orden()
        # Se simula el histórico: líneas sin cantidad.
        with connection.cursor() as c:
            c.execute("UPDATE orden_producto SET cantidad = NULL WHERE id_orden = %s", [id_orden])

        r = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cantidades', str(r.data).lower())

        self.producto_a.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 5)  # intacto
        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertFalse(orden.stock_aplicado)
        self.assertEqual(orden.id_estado, OrdenCompra.ESTADO_PENDIENTE)

    def test_orden_cancelada_no_se_puede_recibir(self):
        id_orden = self._crear_orden()
        self.client.post(f'/api/ordenes-compra/{id_orden}/cancelar/', {}, format='json')

        r = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.producto_a.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 5)

    def test_detalle_avisa_si_puede_recibirse(self):
        id_orden = self._crear_orden()
        r = self.client.get(f'/api/ordenes-compra/{id_orden}/')
        self.assertTrue(r.data['puede_recibirse'])
        self.assertFalse(r.data['stock_aplicado'])

        with connection.cursor() as c:
            c.execute("UPDATE orden_producto SET cantidad = NULL WHERE id_orden = %s", [id_orden])
        r = self.client.get(f'/api/ordenes-compra/{id_orden}/')
        self.assertFalse(r.data['puede_recibirse'])

    def test_operador_no_puede_recibir(self):
        id_orden = self._crear_orden()
        self.client.force_authenticate(user=self.operador)
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

        self.producto_a.refresh_from_db()
        self.assertEqual(self.producto_a.cantidad_actual, 5)


class AnalisisProveedoresTestCase(APITestCase):
    """Comparación de precios y desempeño de proveedores.

    Los precios salen del historial de compras, no de un catálogo manual, así que
    todo lo que se mide acá aparece solo con el uso normal del sistema.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-prov', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='oper-prov', password='x')
        self.client.force_authenticate(user=self.admin)

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente)
                VALUES (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT DO NOTHING
            """)

        self.barato = Proveedor.objects.create(nombre_empresa='Proveedor Barato')
        self.caro = Proveedor.objects.create(nombre_empresa='Proveedor Caro')
        # El producto está asignado al caro: eso es la oportunidad de ahorro.
        self.producto = Producto.objects.create(
            sku_producto='SKU-PROV-1', nombre='Filtro comparable',
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='200.00',
            id_proveedor=self.caro,
        )
        self.exclusivo = Producto.objects.create(
            sku_producto='SKU-PROV-2', nombre='Producto de un solo proveedor',
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=50, precio_final='90.00',
            id_proveedor=self.caro,
        )

    def _comprar(self, proveedor, producto, precio, recibir=True, fecha_esperada=None):
        datos = {
            'proveedor': proveedor.id_proveedor,
            'fecha': str(datetime.date.today()),
            'detalles': [{'producto': producto.id_producto,
                          'cantidad': 5, 'precio_unitario': precio}],
        }
        if fecha_esperada:
            datos['fecha_esperada'] = str(fecha_esperada)
        r = self.client.post('/api/ordenes-compra/', datos, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        id_orden = r.data['id_orden']
        if recibir:
            rr = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
            self.assertEqual(rr.status_code, status.HTTP_200_OK, rr.data)
        return id_orden

    # -- fecha de recepción ----------------------------------------------

    def test_recibir_registra_la_fecha_y_los_dias(self):
        """Sin fecha de recepción no se puede medir cuánto tardó el proveedor."""
        id_orden = self._comprar(self.barato, self.producto, 90)
        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertIsNotNone(orden.fecha_recepcion)
        # Comprada y recibida hoy.
        self.assertEqual(orden.dias_entrega(), 0)

    def test_puntualidad_solo_con_fecha_prometida(self):
        sin_promesa = OrdenCompra.objects.get(
            pk=self._comprar(self.barato, self.producto, 90))
        self.assertIsNone(sin_promesa.entregado_a_tiempo())

        a_tiempo = OrdenCompra.objects.get(pk=self._comprar(
            self.barato, self.producto, 91,
            fecha_esperada=datetime.date.today() + datetime.timedelta(days=3)))
        self.assertTrue(a_tiempo.entregado_a_tiempo())

        tarde = OrdenCompra.objects.get(pk=self._comprar(
            self.barato, self.producto, 92,
            fecha_esperada=datetime.date.today() - datetime.timedelta(days=3)))
        self.assertFalse(tarde.entregado_a_tiempo())

    # -- desempeño -------------------------------------------------------

    def test_desempeno_agrupa_por_proveedor(self):
        self._comprar(self.barato, self.producto, 90)
        self._comprar(self.caro, self.producto, 130)

        r = self.client.get('/api/reportes/desempeno-proveedores/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        por_nombre = {p['proveedor']: p for p in r.data['proveedores']}
        self.assertEqual(por_nombre['Proveedor Barato']['ordenes'], 1)
        self.assertEqual(por_nombre['Proveedor Barato']['monto_comprado'], 450.0)  # 5 x 90
        self.assertEqual(por_nombre['Proveedor Caro']['monto_comprado'], 650.0)   # 5 x 130
        self.assertEqual(por_nombre['Proveedor Barato']['dias_promedio'], 0.0)

    def test_desempeno_sin_recepciones_no_divide_por_cero(self):
        """Un proveedor sin nada recibido no puede tumbar el reporte."""
        self._comprar(self.barato, self.producto, 90, recibir=False)

        r = self.client.get('/api/reportes/desempeno-proveedores/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        fila = next(p for p in r.data['proveedores'] if p['proveedor'] == 'Proveedor Barato')
        self.assertEqual(fila['ordenes'], 1)
        self.assertEqual(fila['recibidas'], 0)
        self.assertIsNone(fila['dias_promedio'])
        self.assertEqual(r.data['con_entregas_medibles'], 0)
        self.assertIsNone(r.data['mas_rapido'])

    def test_puntualidad_no_se_inventa_sin_promesas(self):
        """Sin fechas prometidas se informa que no es medible, no un 100% falso."""
        self._comprar(self.barato, self.producto, 90)

        r = self.client.get('/api/reportes/desempeno-proveedores/')
        self.assertFalse(r.data['puntualidad_medible'])
        fila = next(p for p in r.data['proveedores'] if p['proveedor'] == 'Proveedor Barato')
        self.assertIsNone(fila['puntualidad'])

        self._comprar(self.barato, self.producto, 91,
                      fecha_esperada=datetime.date.today() + datetime.timedelta(days=2))
        r = self.client.get('/api/reportes/desempeno-proveedores/')
        self.assertTrue(r.data['puntualidad_medible'])
        fila = next(p for p in r.data['proveedores'] if p['proveedor'] == 'Proveedor Barato')
        self.assertEqual(fila['puntualidad'], 100.0)
        self.assertEqual(fila['ordenes_con_promesa'], 1)

    def test_desempeno_ignora_canceladas(self):
        id_orden = self._comprar(self.barato, self.producto, 90, recibir=False)
        self.client.post(f'/api/ordenes-compra/{id_orden}/cancelar/', {}, format='json')

        r = self.client.get('/api/reportes/desempeno-proveedores/')
        fila = next(p for p in r.data['proveedores'] if p['proveedor'] == 'Proveedor Barato')
        self.assertEqual(fila['ordenes'], 0)

    # -- comparación de precios ------------------------------------------

    def test_comparacion_detecta_el_mejor_precio(self):
        self._comprar(self.barato, self.producto, 90)
        self._comprar(self.caro, self.producto, 130)

        r = self.client.get('/api/reportes/comparacion-precios/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        prod = next(p for p in r.data['productos']
                    if p['id_producto'] == self.producto.id_producto)
        self.assertEqual(prod['mejor_precio'], 90.0)
        self.assertEqual(prod['mejor_proveedor'], 'Proveedor Barato')
        self.assertEqual(prod['diferencia'], 40.0)

        mejor = next(p for p in prod['proveedores'] if p['es_mejor_precio'])
        self.assertEqual(mejor['proveedor'], 'Proveedor Barato')

    def test_oportunidad_de_ahorro(self):
        """El producto está asignado al caro habiendo uno más barato."""
        self._comprar(self.barato, self.producto, 90)
        self._comprar(self.caro, self.producto, 130)

        r = self.client.get('/api/reportes/comparacion-precios/')
        self.assertEqual(r.data['num_oportunidades'], 1)
        self.assertEqual(r.data['ahorro_unitario_total'], 40.0)

        op = r.data['oportunidades'][0]
        self.assertEqual(op['nombre'], 'Filtro comparable')
        self.assertEqual(op['proveedor_actual'], 'Proveedor Caro')
        self.assertEqual(op['mejor_proveedor'], 'Proveedor Barato')
        self.assertEqual(op['ahorro_unitario'], 40.0)

    def test_sin_oportunidad_si_el_asignado_es_el_mas_barato(self):
        self.producto.id_proveedor = self.barato
        self.producto.save()
        self._comprar(self.barato, self.producto, 90)
        self._comprar(self.caro, self.producto, 130)

        r = self.client.get('/api/reportes/comparacion-precios/')
        self.assertEqual(r.data['num_oportunidades'], 0)
        # Pero sigue siendo comparable.
        self.assertEqual(r.data['productos_comparables'], 1)

    def test_producto_de_un_solo_proveedor_no_es_comparable(self):
        self._comprar(self.caro, self.exclusivo, 60)

        r = self.client.get('/api/reportes/comparacion-precios/')
        self.assertEqual(r.data['productos_con_historial'], 1)
        self.assertEqual(r.data['productos_comparables'], 0)

    def test_comparacion_usa_el_ultimo_precio_no_el_primero(self):
        """Si un proveedor sube el precio, la comparación tiene que reflejarlo."""
        self._comprar(self.barato, self.producto, 90)
        self._comprar(self.caro, self.producto, 130)
        # El barato sube y pasa a ser el más caro.
        self._comprar(self.barato, self.producto, 200)

        r = self.client.get('/api/reportes/comparacion-precios/')
        prod = next(p for p in r.data['productos']
                    if p['id_producto'] == self.producto.id_producto)
        self.assertEqual(prod['mejor_proveedor'], 'Proveedor Caro')
        self.assertEqual(prod['mejor_precio'], 130.0)

    # -- endpoint por producto -------------------------------------------

    def test_precios_por_proveedor_de_un_producto(self):
        self._comprar(self.barato, self.producto, 90)
        self._comprar(self.caro, self.producto, 130)

        r = self.client.get(
            f'/api/productos/{self.producto.id_producto}/precios-proveedores/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['mejor_precio'], 90.0)
        self.assertEqual(r.data['mejor_proveedor'], 'Proveedor Barato')
        self.assertEqual(len(r.data['proveedores']), 2)
        # Ordenados del más barato al más caro.
        self.assertEqual(r.data['proveedores'][0]['ultimo_precio'], 90.0)

    def test_producto_sin_compras_no_tiene_precios(self):
        r = self.client.get(
            f'/api/productos/{self.producto.id_producto}/precios-proveedores/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['proveedores'], [])
        self.assertIsNone(r.data['mejor_precio'])

    def test_operador_ve_precios_pero_no_los_reportes(self):
        """El vendedor necesita el precio al comprar; los reportes son de admin."""
        self._comprar(self.barato, self.producto, 90)
        self.client.force_authenticate(user=self.operador)

        r = self.client.get(
            f'/api/productos/{self.producto.id_producto}/precios-proveedores/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        for url in ('/api/reportes/desempeno-proveedores/',
                    '/api/reportes/comparacion-precios/'):
            self.assertEqual(self.client.get(url).status_code,
                             status.HTTP_403_FORBIDDEN, url)


class DevolucionProveedorTestCase(APITestCase):
    """Devolver mercadería a un proveedor: saca stock y baja la deuda.

    Lo central es que devolver deje de deberse: sin eso, mandar de vuelta
    mercadería defectuosa dejaba la deuda intacta en cuentas por pagar.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-devp', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='oper-devp', password='x')
        self.client.force_authenticate(user=self.admin)

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente)
                VALUES (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Devoluciones')
        self.producto = Producto.objects.create(
            sku_producto='SKU-DEVP-1', nombre='Filtro defectuoso',
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='200.00',
            id_proveedor=self.proveedor,
        )

    def _comprar_y_recibir(self, cantidad=20, precio=100):
        """Compra de C$2000 por defecto: los números de la tabla del plan."""
        r = self.client.post('/api/ordenes-compra/', {
            'proveedor': self.proveedor.id_proveedor,
            'fecha': str(datetime.date.today()),
            'detalles': [{'producto': self.producto.id_producto,
                          'cantidad': cantidad, 'precio_unitario': precio}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        id_orden = r.data['id_orden']
        rr = self.client.post(f'/api/ordenes-compra/{id_orden}/recibir/', {}, format='json')
        self.assertEqual(rr.status_code, status.HTTP_200_OK, rr.data)
        return id_orden

    def _devolver(self, id_orden, cantidad=5, **extra):
        datos = {
            'orden': id_orden,
            'detalles': [{'producto': self.producto.id_producto, 'cantidad': cantidad}],
        }
        datos.update(extra)
        return self.client.post('/api/devoluciones-compra/', datos, format='json')

    # -- stock -----------------------------------------------------------

    def test_devolver_saca_stock_y_deja_movimiento(self):
        id_orden = self._comprar_y_recibir()
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 20)

        r = self._devolver(id_orden, cantidad=5, motivo='Vinieron defectuosos')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(float(r.data['total']), 500.0)  # 5 x 100

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 15)

        movimiento = MovimientoInventario.objects.filter(
            producto=self.producto, tipo='SALIDA',
            referencia__startswith='DEV-COMPRA-').first()
        self.assertIsNotNone(movimiento)
        self.assertEqual(movimiento.cantidad, 5)
        self.assertEqual(movimiento.tipo_referencia, 'ORDEN_COMPRA')

    # -- los tres casos de la tabla del plan ------------------------------

    def test_compra_sin_pagar_la_deuda_baja(self):
        """Comprado 2000, devuelto 500, pagado 0 → se deben 1500."""
        id_orden = self._comprar_y_recibir()
        self._devolver(id_orden, cantidad=5)

        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertEqual(float(orden.saldo_pendiente), 1500.0)
        self.assertEqual(orden.estado_pago, 'pendiente')

    def test_compra_pagada_deja_saldo_a_favor(self):
        """Comprado 2000, pagado 2000, devuelto 500 → el proveedor debe 500."""
        id_orden = self._comprar_y_recibir()
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '2000.00', 'metodo_pago': 'transferencia'},
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        self._devolver(id_orden, cantidad=5)

        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertEqual(float(orden.saldo_pendiente), -500.0)
        self.assertEqual(float(orden.saldo_a_favor()), 500.0)
        # Un saldo a favor no es una deuda: no debe figurar como pendiente.
        self.assertEqual(orden.estado_pago, 'pagado')

    def test_con_reembolso_el_saldo_queda_en_cero(self):
        """Comprado 2000, pagado 2000, devuelto 500, reembolsado 500 → cero."""
        id_orden = self._comprar_y_recibir()
        self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                         {'monto': '2000.00', 'metodo_pago': 'transferencia'},
                         format='json')

        r = self._devolver(id_orden, cantidad=5,
                           reembolso='500.00', metodo_reembolso='transferencia')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        orden = OrdenCompra.objects.get(pk=id_orden)
        self.assertEqual(float(orden.saldo_pendiente), 0.0)
        self.assertEqual(float(orden.saldo_a_favor()), 0.0)

    def test_saldo_a_favor_no_aparece_en_cuentas_por_pagar(self):
        id_orden = self._comprar_y_recibir()
        self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                         {'monto': '2000.00', 'metodo_pago': 'transferencia'},
                         format='json')
        self._devolver(id_orden, cantidad=5)

        r = self.client.get('/api/reportes/cuentas-por-pagar/')
        self.assertEqual(r.data['num_ordenes'], 0)

    def test_no_se_puede_pagar_lo_devuelto(self):
        """Tras devolver, el saldo pagable baja: pagar el total original falla."""
        id_orden = self._comprar_y_recibir()
        self._devolver(id_orden, cantidad=5)

        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '2000.00', 'metodo_pago': 'transferencia'},
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        # 1500 sí entra.
        r = self.client.post(f'/api/ordenes-compra/{id_orden}/registrar-pago/',
                             {'monto': '1500.00', 'metodo_pago': 'transferencia'},
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    # -- validaciones -----------------------------------------------------

    def test_no_se_devuelve_mas_de_lo_recibido(self):
        id_orden = self._comprar_y_recibir(cantidad=20)
        r = self._devolver(id_orden, cantidad=25)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 20)

    def test_no_se_devuelve_mas_de_lo_ya_devuelto_acumulado(self):
        id_orden = self._comprar_y_recibir(cantidad=20)
        self.assertEqual(self._devolver(id_orden, 15).status_code,
                         status.HTTP_201_CREATED)
        # Quedan 5 por devolver de esa compra.
        self.assertEqual(self._devolver(id_orden, 10).status_code,
                         status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._devolver(id_orden, 5).status_code,
                         status.HTTP_201_CREATED)

    def test_no_se_devuelve_mas_de_lo_que_hay_en_stock(self):
        """Recibidos 20, vendidos 18: no se pueden devolver 5 porque no están."""
        id_orden = self._comprar_y_recibir(cantidad=20)
        Producto.objects.filter(pk=self.producto.id_producto).update(cantidad_actual=2)

        r = self._devolver(id_orden, cantidad=5)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('stock', str(r.data).lower())

        self.assertEqual(self._devolver(id_orden, 2).status_code,
                         status.HTTP_201_CREATED)

    def test_no_se_devuelve_de_una_orden_no_recibida(self):
        r = self.client.post('/api/ordenes-compra/', {
            'proveedor': self.proveedor.id_proveedor,
            'fecha': str(datetime.date.today()),
            'detalles': [{'producto': self.producto.id_producto,
                          'cantidad': 5, 'precio_unitario': 100}],
        }, format='json')
        id_orden = r.data['id_orden']

        rr = self._devolver(id_orden, cantidad=2)
        self.assertEqual(rr.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recib', str(rr.data).lower())

    def test_no_se_devuelve_de_una_orden_cancelada(self):
        id_orden = self._comprar_y_recibir()
        OrdenCompra.objects.filter(pk=id_orden).update(
            id_estado=OrdenCompra.ESTADO_CANCELADA)

        r = self._devolver(id_orden, cantidad=2)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_producto_ajeno_a_la_compra_se_rechaza(self):
        otro = Producto.objects.create(
            sku_producto='SKU-DEVP-2', nombre='Producto ajeno',
            cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
            precio_compra_unitario=50, precio_final='90.00',
            id_proveedor=self.proveedor,
        )
        id_orden = self._comprar_y_recibir()
        r = self.client.post('/api/devoluciones-compra/', {
            'orden': id_orden,
            'detalles': [{'producto': otro.id_producto, 'cantidad': 1}],
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # -- caja --------------------------------------------------------------

    def test_reembolso_en_efectivo_exige_caja_abierta(self):
        id_orden = self._comprar_y_recibir()
        r = self._devolver(id_orden, cantidad=5,
                           reembolso='500.00', metodo_reembolso='efectivo')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('caja', str(r.data).lower())

        # Y no dejó nada a medias.
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 20)
        self.assertEqual(DevolucionCompra.objects.count(), 0)

    def test_reembolso_en_efectivo_sube_el_efectivo_esperado(self):
        self.client.post('/api/caja/abrir/', {'monto_apertura': '1000.00'}, format='json')
        sesion = SesionCaja.objects.get(estado='abierta')
        self.assertEqual(float(sesion.calcular_esperado()), 1000.0)

        id_orden = self._comprar_y_recibir()
        r = self._devolver(id_orden, cantidad=5,
                           reembolso='500.00', metodo_reembolso='efectivo')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        # El dinero entra al cajón.
        self.assertEqual(float(sesion.calcular_esperado()), 1500.0)

    def test_reembolso_por_transferencia_no_toca_la_caja(self):
        self.client.post('/api/caja/abrir/', {'monto_apertura': '1000.00'}, format='json')
        sesion = SesionCaja.objects.get(estado='abierta')

        id_orden = self._comprar_y_recibir()
        self._devolver(id_orden, cantidad=5,
                       reembolso='500.00', metodo_reembolso='transferencia')
        self.assertEqual(float(sesion.calcular_esperado()), 1000.0)

    # -- lo devolvible y el reporte ----------------------------------------

    def test_endpoint_devolvible_acota_por_stock(self):
        id_orden = self._comprar_y_recibir(cantidad=20)
        self._devolver(id_orden, cantidad=5)
        Producto.objects.filter(pk=self.producto.id_producto).update(cantidad_actual=3)

        r = self.client.get(f'/api/devoluciones-compra/devolvible/{id_orden}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        fila = r.data['productos'][0]
        self.assertEqual(fila['recibido'], 20)
        self.assertEqual(fila['ya_devuelto'], 5)
        self.assertEqual(fila['stock_actual'], 3)
        # Quedan 15 por devolver pero solo hay 3.
        self.assertEqual(fila['max_devolvible'], 3)

    def test_reporte_agrupa_por_proveedor_y_motivo(self):
        id_orden = self._comprar_y_recibir()
        self._devolver(id_orden, cantidad=5, motivo='Defectuosos',
                       reembolso='200.00', metodo_reembolso='transferencia')

        r = self.client.get('/api/reportes/devoluciones-proveedor/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['total_devuelto'], 500.0)
        self.assertEqual(r.data['total_reembolsado'], 200.0)
        self.assertEqual(r.data['saldo_a_favor_total'], 300.0)

        prov = r.data['por_proveedor'][0]
        self.assertEqual(prov['proveedor'], 'Proveedor Devoluciones')
        # Se devolvió 500 de 2000 comprados.
        self.assertEqual(prov['tasa_devolucion'], 25.0)
        self.assertEqual(r.data['motivos'][0]['motivo'], 'Defectuosos')

    # -- permisos e inmutabilidad ------------------------------------------

    def test_no_se_puede_editar_ni_borrar(self):
        id_orden = self._comprar_y_recibir()
        id_dev = self._devolver(id_orden, cantidad=5).data['id_devolucion_compra']

        self.assertEqual(
            self.client.patch(f'/api/devoluciones-compra/{id_dev}/', {}, format='json').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(
            self.client.delete(f'/api/devoluciones-compra/{id_dev}/').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_operador_no_puede_devolver(self):
        id_orden = self._comprar_y_recibir()
        self.client.force_authenticate(user=self.operador)

        r = self._devolver(id_orden, cantidad=5)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 20)


class AuditoriaUsuarioTestCase(APITestCase):
    """Los logs deben decir quién hizo el cambio, no el rol de la base de datos.

    La auditoría la escribe un trigger de Postgres, que solo veía `CURRENT_USER`
    (`postgres`) porque un trigger no conoce al usuario de la aplicación. El
    middleware lo publica en una variable de sesión y el trigger la lee.

    Se usa la API con **token JWT real** en vez de `force_authenticate`: el
    middleware tiene que resolver el token por su cuenta, porque DRF autentica
    dentro de la vista, después de que el middleware ya corrió. Con
    `force_authenticate` ese camino no se ejercitaría.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='jefa_auditoria', password='x', is_staff=True)
        self.otro_admin = User.objects.create_user(
            username='otro_admin', password='x', is_staff=True)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Proveedor Auditoría')
        self.producto = Producto.objects.create(
            sku_producto='SKU-AUD-1', nombre='Producto auditado',
            cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
            precio_compra_unitario=50, precio_final='100.00',
            id_proveedor=self.proveedor,
        )
        # Los cambios del setUp no interesan: se mide de acá en adelante.
        AuditoriaProducto.objects.all().delete()

    def _autenticar(self, usuario):
        """Manda el token en el header, como lo hace el navegador.

        El token se genera directo en vez de pegarle a /auth/login/ porque ese
        endpoint tiene throttling de 5 por minuto y el cache persiste entre
        tests. Es el mismo token; lo que importa es que el middleware tenga que
        resolverlo desde el header, que es el camino de producción.
        """
        from rest_framework_simplejwt.tokens import RefreshToken
        token = RefreshToken.for_user(usuario).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def _editar_precio(self, precio):
        return self.client.patch(f'/api/productos/{self.producto.id_producto}/',
                                 {'precio_final': str(precio)}, format='json')

    # ------------------------------------------------------------------

    def test_registra_el_username_de_quien_edita(self):
        self._autenticar(self.admin)
        r = self._editar_precio('150.00')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        log = AuditoriaProducto.objects.latest('fecha_cambio')
        self.assertEqual(log.usuario, 'jefa_auditoria')
        self.assertEqual(log.operacion, 'UPDATE')
        # Y no el rol de conexión, que era el síntoma original.
        self.assertNotEqual(log.usuario, 'postgres')

    def test_cada_usuario_queda_con_sus_propios_cambios(self):
        """El riesgo real: las conexiones se reutilizan entre peticiones
        (conn_max_age), así que un usuario podría heredar el nombre del anterior
        y cargar con cambios que no hizo."""
        self._autenticar(self.admin)
        self._editar_precio('150.00')

        self._autenticar(self.otro_admin)
        self._editar_precio('175.00')

        logs = list(AuditoriaProducto.objects.order_by('id_auditoria')
                    .values_list('usuario', flat=True))
        self.assertEqual(logs, ['jefa_auditoria', 'otro_admin'])

    def test_peticion_sin_sesion_no_hereda_el_usuario_anterior(self):
        self._autenticar(self.admin)
        self._editar_precio('150.00')

        # Se cae la sesión y alguien toca la base por fuera de la aplicación
        # (script, psql, un comando de management).
        self.client.credentials()
        Producto.objects.filter(pk=self.producto.id_producto).update(
            precio_final='200.00')

        log = AuditoriaProducto.objects.latest('id_auditoria')
        self.assertNotEqual(log.usuario, 'jefa_auditoria')
        # Se declara que fue un proceso directo, en vez de un nombre que
        # parezca una persona.
        self.assertIn('sistema', log.usuario)

    def test_cambio_por_sql_crudo_tambien_se_audita_con_el_usuario(self):
        """La mayor parte del sistema mueve stock con SQL crudo (ventas, taller,
        recepciones). El trigger es lo único que captura esos cambios, y también
        tiene que atribuirlos bien."""
        self._autenticar(self.admin)
        r = self.client.post('/api/movimientos/ajuste/', {
            'producto_id': self.producto.id_producto,
            'cantidad': 5,
            'notas': 'Ajuste auditado',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        log = AuditoriaProducto.objects.latest('id_auditoria')
        self.assertEqual(log.usuario, 'jefa_auditoria')
        self.assertEqual(log.diferencia_cantidad, 5)

    def test_registra_la_ip(self):
        self._autenticar(self.admin)
        self._editar_precio('150.00')

        log = AuditoriaProducto.objects.latest('id_auditoria')
        self.assertIsNotNone(log.usuario)
        # El cliente de tests viaja con REMOTE_ADDR.
        self.assertTrue(log.ip_address)

    def test_la_columna_ya_no_tiene_el_default_de_la_base(self):
        """Sin quitar el DEFAULT CURRENT_USER, cualquier INSERT que omitiera la
        columna volvería a escribir `postgres`."""
        with connection.cursor() as c:
            c.execute("""
                SELECT column_default FROM information_schema.columns
                WHERE table_name = 'auditoria_productos' AND column_name = 'usuario'
            """)
            self.assertIsNone(c.fetchone()[0])
