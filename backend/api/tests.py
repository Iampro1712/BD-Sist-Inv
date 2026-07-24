"""
Tests de integración para los flujos críticos del negocio: ventas, stock y
pagos. Corren contra una base de datos Postgres real con el esquema híbrido
(ver backend/SQL_FILES/000_base_schema_snapshot.sql y .github/workflows/ci.yml
para cómo se bootstrapea en CI).
"""
import datetime

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from inventory.models import Proveedor, Producto, Cliente, MovimientoInventario, OrdenVenta


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
