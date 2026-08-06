"""
Tests de integración para los flujos críticos del negocio: ventas, stock y
pagos. Corren contra una base de datos Postgres real con el esquema híbrido
(ver backend/SQL_FILES/000_base_schema_snapshot.sql y .github/workflows/ci.yml
para cómo se bootstrapea en CI).
"""
import datetime
import json
import os
import shutil
import tempfile
import urllib.error
from datetime import datetime as _datetime
from decimal import Decimal
from io import StringIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from django.core.cache import cache

from .actualizaciones_views import CACHE_CLAVE_DESCARGA, _destino_confiable, _sanear_notas
from .backup_pg import (
    TABLAS_EFIMERAS, comprobar_disponible, generar_dump, nombre_dump,
    verificar_dump,
)

from inventory.models import (
    Proveedor, Producto, Cliente, MovimientoInventario, OrdenVenta, SesionCaja,
    CategoriaGasto, OrdenCompra, Moto, Servicio, ServicioMoto, BitacoraServicio,
    Cotizacion, Ubicacion, DevolucionCompra, AuditoriaProducto, ConfiguracionIA,
    Devolucion, PagoVenta, ServicioRepuesto, MovimientoCaja,
)
from .ia_catalogo import PROVEEDORES


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

    def test_los_costos_de_compra_son_solo_para_el_dueno(self):
        """Los tres caminos al costo de compra están cerrados al operador.

        Esta prueba afirmaba lo contrario: que el vendedor sí podía consultar
        `precios-proveedores` "porque necesita el precio al comprar". Era una
        decisión equivocada por dos motivos. El primero, que quien compra es el
        administrador —el formulario de órdenes de compra ya es admin-only—, así
        que el vendedor nunca necesitó ese dato. El segundo y más importante: el
        endpoint devuelve costos históricos, o sea exactamente lo que protegen
        los reportes de abajo; tener la puerta de al lado abierta hacía que ese
        candado no sirviera de nada.
        """
        self._comprar(self.barato, self.producto, 90)
        self.client.force_authenticate(user=self.operador)

        r = self.client.get(
            f'/api/productos/{self.producto.id_producto}/precios-proveedores/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

        for url in ('/api/reportes/desempeno-proveedores/',
                    '/api/reportes/comparacion-precios/'):
            self.assertEqual(self.client.get(url).status_code,
                             status.HTTP_403_FORBIDDEN, url)

        # Y el administrador sigue teniendo acceso.
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get(
            f'/api/productos/{self.producto.id_producto}/precios-proveedores/'
        ).status_code, status.HTTP_200_OK)


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


class ConfiguracionIATestCase(APITestCase):
    """Claves de proveedores de IA: cifradas, enmascaradas y fuera del respaldo.

    Una clave de API de IA es dinero directo: quien la tenga puede gastar de la
    cuenta. Por eso las pruebas se concentran en que **nunca salga del backend**
    y en que no viaje en los respaldos, más que en el CRUD.
    """

    CLAVE_OPENAI = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'
    CLAVE_ANTHROPIC = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_ia', password='x', is_staff=True)
        self.operador = User.objects.create_user(
            username='operador_ia', password='x', is_staff=False)
        self.client.force_authenticate(user=self.admin)

    def _guardar(self, **datos):
        return self.client.post('/api/configuracion-ia/guardar/', datos, format='json')

    # -- Lo esencial: la clave no sale ----------------------------------------

    def test_la_api_nunca_devuelve_la_clave_completa(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI,
                      modelo='gpt-4o-mini')

        # Se revisa el cuerpo crudo de las tres respuestas que exponen la
        # configuración: basta que una filtre la clave para que el resto no sirva.
        cuerpos = [
            self.client.get('/api/configuracion-ia/').content.decode(),
            self.client.get('/api/configuracion-ia/estado/').content.decode(),
            self._guardar(proveedor='openai', modelo='gpt-4o').content.decode(),
        ]
        for cuerpo in cuerpos:
            self.assertNotIn(self.CLAVE_OPENAI, cuerpo)
            self.assertNotIn('sk-proj-abcdef', cuerpo)

        datos = self.client.get('/api/configuracion-ia/').json()
        fila = datos['results'][0] if isinstance(datos, dict) else datos[0]
        self.assertEqual(fila['api_key_enmascarada'], 'sk-…6789')
        self.assertTrue(fila['tiene_clave'])
        self.assertNotIn('api_key', fila)

    def test_la_clave_se_guarda_cifrada_en_la_base(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)

        with connection.cursor() as c:
            c.execute('SELECT api_key FROM configuracion_ia WHERE proveedor = %s',
                      ['openai'])
            crudo = c.fetchone()[0]

        # En disco no está el texto plano, pero el ORM la lee de vuelta entera:
        # si esto último fallara, el cifrado sería inútil porque no se podría usar.
        self.assertNotEqual(crudo, self.CLAVE_OPENAI)
        self.assertNotIn('sk-proj', crudo)
        self.assertEqual(
            ConfiguracionIA.objects.get(proveedor='openai').api_key,
            self.CLAVE_OPENAI)

    def test_la_tabla_esta_excluida_del_respaldo(self):
        """Cifrada o no, una credencial no tiene por qué viajar en un respaldo."""
        from .backup_utils import EXCLUIR, generar_backup_json

        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        self.assertIn('configuracion_ia', EXCLUIR)

        contenido = json.dumps(generar_backup_json())
        self.assertNotIn('configuracion_ia', contenido)
        self.assertNotIn(self.CLAVE_OPENAI, contenido)

    # -- Reglas de uso ---------------------------------------------------------

    def test_solo_puede_haber_un_proveedor_activo(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI,
                      modelo='gpt-4o-mini', activo=True)
        self._guardar(proveedor='anthropic', api_key=self.CLAVE_ANTHROPIC,
                      modelo='claude-sonnet-5', activo=True)

        activos = list(ConfiguracionIA.objects.filter(activo=True)
                       .values_list('proveedor', flat=True))
        self.assertEqual(activos, ['anthropic'])

        estado = self.client.get('/api/configuracion-ia/estado/').json()
        self.assertEqual(estado['proveedor'], 'anthropic')
        self.assertTrue(estado['hay_proveedor_activo'])

    def test_activar_apaga_al_anterior(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI,
                      modelo='gpt-4o-mini', activo=True)
        anthropic = ConfiguracionIA.objects.create(
            proveedor='anthropic', api_key=self.CLAVE_ANTHROPIC,
            modelo='claude-sonnet-5')

        r = self.client.post(f'/api/configuracion-ia/{anthropic.pk}/activar/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            list(ConfiguracionIA.objects.filter(activo=True)
                 .values_list('proveedor', flat=True)),
            ['anthropic'])

    def test_no_se_puede_activar_un_proveedor_sin_clave(self):
        vacio = ConfiguracionIA.objects.create(proveedor='gemini')
        r = self.client.post(f'/api/configuracion-ia/{vacio.pk}/activar/')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(ConfiguracionIA.objects.get(pk=vacio.pk).activo)

    def test_editar_el_modelo_conserva_la_clave(self):
        """Cambiar de modelo no debería obligar a ir a buscar la clave otra vez."""
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI,
                      modelo='gpt-4o-mini')
        r = self._guardar(proveedor='openai', modelo='gpt-4o')

        self.assertEqual(r.status_code, 200)
        config = ConfiguracionIA.objects.get(proveedor='openai')
        self.assertEqual(config.modelo, 'gpt-4o')
        self.assertEqual(config.api_key, self.CLAVE_OPENAI)

    def test_cambiar_la_clave_invalida_la_verificacion_anterior(self):
        """Lo verificado antes no dice nada de una clave nueva."""
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        ConfiguracionIA.objects.filter(proveedor='openai').update(
            verificada=True, verificada_en=timezone.now())

        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI + 'XY')

        config = ConfiguracionIA.objects.get(proveedor='openai')
        self.assertFalse(config.verificada)
        self.assertIsNone(config.verificada_en)

    def test_sin_clave_previa_la_clave_es_obligatoria(self):
        r = self._guardar(proveedor='gemini', modelo='gemini-2.0-flash')
        self.assertEqual(r.status_code, 400)
        self.assertIn('api_key', r.json()['error']['details'])

    def test_el_alta_no_inventa_un_modelo(self):
        """Guardar la clave no elige modelo: la lista la da el proveedor después.

        Antes se ponía un sugerido escrito a mano, que podía estar retirado o no
        estar habilitado en esa cuenta.
        """
        self._guardar(proveedor='anthropic', api_key=self.CLAVE_ANTHROPIC)
        config = ConfiguracionIA.objects.get(proveedor='anthropic')
        self.assertFalse(config.modelo)
        self.assertFalse(config.activo)

        estado = self.client.get('/api/configuracion-ia/estado/').json()
        self.assertFalse(estado['hay_proveedor_activo'])

    # -- Errores de pegado ------------------------------------------------------

    def test_rechaza_la_clave_de_otro_proveedor(self):
        """`AIza...` en OpenAI es un pegado equivocado, no una clave rara."""
        r = self._guardar(proveedor='openai',
                          api_key='AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ')
        self.assertEqual(r.status_code, 400)
        self.assertIn('sk-', str(r.json()['error']['details']['api_key']))
        self.assertFalse(ConfiguracionIA.objects.filter(proveedor='openai').exists())

    def test_rechaza_que_le_peguen_la_version_enmascarada(self):
        """Copiar lo que muestra la pantalla es el error más fácil de cometer."""
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        r = self._guardar(proveedor='openai', api_key='sk-…6789xxxxxxxxxxxx')

        self.assertEqual(r.status_code, 400)
        # Y sobre todo: no pisó la clave buena con la basura.
        self.assertEqual(
            ConfiguracionIA.objects.get(proveedor='openai').api_key,
            self.CLAVE_OPENAI)

    def test_rechaza_un_proveedor_inexistente(self):
        r = self._guardar(proveedor='chatgpt-pirata', api_key=self.CLAVE_OPENAI)
        self.assertEqual(r.status_code, 400)

    # -- Permisos ---------------------------------------------------------------

    def test_el_operador_no_ve_ni_toca_la_configuracion(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        self.client.force_authenticate(user=self.operador)

        for metodo, url in [
            ('get', '/api/configuracion-ia/'),
            ('get', '/api/configuracion-ia/estado/'),
            ('get', '/api/configuracion-ia/catalogo/'),
            ('post', '/api/configuracion-ia/guardar/'),
        ]:
            r = getattr(self.client, metodo)(url, {}, format='json')
            self.assertEqual(r.status_code, 403, f'{metodo.upper()} {url}')

    def test_sin_autenticar_no_se_llega(self):
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/configuracion-ia/')
        self.assertIn(r.status_code, (401, 403))

    # -- Catálogo ---------------------------------------------------------------

    def test_el_catalogo_trae_los_cuatro_proveedores_sin_datos_internos(self):
        r = self.client.get('/api/configuracion-ia/catalogo/')
        self.assertEqual(r.status_code, 200)

        proveedores = r.json()['proveedores']
        self.assertEqual({p['id'] for p in proveedores},
                         {'openai', 'gemini', 'deepseek', 'anthropic'})
        for p in proveedores:
            self.assertTrue(p['prefijo_clave'], f"{p['id']} sin prefijo")
            self.assertTrue(p['donde_obtenerla'], f"{p['id']} sin enlace")
            # Los modelos NO viajan acá: se piden al proveedor con la clave.
            self.assertNotIn('modelos', p)
        self.assertNotIn('url_base', r.content.decode())

    def test_agregar_un_proveedor_no_requiere_migracion(self):
        """El catálogo es la única fuente: sumar uno es una entrada en el dict.

        Se comprueba que el campo `proveedor` no tenga los valores clavados en la
        base (choices o CHECK): si los tuviera, cada proveedor nuevo obligaría a
        una migración, que es justo lo que se quiso evitar.
        """
        config = ConfiguracionIA(proveedor='proveedor-futuro',
                                 api_key=self.CLAVE_OPENAI, modelo='modelo-x')
        config.full_clean()
        config.save()
        self.assertTrue(ConfiguracionIA.objects.filter(
            proveedor='proveedor-futuro').exists())

    # -- Probar la clave --------------------------------------------------------

    def test_probar_guarda_el_resultado_sin_filtrar_el_cuerpo_del_error(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        config = ConfiguracionIA.objects.get(proveedor='openai')

        with patch('api.views.probar_credencial',
                   return_value=(False, 'El proveedor rechazó la clave: está mal '
                                        'copiada o fue revocada.')) as mock:
            r = self.client.post(f'/api/configuracion-ia/{config.pk}/probar/')

        # La clave se le pasa al probador (es quien habla con el proveedor), pero
        # no aparece en lo que se devuelve ni en lo que queda guardado.
        mock.assert_called_once_with('openai', self.CLAVE_OPENAI)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(r.json()['ok'])
        self.assertNotIn(self.CLAVE_OPENAI, r.content.decode())

        config.refresh_from_db()
        self.assertFalse(config.verificada)
        self.assertIn('rechazó la clave', config.ultimo_error)

    def test_probar_con_exito_marca_verificada_y_limpia_el_error(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        config = ConfiguracionIA.objects.get(proveedor='openai')
        ConfiguracionIA.objects.filter(pk=config.pk).update(
            ultimo_error='fallo anterior')

        with patch('api.views.probar_credencial',
                   return_value=(True, 'La clave funciona.')):
            r = self.client.post(f'/api/configuracion-ia/{config.pk}/probar/')

        self.assertEqual(r.status_code, 200)
        config.refresh_from_db()
        self.assertTrue(config.verificada)
        self.assertIsNotNone(config.verificada_en)
        self.assertIsNone(config.ultimo_error)

    def test_el_limite_de_uso_no_significa_que_la_clave_sea_mala(self):
        """Un 429 dice que la cuenta llegó al tope, no que la clave esté mal."""
        import urllib.error

        from .ia_catalogo import probar_credencial as probar_real

        with patch('urllib.request.urlopen',
                   side_effect=urllib.error.HTTPError(
                       'https://x', 429, 'Too Many Requests', {}, None)):
            ok, detalle = probar_real('openai', self.CLAVE_OPENAI)
        self.assertTrue(ok)
        self.assertIn('límite', detalle)

        with patch('urllib.request.urlopen',
                   side_effect=urllib.error.HTTPError(
                       'https://x', 401, 'Unauthorized', {}, None)):
            ok, _ = probar_real('openai', self.CLAVE_OPENAI)
        self.assertFalse(ok)

    def test_borrar_la_configuracion_borra_la_clave(self):
        self._guardar(proveedor='openai', api_key=self.CLAVE_OPENAI)
        config = ConfiguracionIA.objects.get(proveedor='openai')

        r = self.client.delete(f'/api/configuracion-ia/{config.pk}/')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(ConfiguracionIA.objects.filter(pk=config.pk).exists())


class _RespuestaFalsa:
    """Imita lo que devuelve `urlopen`: se usa como context manager y se lee."""

    def __init__(self, cuerpo, status=200):
        self._cuerpo = json.dumps(cuerpo).encode('utf-8')
        self.status = status

    def read(self):
        return self._cuerpo

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class ModelosIATestCase(APITestCase):
    """La lista de modelos la da el proveedor, no una lista escrita a mano.

    Los proveedores sacan modelos nuevos cada pocos meses y retiran otros, así
    que una lista local termina ofreciendo modelos muertos y escondiendo los
    nuevos. Además la lista depende de la cuenta: dos claves del mismo proveedor
    pueden tener acceso a modelos distintos según el plan. De ahí que el modelo
    solo se pueda elegir después de cargar la clave.
    """

    CLAVE_OPENAI = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789'
    CLAVE_ANTHROPIC = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_modelos', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

    def _config(self, proveedor='openai', clave=None, modelo=None):
        return ConfiguracionIA.objects.create(
            proveedor=proveedor, api_key=clave or self.CLAVE_OPENAI, modelo=modelo)

    def _pedir_modelos(self, config, respuesta):
        with patch('urllib.request.urlopen', return_value=_RespuestaFalsa(respuesta)):
            return self.client.get(f'/api/configuracion-ia/{config.pk}/modelos/')

    # -- Sin clave no hay lista ------------------------------------------------

    def test_sin_clave_no_se_pueden_pedir_modelos(self):
        """Es la razón por la que el modelo se elige en un segundo paso."""
        vacio = ConfiguracionIA.objects.create(proveedor='gemini')
        r = self.client.get(f'/api/configuracion-ia/{vacio.pk}/modelos/')

        self.assertEqual(r.status_code, 400)
        self.assertIn('clave', r.json()['error'].lower())

    def test_no_se_puede_activar_sin_haber_elegido_modelo(self):
        """Un proveedor "en uso" sin modelo no sirve para llamar a nada."""
        config = self._config(proveedor='openai')
        r = self.client.post(f'/api/configuracion-ia/{config.pk}/activar/')

        self.assertEqual(r.status_code, 400)
        self.assertIn('modelo', r.json()['error'].lower())
        self.assertFalse(ConfiguracionIA.objects.get(pk=config.pk).activo)

    def test_guardar_tampoco_deja_activar_sin_modelo(self):
        """El mismo guarda por el otro camino, si no se cuela por ahí."""
        r = self.client.post('/api/configuracion-ia/guardar/', {
            'proveedor': 'anthropic', 'api_key': self.CLAVE_ANTHROPIC, 'activo': True,
        }, format='json')

        self.assertEqual(r.status_code, 400)
        self.assertIn('modelo', r.json()['error']['details'])
        self.assertFalse(ConfiguracionIA.objects.filter(activo=True).exists())

    # -- Lectura de la respuesta de cada proveedor -----------------------------

    def test_anthropic_usa_el_nombre_para_mostrar_que_da_la_api(self):
        config = self._config('anthropic', self.CLAVE_ANTHROPIC)
        r = self._pedir_modelos(config, {'data': [
            {'id': 'claude-sonnet-5', 'display_name': 'Claude Sonnet 5'},
            {'id': 'claude-opus-4-8', 'display_name': 'Claude Opus 4.8'},
        ]})

        self.assertEqual(r.status_code, 200)
        datos = r.json()
        self.assertTrue(datos['ok'])
        self.assertEqual([m['id'] for m in datos['modelos']],
                         ['claude-sonnet-5', 'claude-opus-4-8'])
        self.assertEqual(datos['modelos'][0]['nombre'], 'Claude Sonnet 5')

    def test_openai_descarta_lo_que_no_sirve_para_conversar(self):
        """La API mezcla chat con imágenes, audio y embeddings sin distinguirlos."""
        config = self._config('openai')
        r = self._pedir_modelos(config, {'data': [
            {'id': 'gpt-4o'},
            {'id': 'gpt-4o-mini'},
            {'id': 'o3-mini'},
            {'id': 'text-embedding-3-small'},
            {'id': 'whisper-1'},
            {'id': 'dall-e-3'},
            {'id': 'tts-1'},
            {'id': 'gpt-4o-audio-preview'},
            {'id': 'omni-moderation-latest'},
        ]})

        ids = [m['id'] for m in r.json()['modelos']]
        self.assertEqual(set(ids), {'gpt-4o', 'gpt-4o-mini', 'o3-mini'})

    def test_gemini_descarta_los_modelos_que_no_generan_texto(self):
        config = self._config('gemini', 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123')
        r = self._pedir_modelos(config, {'models': [
            {'name': 'models/gemini-2.0-flash', 'displayName': 'Gemini 2.0 Flash',
             'supportedGenerationMethods': ['generateContent']},
            {'name': 'models/text-embedding-004', 'displayName': 'Embeddings',
             'supportedGenerationMethods': ['embedContent']},
        ]})

        modelos = r.json()['modelos']
        # Se queda con el nombre pelado, sin el prefijo "models/" de la API.
        self.assertEqual([m['id'] for m in modelos], ['gemini-2.0-flash'])
        self.assertEqual(modelos[0]['nombre'], 'Gemini 2.0 Flash')

    def test_el_sugerido_aparece_primero_si_la_cuenta_lo_tiene(self):
        """Para que el que abre el selector no tenga que buscarlo."""
        sugerido = PROVEEDORES['openai']['modelo_sugerido']
        config = self._config('openai')
        r = self._pedir_modelos(config, {'data': [
            {'id': 'gpt-4o'}, {'id': 'gpt-4-turbo'}, {'id': sugerido},
        ]})

        ids = [m['id'] for m in r.json()['modelos']]
        self.assertEqual(ids[0], sugerido)
        self.assertEqual(ids[1:], sorted(['gpt-4o', 'gpt-4-turbo']))

    def test_aparecen_modelos_nuevos_sin_tocar_el_codigo(self):
        """Es el punto de consultar en vivo: no esperar una actualización."""
        config = self._config('anthropic', self.CLAVE_ANTHROPIC)
        r = self._pedir_modelos(config, {'data': [
            {'id': 'claude-modelo-del-futuro-9', 'display_name': 'Claude del futuro'},
        ]})

        self.assertEqual([m['id'] for m in r.json()['modelos']],
                         ['claude-modelo-del-futuro-9'])

    # -- Cuando el proveedor falla ---------------------------------------------

    def test_si_el_proveedor_cambia_el_formato_se_avisa_sin_reventar(self):
        config = self._config('anthropic', self.CLAVE_ANTHROPIC)
        r = self._pedir_modelos(config, {'otra_cosa': 'formato nuevo'})

        self.assertEqual(r.status_code, 400)
        self.assertFalse(r.json()['ok'])
        self.assertEqual(r.json()['modelos'], [])

    def test_una_clave_rechazada_se_explica_y_no_filtra_el_cuerpo(self):
        config = self._config('openai')
        with patch('urllib.request.urlopen',
                   side_effect=urllib.error.HTTPError(
                       'https://x', 401, 'Unauthorized', {}, None)):
            r = self.client.get(f'/api/configuracion-ia/{config.pk}/modelos/')

        self.assertEqual(r.status_code, 400)
        self.assertIn('rechazó la clave', r.json()['detalle'])
        self.assertNotIn(self.CLAVE_OPENAI, r.content.decode())

    def test_una_cuenta_sin_modelos_de_chat_se_avisa(self):
        config = self._config('openai')
        r = self._pedir_modelos(config, {'data': [{'id': 'text-embedding-3-small'}]})

        self.assertEqual(r.status_code, 400)
        self.assertIn('ningún modelo', r.json()['detalle'])

    def test_si_el_proveedor_no_responde_se_dice_asi(self):
        config = self._config('openai')
        with patch('urllib.request.urlopen', side_effect=TimeoutError()):
            r = self.client.get(f'/api/configuracion-ia/{config.pk}/modelos/')

        self.assertEqual(r.status_code, 400)
        self.assertIn('no respondió a tiempo', r.json()['detalle'])

    # -- La clave sigue sin salir ----------------------------------------------

    def test_pedir_modelos_no_devuelve_la_clave(self):
        config = self._config('anthropic', self.CLAVE_ANTHROPIC)
        r = self._pedir_modelos(config, {'data': [{'id': 'claude-sonnet-5'}]})
        self.assertNotIn(self.CLAVE_ANTHROPIC, r.content.decode())

    def test_la_clave_se_manda_al_proveedor_en_la_cabecera_que_espera(self):
        """Si va en la cabecera equivocada, el proveedor responde 401 sin decir por qué."""
        config = self._config('anthropic', self.CLAVE_ANTHROPIC)
        with patch('urllib.request.urlopen',
                   return_value=_RespuestaFalsa({'data': [{'id': 'claude-sonnet-5'}]})) as mock:
            self.client.get(f'/api/configuracion-ia/{config.pk}/modelos/')

        peticion = mock.call_args[0][0]
        self.assertEqual(peticion.get_header('X-api-key'), self.CLAVE_ANTHROPIC)
        self.assertEqual(peticion.get_header('Anthropic-version'), '2023-06-01')
        # Anthropic no usa Bearer: mandarlo así es el error clásico al copiar
        # el código de OpenAI.
        self.assertIsNone(peticion.get_header('Authorization'))

    def test_openai_manda_la_clave_como_bearer(self):
        config = self._config('openai')
        with patch('urllib.request.urlopen',
                   return_value=_RespuestaFalsa({'data': [{'id': 'gpt-4o'}]})) as mock:
            self.client.get(f'/api/configuracion-ia/{config.pk}/modelos/')

        peticion = mock.call_args[0][0]
        self.assertEqual(peticion.get_header('Authorization'),
                         f'Bearer {self.CLAVE_OPENAI}')

    def test_gemini_manda_la_clave_en_la_url(self):
        """Gemini no usa cabecera: la clave va como parámetro."""
        clave = 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123'
        config = self._config('gemini', clave)
        with patch('urllib.request.urlopen',
                   return_value=_RespuestaFalsa({'models': []})) as mock:
            self.client.get(f'/api/configuracion-ia/{config.pk}/modelos/')

        self.assertIn(f'key={clave}', mock.call_args[0][0].full_url)


class PronosticoDemandaTestCase(APITestCase):
    """Qué recomprar, cuándo y cuánto.

    Los números de este reporte deciden cuánta plata se inmoviliza en
    inventario, así que las pruebas verifican la **aritmética exacta** con casos
    calculables a mano, no solo que el endpoint responda 200.

    Escenario base: 40 unidades vendidas repartidas en 4 meses con actividad
    (10 por mes → 0,3333 por día), plazo de entrega 15 días, colchón 7,
    horizonte 30.

        punto_reorden = 0,3333 × (15 + 7)      = 7,33 → 8
        objetivo      = 0,3333 × (15 + 7 + 30) = 17,33
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='jefe_compras', password='x', is_staff=True)
        self.operador = User.objects.create_user(
            username='vendedor', password='x', is_staff=False)
        self.client.force_authenticate(user=self.admin)

        # La tabla catálogo `estado` (FK de orden_compra.id_estado) tiene datos
        # en producción, pero el snapshot de esquema para tests viene vacío.
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(
            nombre_empresa='Repuestos Managua', dias_entrega_estimado=15)
        self.cliente = Cliente.objects.create(nombre='Cliente de prueba')

        self.hoy = timezone.localdate()
        # Cuatro meses con actividad y un hueco deliberado en el medio: es la
        # forma que tienen los datos reales del negocio.
        #
        # Las fechas se ancla a meses concretos, no a "hace N días": con
        # desplazamientos en días, dos de ellos pueden caer en el mismo mes
        # calendario según la fecha en que se corra, y entonces la prueba pasa
        # unos días y falla otros. Pasó: -300 y -270 días cayeron ambos en
        # octubre y el divisor bajó de 4 meses a 3.
        self.meses = [self._mes_atras(n) for n in (10, 9, 2, 1)]

    def _mes_atras(self, n):
        """Día 15 del mes `n` meses antes de hoy.

        El 15 evita los bordes: un "hace N meses" hecho con días termina
        cruzándose de mes según la longitud de cada uno.
        """
        anio, mes = self.hoy.year, self.hoy.month - n
        while mes < 1:
            anio, mes = anio - 1, mes + 12
        return datetime.date(anio, mes, 15)

    def _producto(self, nombre, stock, costo=100):
        return Producto.objects.create(
            sku_producto=f'SKU-{nombre}', nombre=nombre,
            cantidad_actual=stock, cantidad_total=stock, cantidad_minima=3,
            precio_compra_unitario=costo, precio_final='200.00',
            id_proveedor=self.proveedor)

    def _vender(self, producto, fecha, cantidad):
        venta = OrdenVenta.objects.create(
            id_cliente=self.cliente.id_cliente, fecha=fecha, total=0)
        with connection.cursor() as c:
            c.execute('INSERT INTO producto_venta '
                      '(id_venta, id_producto, cantidad, precio_unitario) '
                      'VALUES (%s, %s, %s, 200)',
                      [venta.id_venta, producto.id_producto, cantidad])
        return venta

    def _historial(self, producto, por_mes=10):
        """10 unidades en cada uno de los 4 meses con actividad."""
        for fecha in self.meses:
            self._vender(producto, fecha, por_mes)

    def _orden_compra(self, estado, recibida=None, creada=None):
        """Crea una orden de compra por el ORM.

        Por el ORM y no con SQL crudo a propósito: `orden_compra` tiene varias
        columnas NOT NULL con default (monto_pagado, saldo_pendiente,
        estado_pago) y armarlas a mano en el INSERT se rompe cada vez que se
        agrega una.
        """
        orden = OrdenCompra.objects.create(
            id_proveedor=self.proveedor.id_proveedor, id_estado=estado,
            fecha_creacion=creada or self.hoy,
            fecha_recepcion=recibida,
            stock_aplicado=bool(recibida))
        return orden.id_orden

    def _linea_compra(self, id_orden, producto, cantidad):
        """Línea de una orden de compra (`orden_producto` no tiene modelo)."""
        with connection.cursor() as c:
            c.execute('INSERT INTO orden_producto '
                      '(id_orden, id_producto, cantidad, precio_unitario) '
                      'VALUES (%s, %s, %s, 100)',
                      [id_orden, producto.id_producto, cantidad])

    def _pedir_pendiente(self, producto, cantidad):
        """Una orden de compra pendiente de recibir."""
        self._linea_compra(self._orden_compra(2), producto, cantidad)

    def _reporte(self, **params):
        r = self.client.get('/api/reportes/pronostico-demanda/', params)
        self.assertEqual(r.status_code, 200)
        return r.json()

    def _fila(self, datos, nombre):
        for p in datos['productos']:
            if p['nombre'] == nombre:
                return p
        self.fail(f'{nombre} no salió en el reporte')

    # -- La aritmética ---------------------------------------------------------

    def test_la_velocidad_excluye_los_meses_sin_actividad(self):
        """El divisor son los meses que vendieron, no los transcurridos.

        Es el detalle que más cambia el resultado: hay meses enteros sin una
        sola venta. Contarlos como ceros haría ver la demanda más baja de lo que
        es y el sistema recomendaría comprar de menos.
        """
        producto = self._producto('Filtro de Aceite Honda', 20)
        self._historial(producto)   # 40 uds en 4 meses con actividad

        datos = self._reporte()
        fila = self._fila(datos, 'Filtro de Aceite Honda')

        # 40 uds / 4 meses = 10 por mes. Si dividiera por los ~10 meses
        # calendario que abarca la ventana daría 4 y sería falso.
        self.assertEqual(fila['unidades_vendidas'], 40)
        self.assertEqual(fila['meses_base'], 4)
        self.assertEqual(fila['velocidad_mensual'], 10.0)
        # Y el hueco queda declarado, no escondido.
        self.assertTrue(datos['contexto']['meses_sin_actividad'])

    def test_punto_de_reorden_y_cantidad_sugerida(self):
        """0,3333/día × 22 días de reposición = 7,33 → 8."""
        producto = self._producto('Bujía NGK Iridium', 5)
        self._historial(producto)

        fila = self._fila(self._reporte(), 'Bujía NGK Iridium')

        self.assertEqual(fila['punto_reorden'], 8)
        self.assertEqual(fila['plazo_entrega_dias'], 15)
        # objetivo 17,33 − stock 5 = 12,33 → se redondea hacia arriba: comprar
        # de menos deja al cliente sin repuesto.
        self.assertEqual(fila['cantidad_sugerida'], 13)
        self.assertEqual(fila['inversion'], 1300.0)   # 13 × C$100
        self.assertEqual(fila['urgencia'], 'critico')

    def test_stock_holgado_no_manda_a_comprar(self):
        producto = self._producto('Aceite Motul 10W40', 20)
        self._historial(producto)

        fila = self._fila(self._reporte(), 'Aceite Motul 10W40')

        # 20 en stock supera el objetivo de 17,33: no hay nada que pedir.
        self.assertEqual(fila['cantidad_sugerida'], 0)
        self.assertEqual(fila['urgencia'], 'ok')
        self.assertEqual(fila['dias_cobertura'], 60)   # 20 / 0,3333

    def test_lo_ya_pedido_se_descuenta(self):
        """Sin esto el reporte manda a comprar algo que viene en camino.

        Es plata gastada dos veces y el error es silencioso: el stock se ve bajo
        porque la mercadería todavía no llegó.
        """
        producto = self._producto('Guaya de Embrague', 5)
        self._historial(producto)
        self._pedir_pendiente(producto, 10)

        fila = self._fila(self._reporte(), 'Guaya de Embrague')

        self.assertEqual(fila['en_camino'], 10)
        # objetivo 17,33 − stock 5 − en camino 10 = 2,33 → 3
        self.assertEqual(fila['cantidad_sugerida'], 3)
        # Y ya no es crítico: con lo que viene supera el punto de reorden.
        self.assertNotEqual(fila['urgencia'], 'critico')

    def test_una_orden_recibida_no_cuenta_como_en_camino(self):
        """Solo lo pendiente está en camino; lo recibido ya está en el stock."""
        producto = self._producto('Pastillas de Freno', 5)
        self._historial(producto)
        self._linea_compra(self._orden_compra(3, recibida=self.hoy), producto, 50)

        fila = self._fila(self._reporte(), 'Pastillas de Freno')
        self.assertEqual(fila['en_camino'], 0)

    def test_una_orden_cancelada_no_cuenta_como_en_camino(self):
        producto = self._producto('Llanta Michelin 130/70-17', 5)
        self._historial(producto)
        self._linea_compra(self._orden_compra(1), producto, 99)

        fila = self._fila(self._reporte(), 'Llanta Michelin 130/70-17')
        self.assertEqual(fila['en_camino'], 0)

    def test_un_producto_nuevo_no_se_promedia_contra_meses_en_que_no_existia(self):
        """A un producto que entró hace poco no se le reparte la demanda entre
        todos los meses: se lo mediría como mucho más lento de lo que es."""
        nuevo = self._producto('Kit Arrastre Completo', 5)
        # Solo en los dos meses recientes, 10 unidades cada uno.
        for fecha in self.meses[2:]:
            self._vender(nuevo, fecha, 10)
        # Otro producto vende en los 4, para que el negocio tenga 4 meses activos.
        self._historial(self._producto('Aceite Castrol 20W50', 50))

        datos = self._reporte()
        self.assertEqual(datos['contexto']['meses_con_actividad'], 4)

        fila = self._fila(datos, 'Kit Arrastre Completo')
        # 20 uds sobre 2 meses = 10/mes, no 20/4 = 5/mes.
        self.assertEqual(fila['meses_base'], 2)
        self.assertEqual(fila['velocidad_mensual'], 10.0)

    def test_el_horizonte_cambia_cuanto_se_sugiere(self):
        producto = self._producto('Cadena 428H', 5)
        self._historial(producto)

        corto = self._fila(self._reporte(horizonte=15), 'Cadena 428H')
        largo = self._fila(self._reporte(horizonte=60), 'Cadena 428H')

        self.assertLess(corto['cantidad_sugerida'], largo['cantidad_sugerida'])
        # 0,3333 × (22+60) = 27,33 − 5 = 22,33 → 23
        self.assertEqual(largo['cantidad_sugerida'], 23)

    # -- Confianza: no todos los números valen lo mismo ------------------------

    def test_la_confianza_refleja_cuantos_meses_hay_detras(self):
        """Un producto con una sola venta no puede verse igual que uno estable."""
        firme = self._producto('Filtro de Aire Yamaha', 5)
        # Seis meses distintos, anclados al mes (ver `_mes_atras`).
        for n in (10, 9, 8, 7, 6, 2):
            self._vender(firme, self._mes_atras(n), 5)

        flojo = self._producto('Chaqueta Yamaha Racing', 5)
        self._vender(flojo, self._mes_atras(1), 1)

        datos = self._reporte()
        self.assertEqual(self._fila(datos, 'Filtro de Aire Yamaha')['confianza'], 'alta')
        self.assertEqual(self._fila(datos, 'Chaqueta Yamaha Racing')['confianza'], 'baja')
        self.assertEqual(datos['resumen']['confianza_baja'], 1)

    def test_un_producto_sin_ventas_no_recibe_pronostico_inventado(self):
        """Va a una lista aparte: puede ser nuevo o puede ser que nadie lo
        quiera, y eso lo decide una persona."""
        self._historial(self._producto('Bombillo LED H4', 20))
        jamas = self._producto('Casco Yamaha Talla L', 8, costo=500)

        datos = self._reporte()

        nombres = [p['nombre'] for p in datos['productos']]
        self.assertNotIn('Casco Yamaha Talla L', nombres)

        sin_historial = {p['nombre']: p for p in datos['sin_historial']}
        self.assertIn('Casco Yamaha Talla L', sin_historial)
        self.assertEqual(sin_historial['Casco Yamaha Talla L']['capital_inmovilizado'],
                         4000.0)   # 8 × C$500
        self.assertEqual(datos['resumen']['sin_historial'], 1)

    # -- Plazo de entrega: se declara de dónde salió ---------------------------

    def test_sin_dato_del_proveedor_se_usa_el_default_y_se_dice(self):
        sin_plazo = Proveedor.objects.create(nombre_empresa='Importadora Sin Datos')
        producto = Producto.objects.create(
            sku_producto='SKU-SP', nombre='Empaque de Motor', cantidad_actual=5,
            cantidad_total=5, cantidad_minima=2, precio_compra_unitario=100,
            precio_final='200.00', id_proveedor=sin_plazo)
        self._historial(producto)

        datos = self._reporte()
        fila = self._fila(datos, 'Empaque de Motor')

        self.assertEqual(fila['fuente_plazo'], 'default')
        self.assertEqual(fila['plazo_entrega_dias'],
                         datos['parametros']['plazo_default_dias'])

    def test_el_plazo_cargado_a_mano_se_usa_y_se_marca_como_estimado(self):
        producto = self._producto('Disco de Freno 220mm', 5)
        self._historial(producto)
        fila = self._fila(self._reporte(), 'Disco de Freno 220mm')

        self.assertEqual(fila['fuente_plazo'], 'estimado')
        self.assertEqual(fila['plazo_entrega_dias'], 15)

    def test_el_plazo_medido_le_gana_al_cargado_a_mano(self):
        """Dos recepciones reales valen más que una estimación: el sistema
        prefiere el dato medido y lo declara."""
        for dias_atras, tardanza in ((100, 30), (80, 30)):
            creada = self.hoy - datetime.timedelta(days=dias_atras)
            self._orden_compra(3, creada=creada,
                               recibida=creada + datetime.timedelta(days=tardanza))

        producto = self._producto('Piston Yamaha YBR125', 5)
        self._historial(producto)

        fila = self._fila(self._reporte(), 'Piston Yamaha YBR125')
        self.assertEqual(fila['fuente_plazo'], 'medido')
        self.assertEqual(fila['plazo_entrega_dias'], 30)   # no el 15 estimado
        # Con plazo 30 el punto de reorden sube: 0,3333 × 37 = 12,33 → 13
        self.assertEqual(fila['punto_reorden'], 13)

    def test_una_sola_recepcion_no_alcanza_para_definir_el_plazo(self):
        """Un caso aislado puede ser un atraso raro, no el comportamiento."""
        creada = self.hoy - datetime.timedelta(days=100)
        self._orden_compra(3, creada=creada,
                           recibida=creada + datetime.timedelta(days=90))

        producto = self._producto('Estator Suzuki GN125', 5)
        self._historial(producto)

        fila = self._fila(self._reporte(), 'Estator Suzuki GN125')
        self.assertEqual(fila['fuente_plazo'], 'estimado')
        self.assertEqual(fila['plazo_entrega_dias'], 15)

    # -- Orden, resumen y permisos --------------------------------------------

    def test_lo_urgente_aparece_primero(self):
        agotado = self._producto('Refrigerante Motor', 0)
        self._historial(agotado)
        holgado = self._producto('Grasa para Rodamientos', 100)
        self._historial(holgado)

        datos = self._reporte()
        self.assertEqual(datos['productos'][0]['nombre'], 'Refrigerante Motor')
        self.assertEqual(datos['productos'][0]['urgencia'], 'sin_stock')
        self.assertEqual(datos['resumen']['sin_stock'], 1)

    def test_la_inversion_sugerida_suma_solo_lo_que_hay_que_comprar(self):
        comprar = self._producto('Zapatas de Freno', 5, costo=200)
        self._historial(comprar)
        no_comprar = self._producto('Limpiador de Cadena', 100, costo=50)
        self._historial(no_comprar)

        datos = self._reporte()
        # 13 uds × C$200; el que no hay que comprar no suma nada.
        self.assertEqual(datos['resumen']['productos_a_recomprar'], 1)
        self.assertEqual(datos['resumen']['inversion_sugerida'], 2600.0)

    def test_la_base_vacia_no_revienta(self):
        datos = self._reporte()
        self.assertEqual(datos['productos'], [])
        self.assertEqual(datos['resumen']['inversion_sugerida'], 0)
        self.assertIsNone(datos['contexto']['primer_mes'])

    def test_el_operador_no_ve_el_pronostico(self):
        """Expone costos y márgenes de compra: es información de dueño."""
        self.client.force_authenticate(user=self.operador)
        r = self.client.get('/api/reportes/pronostico-demanda/')
        self.assertEqual(r.status_code, 403)

    def test_se_expone_el_umbral_viejo_para_poder_compararlo(self):
        """`cantidad_minima` era un número fijo puesto a mano; mostrarlo al lado
        del punto de reorden calculado es lo que revela si estaba mal."""
        producto = self._producto('Manigueta de Embrague', 5)
        producto.cantidad_minima = 99
        producto.save()
        self._historial(producto)

        fila = self._fila(self._reporte(), 'Manigueta de Embrague')
        self.assertEqual(fila['cantidad_minima_actual'], 99)
        self.assertEqual(fila['punto_reorden'], 8)


class AnalisisIAPronosticoTestCase(APITestCase):
    """La IA interpreta el pronóstico; no lo calcula ni lo puede romper."""

    CLAVE = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123'

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='jefa_ia', password='x', is_staff=True)
        self.operador = User.objects.create_user(
            username='cajero', password='x', is_staff=False)
        self.client.force_authenticate(user=self.admin)

        self.productos = [{
            'nombre': 'Pastillas de Freno Delanteras', 'stock': 5,
            'velocidad_mensual': 10.0, 'dias_cobertura': 15,
            'cantidad_sugerida': 13, 'urgencia': 'critico',
            'confianza': 'alta', 'meses_con_venta': 8,
        }]

    def _activar_ia(self):
        return ConfiguracionIA.objects.create(
            proveedor='anthropic', api_key=self.CLAVE,
            modelo='claude-sonnet-5', activo=True)

    def _analizar(self, cuerpo=None):
        return self.client.post(
            '/api/reportes/pronostico-demanda/analizar/',
            cuerpo if cuerpo is not None else {'productos': self.productos},
            format='json')

    def test_sin_proveedor_activo_lo_dice_sin_romperse(self):
        """Y con 409, no 500: falta configuración, no es una falla."""
        r = self._analizar()
        self.assertEqual(r.status_code, 409)
        self.assertIn('Configuración', r.json()['error'])

    def test_sin_modelo_elegido_tampoco_llama_al_proveedor(self):
        ConfiguracionIA.objects.create(
            proveedor='anthropic', api_key=self.CLAVE, activo=True)
        with patch('api.reportes_views.preguntar_json') as mock:
            r = self._analizar()
        self.assertEqual(r.status_code, 409)
        mock.assert_not_called()

    def test_devuelve_las_notas_del_proveedor(self):
        self._activar_ia()
        respuesta = {
            'resumen': 'Hay 1 producto crítico.',
            'estacionalidad': 'Entrando a temporada lluviosa suben los frenos.',
            'notas': [{'producto': 'Pastillas de Freno Delanteras',
                       'nota': 'Con las lluvias se desgastan más rápido.'}],
            'agrupaciones': [{'titulo': 'Sistema de frenos',
                              'productos': ['Pastillas de Freno Delanteras']}],
        }
        with patch('api.reportes_views.preguntar_json',
                   return_value=(respuesta, None)):
            r = self._analizar()

        self.assertEqual(r.status_code, 200)
        datos = r.json()
        self.assertIn('crítico', datos['resumen'])
        self.assertEqual(len(datos['notas']), 1)
        self.assertEqual(datos['proveedor'], 'Anthropic (Claude)')
        self.assertEqual(datos['modelo'], 'claude-sonnet-5')

    def test_no_se_le_manda_ningun_dato_de_cliente(self):
        """La IA necesita productos y cantidades; los clientes no son asunto de
        un proveedor externo."""
        self._activar_ia()
        with patch('api.reportes_views.preguntar_json',
                   return_value=({'resumen': 'ok'}, None)) as mock:
            self._analizar()

        prompt = mock.call_args[0][2]
        for palabra in ('cliente', 'telefono', 'email', 'cedula'):
            self.assertNotIn(palabra, prompt.lower())

    def test_la_clave_no_viaja_en_la_respuesta(self):
        self._activar_ia()
        with patch('api.reportes_views.preguntar_json',
                   return_value=({'resumen': 'ok'}, None)):
            r = self._analizar()
        self.assertNotIn(self.CLAVE, r.content.decode())

    def test_si_el_proveedor_falla_se_informa_como_falla_externa(self):
        """502 y no 500: el pronóstico está bien, el que no pudo es el proveedor."""
        self._activar_ia()
        with patch('api.reportes_views.preguntar_json',
                   return_value=(None, 'La cuenta del proveedor no tiene saldo.')):
            r = self._analizar()

        self.assertEqual(r.status_code, 502)
        self.assertIn('saldo', r.json()['error'])

    def test_una_respuesta_con_basura_no_llega_al_frontend(self):
        """El modelo puede omitir campos o cambiar tipos; se normaliza acá."""
        self._activar_ia()
        respuesta = {
            'resumen': 'algo',
            'notas': [
                {'producto': 'Válido', 'nota': 'sirve'},
                {'producto': 'Sin nota'},          # incompleta
                'esto no es un objeto',            # tipo equivocado
            ],
            'agrupaciones': [{'titulo': 'x', 'productos': 'no es lista'}],
        }
        with patch('api.reportes_views.preguntar_json',
                   return_value=(respuesta, None)):
            r = self._analizar()

        datos = r.json()
        self.assertEqual(len(datos['notas']), 1)
        self.assertEqual(datos['notas'][0]['producto'], 'Válido')
        self.assertEqual(datos['agrupaciones'], [])

    def test_se_recorta_cuantos_productos_se_mandan(self):
        """Mandar el catálogo entero cuesta tokens y diluye el consejo."""
        self._activar_ia()
        muchos = [dict(self.productos[0], nombre=f'Producto {i}')
                  for i in range(60)]
        with patch('api.reportes_views.preguntar_json',
                   return_value=({'resumen': 'ok'}, None)):
            r = self._analizar({'productos': muchos})

        self.assertEqual(r.json()['analizados'], 25)

    def test_sin_productos_no_se_gasta_una_llamada(self):
        self._activar_ia()
        with patch('api.reportes_views.preguntar_json') as mock:
            r = self._analizar({'productos': []})
        self.assertEqual(r.status_code, 400)
        mock.assert_not_called()

    def test_el_operador_no_puede_gastar_la_clave_de_ia(self):
        """Cada análisis cuesta dinero de la cuenta del proveedor."""
        self._activar_ia()
        self.client.force_authenticate(user=self.operador)
        r = self._analizar()
        self.assertEqual(r.status_code, 403)


class RespaldoRestaurableTestCase(TestCase):
    """El respaldo tiene que poder volver a levantar la base.

    El volcado JSON anterior era solo datos: sin esquema, sin secuencias y sin
    los disparadores. Restaurar desde él obligaba a reconstruir el esquema a
    mano y reajustar cada contador — algo que nadie quiere descubrir con el
    negocio parado. Estas pruebas cubren que el camino restaurable exista, que
    se verifique, y sobre todo que **cuando no se puede, se diga**.

    El ciclo completo de restauración (volcar, borrar la base, restaurar y
    comprobar datos, disparadores y secuencias) se validó a mano contra un
    Postgres 15 igual al de producción; acá no se repite porque haría falta
    `pg_dump` instalado y una base desechable por prueba.
    """

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)

    def _correr(self, **extra):
        """Corre el comando escribiendo en un directorio temporal."""
        salida, errores = StringIO(), StringIO()
        with patch.dict(os.environ, {'BACKUP_DIR': str(self.dir)}):
            call_command('backup_db', '--sin-subir', stdout=salida,
                         stderr=errores, **extra)
        return salida.getvalue(), errores.getvalue()

    # -- Disponibilidad: decir la verdad sobre qué respaldo se pudo hacer ------

    def test_sin_pg_dump_avisa_como_instalarlo(self):
        with patch('api.backup_pg.version_pg_dump', return_value=None):
            ok, detalle = comprobar_disponible()
        self.assertFalse(ok)
        self.assertIn('postgresql-client', detalle)

    def test_un_cliente_mas_viejo_que_el_servidor_se_rechaza(self):
        """pg_dump se niega a volcar de un servidor más nuevo que él.

        Es un error duro, no una advertencia: si el servidor se actualiza y el
        contenedor queda con el cliente viejo, los respaldos dejan de salir. Vale
        detectarlo con un mensaje que diga qué hacer.
        """
        with patch('api.backup_pg.version_pg_dump', return_value=15), \
             patch('api.backup_pg.version_servidor', return_value=17):
            ok, detalle = comprobar_disponible()

        self.assertFalse(ok)
        self.assertIn('Dockerfile', detalle)
        self.assertIn('17', detalle)

    def test_un_cliente_mas_nuevo_que_el_servidor_sirve(self):
        """Al revés sí funciona, y es lo que hay en producción (cliente 17,
        servidor 15): así el respaldo sobrevive a una actualización del servidor."""
        with patch('api.backup_pg.version_pg_dump', return_value=17), \
             patch('api.backup_pg.version_servidor', return_value=15):
            ok, _ = comprobar_disponible()
        self.assertTrue(ok)

    # -- Verificación: un respaldo sin comprobar es una esperanza --------------

    def test_un_archivo_corrupto_no_pasa_la_verificacion(self):
        malo = self.dir / 'truncado.dump'
        malo.write_bytes(b'PGDMP' + b'\x00' * 50)   # encabezado y nada más

        ok, detalle = verificar_dump(malo)
        self.assertFalse(ok)
        self.assertTrue(detalle)

    def test_un_archivo_que_no_existe_no_pasa_la_verificacion(self):
        ok, _ = verificar_dump(self.dir / 'no-existe.dump')
        self.assertFalse(ok)

    def test_un_dump_que_falla_la_verificacion_se_descarta(self):
        """No se guarda ni se sube un archivo que no se pudo leer: dejarlo daría
        la impresión de que hay respaldo del día."""
        def fingir_dump(destino):
            Path(destino).write_bytes(b'basura')
            return True, '1 KB'

        with patch('api.backup_pg.comprobar_disponible', return_value=(True, 'ok')), \
             patch('api.management.commands.backup_db.generar_dump',
                   side_effect=fingir_dump), \
             patch('api.management.commands.backup_db.verificar_dump',
                   return_value=(False, 'archivo ilegible')):
            salida, errores = self._correr()

        self.assertIn('no pasó la verificación', errores)
        self.assertEqual(list(self.dir.glob('*.dump')), [])
        # Y como no hubo respaldo restaurable, cayó al JSON y lo dijo.
        self.assertIn('NO restaura', errores)

    # -- Qué queda fuera del respaldo -----------------------------------------

    def test_los_tokens_de_sesion_quedan_fuera(self):
        """Son credenciales de un momento que ya pasó: no sirven al restaurar y
        su filtración permite entrar al sistema. Se encontraron tokens vigentes
        en un respaldo público."""
        self.assertIn('token_blacklist_outstandingtoken', TABLAS_EFIMERAS)
        self.assertIn('token_blacklist_blacklistedtoken', TABLAS_EFIMERAS)
        self.assertIn('django_session', TABLAS_EFIMERAS)

    def test_los_usuarios_si_van_al_respaldo(self):
        """Un respaldo donde nadie puede iniciar sesión no restaura el sistema.

        A diferencia del volcado JSON, que los excluye porque de todos modos no
        sirve para restaurar, acá el objetivo es volver a operar.
        """
        self.assertNotIn('auth_user', TABLAS_EFIMERAS)

    def test_las_tablas_excluidas_se_le_pasan_a_pg_dump(self):
        with patch('api.backup_pg.comprobar_disponible', return_value=(True, 'ok')), \
             patch('api.backup_pg.subprocess.run') as correr:
            correr.return_value = SimpleNamespace(returncode=0, stdout='', stderr='')
            destino = self.dir / 'x.dump'
            destino.write_bytes(b'contenido')
            generar_dump(destino)

        cmd = correr.call_args[0][0]
        self.assertIn('-Fc', cmd)
        for tabla in TABLAS_EFIMERAS:
            self.assertIn(tabla, cmd)

    # -- Seguridad de la ejecución --------------------------------------------

    def test_la_contrasena_no_va_en_los_argumentos(self):
        """Lo que se pasa por línea de comandos lo ve cualquier proceso con `ps`.

        Se usa una contraseña inventada bien distinta: la de la base de tests es
        "test", que aparece dentro del nombre de la base y de las rutas
        temporales, así que buscarla daría un falso positivo.
        """
        secreta = 'clave-inventada-para-la-prueba-9z7x'
        bases = {'default': {**settings.DATABASES['default'], 'PASSWORD': secreta}}

        with patch('api.backup_pg.comprobar_disponible', return_value=(True, 'ok')), \
             patch.dict('api.backup_pg.settings.DATABASES', bases), \
             patch('api.backup_pg.subprocess.run') as correr:
            correr.return_value = SimpleNamespace(returncode=0, stdout='', stderr='')
            destino = self.dir / 'x.dump'
            destino.write_bytes(b'contenido')
            generar_dump(destino)

        cmd = [str(a) for a in correr.call_args[0][0]]
        entorno = correr.call_args[1]['env']

        self.assertNotIn(secreta, ' '.join(cmd))
        self.assertEqual(entorno.get('PGPASSWORD'), secreta)
        # Y se le prohíbe pedirla por consola: en un cron nadie la va a escribir.
        self.assertIn('--no-password', cmd)

    def test_un_dump_vacio_se_reporta_como_falla(self):
        """pg_dump puede terminar con código 0 y dejar un archivo de 0 bytes."""
        with patch('api.backup_pg.comprobar_disponible', return_value=(True, 'ok')), \
             patch('api.backup_pg.subprocess.run') as correr:
            correr.return_value = SimpleNamespace(returncode=0, stdout='', stderr='')
            destino = self.dir / 'vacio.dump'
            destino.touch()
            ok, detalle = generar_dump(destino)

        self.assertFalse(ok)
        self.assertIn('vacío', detalle)

    # -- El camino de emergencia ----------------------------------------------

    def test_sin_pg_dump_deja_el_json_pero_avisa_que_no_restaura(self):
        """Mejor tener los datos que nada, pero no se puede dejar creer que hay
        un respaldo completo: eso fue el problema original."""
        with patch('api.backup_pg.version_pg_dump', return_value=None):
            salida, errores = self._correr()

        self.assertEqual(len(list(self.dir.glob('inventrix-backup-*.json'))), 1)
        self.assertEqual(list(self.dir.glob('*.dump')), [])
        self.assertIn('solo datos', salida)
        self.assertIn('esquema', salida)
        self.assertIn('NO restaura', errores)

    def test_con_pg_dump_no_se_genera_el_json(self):
        """Habiendo respaldo restaurable, el JSON solo ocuparía lugar."""
        def fingir_dump(destino):
            Path(destino).write_bytes(b'x' * 2048)
            return True, '2 KB'

        with patch('api.backup_pg.comprobar_disponible', return_value=(True, 'ok')), \
             patch('api.management.commands.backup_db.generar_dump',
                   side_effect=fingir_dump), \
             patch('api.management.commands.backup_db.verificar_dump',
                   return_value=(True, '200 objetos')):
            salida, errores = self._correr()

        self.assertEqual(len(list(self.dir.glob('*.dump'))), 1)
        self.assertEqual(list(self.dir.glob('inventrix-backup-*.json')), [])
        self.assertIn('Respaldo restaurable', salida)
        self.assertNotIn('NO restaura', errores)

    # -- Retención ------------------------------------------------------------

    def test_la_retencion_cuenta_cada_formato_por_separado(self):
        """Si se contaran juntos, una racha de respaldos JSON de emergencia
        podría borrar el último `.dump` restaurable, que es el que hay que
        conservar."""
        for i in range(5):
            (self.dir / f'inventrix-2026010{i}-000000.dump').write_bytes(b'x')
            (self.dir / f'inventrix-backup-2026010{i}-000000.json').write_text('{}')

        with patch('api.backup_pg.version_pg_dump', return_value=None):
            self._correr(retener=3)

        # El comando agrega un JSON más, así que quedan 3 de cada uno.
        self.assertEqual(len(list(self.dir.glob('*.dump'))), 3)
        self.assertEqual(len(list(self.dir.glob('inventrix-backup-*.json'))), 3)

    def test_se_conservan_los_dumps_mas_recientes(self):
        for dia in ('01', '02', '03'):
            (self.dir / f'inventrix-202601{dia}-000000.dump').write_bytes(b'x')

        with patch('api.backup_pg.version_pg_dump', return_value=None):
            self._correr(retener=1)

        quedan = [p.name for p in self.dir.glob('*.dump')]
        self.assertEqual(quedan, ['inventrix-20260103-000000.dump'])

    def test_el_nombre_del_dump_ordena_cronologicamente(self):
        """La retención ordena por nombre, así que el nombre tiene que ordenar
        igual que la fecha."""
        temprano = nombre_dump(_datetime(2026, 1, 5, 9, 0, 0))
        tarde = nombre_dump(_datetime(2026, 11, 5, 9, 0, 0))
        self.assertLess(temprano, tarde)
        self.assertTrue(tarde.endswith('.dump'))


class AuditoriaCorreccionesTestCase(APITestCase):
    """Los seis arreglos de la auditoría de seguridad y corrección.

    Cada prueba fija un comportamiento que estaba mal en producción, así que
    todas describen el escenario concreto que fallaba.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='dueno_audit', password='x', is_staff=True)
        self.operador = User.objects.create_user(
            username='vendedor_audit', password='x', is_staff=False)
        self.client.force_authenticate(user=self.admin)

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Auditoría')
        self.cliente = Cliente.objects.create(nombre='Cliente Auditoría')

    def _producto(self, nombre, stock, costo=100, venta='200.00'):
        return Producto.objects.create(
            sku_producto=f'SKU-{nombre}', nombre=nombre,
            cantidad_actual=stock, cantidad_total=stock, cantidad_minima=2,
            precio_compra_unitario=costo, precio_final=venta,
            id_proveedor=self.proveedor)

    # ==================================================================
    # #1 — Aprobar un presupuesto es todo o nada
    # ==================================================================

    def _orden_de_taller(self):
        """Orden de taller en diagnóstico, que es de donde sale un presupuesto."""
        moto = Moto.objects.create(
            id_cliente=self.cliente, marca='Yamaha', modelo='YBR125',
            anio=2020, placa='AUD-1')
        tipo = Servicio.objects.create(
            nombre='Reparación de motor', tipo='Reparacion',
            precio_mano_obra='500.00', es_plantilla=True)

        r = self.client.post('/api/servicios-motos/', {
            'id_moto': moto.id_moto,
            'fecha_servicio': str(timezone.localdate()),
            'tipo_servicio': 'Reparación de motor',
            'id_tipo_servicio': tipo.id_servicio,
        }, format='json')
        id_servicio = r.data['id_servicio']
        for estado in ('recibida', 'en_diagnostico'):
            self.client.post(
                f'/api/servicios-motos/{id_servicio}/cambiar-estado/',
                {'estado': estado}, format='json')
        return id_servicio, tipo

    def _presupuestar(self, id_servicio, tipo, productos):
        """`productos` es [(producto, cantidad, precio)]."""
        return self.client.post(
            f'/api/servicios-motos/{id_servicio}/presupuestar/', {
                'servicios': [{'servicio': tipo.id_servicio, 'cantidad': 1,
                               'precio_unitario': 500}],
                'productos': [{'producto': p.id_producto, 'cantidad': c,
                               'precio_unitario': pr} for p, c, pr in productos],
            }, format='json')

    def _aprobar(self, id_cotizacion):
        return self.client.post(
            f'/api/cotizaciones/{id_cotizacion}/cambiar_estado/',
            {'estado': 'aprobada'}, format='json')

    def test_aprobar_sin_stock_no_descuenta_nada(self):
        """El bug: `return Response` dentro de `transaction.atomic()` hace commit.

        Con tres repuestos donde el último no alcanza, los dos primeros quedaban
        descontados del inventario y commiteados, mientras `cargado_a_orden` no
        se guardaba. Al reintentar se descontaban otra vez.
        """
        hay = self._producto('Filtro-OK', 10)
        tambien = self._producto('Bujia-OK', 10)
        falta = self._producto('Piston-SIN', 1)

        id_servicio, tipo = self._orden_de_taller()
        r = self._presupuestar(id_servicio, tipo,
                               [(hay, 2, 100), (tambien, 3, 150), (falta, 5, 900)])
        self.assertEqual(r.status_code, 201, r.data)
        cot_id = r.data['id_cotizacion']

        r = self._aprobar(cot_id)
        self.assertEqual(r.status_code, 400)

        # Nada se movió: ni los dos que sí tenían stock.
        hay.refresh_from_db(); tambien.refresh_from_db(); falta.refresh_from_db()
        self.assertEqual(hay.cantidad_actual, 10)
        self.assertEqual(tambien.cantidad_actual, 10)
        self.assertEqual(falta.cantidad_actual, 1)

        # Ni líneas en la orden, ni movimientos de inventario.
        self.assertEqual(
            ServicioRepuesto.objects.filter(id_servicio_id=id_servicio).count(), 0)
        self.assertEqual(
            MovimientoInventario.objects.filter(
                tipo_referencia='SERVICIO_TALLER').count(), 0)

        # Y la cotización sigue pendiente, así que se puede reintentar limpio.
        cot = Cotizacion.objects.get(pk=cot_id)
        self.assertEqual(cot.estado, 'pendiente')
        self.assertFalse(cot.cargado_a_orden)

    def test_reintentar_tras_reponer_stock_descuenta_una_sola_vez(self):
        """Es la consecuencia real del bug: el doble descuento al reintentar."""
        pieza = self._producto('Cadena-Audit', 10)
        falta = self._producto('Estator-SIN', 0)

        id_servicio, tipo = self._orden_de_taller()
        r = self._presupuestar(id_servicio, tipo, [(pieza, 4, 100), (falta, 1, 500)])
        cot_id = r.data['id_cotizacion']

        self.assertEqual(self._aprobar(cot_id).status_code, 400)

        # Llega el repuesto que faltaba y se reintenta.
        falta.cantidad_actual = 5
        falta.save(update_fields=['cantidad_actual'])
        self.assertEqual(self._aprobar(cot_id).status_code, 200)

        pieza.refresh_from_db()
        # 10 − 4 = 6. Con el bug quedaba en 2 (descontado dos veces).
        self.assertEqual(pieza.cantidad_actual, 6)
        self.assertEqual(
            ServicioRepuesto.objects.filter(
                id_servicio_id=id_servicio, id_producto=pieza).count(), 1)

    def test_aprobar_con_stock_suficiente_sigue_funcionando(self):
        """El arreglo no debe romper el camino feliz."""
        pieza = self._producto('Pastillas-Audit', 20)
        id_servicio, tipo = self._orden_de_taller()
        r = self._presupuestar(id_servicio, tipo, [(pieza, 5, 120)])
        cot_id = r.data['id_cotizacion']

        self.assertEqual(self._aprobar(cot_id).status_code, 200)

        pieza.refresh_from_db()
        self.assertEqual(pieza.cantidad_actual, 15)
        cot = Cotizacion.objects.get(pk=cot_id)
        self.assertTrue(cot.cargado_a_orden)
        self.assertEqual(cot.estado, 'aprobada')

    # ==================================================================
    # #3 — Una devolución reduce lo que el cliente debe
    # ==================================================================

    def _venta_a_credito(self, producto, cantidad, precio):
        venta = OrdenVenta.objects.create(
            id_cliente=self.cliente.id_cliente, fecha=timezone.localdate(),
            total=cantidad * precio, monto_pagado=0,
            saldo_pendiente=cantidad * precio, estado_pago='pendiente')
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO producto_venta
                    (id_venta, id_producto, cantidad, precio_unitario)
                VALUES (%s, %s, %s, %s)
            """, [venta.id_venta, producto.id_producto, cantidad, precio])
        return venta

    def _devolver(self, venta, producto, cantidad, precio):
        return self.client.post('/api/devoluciones/', {
            'venta': venta.id_venta,
            'cliente': self.cliente.id_cliente,
            'fecha': str(timezone.localdate()),
            'motivo': 'Producto defectuoso',
            'detalles': [{'producto': producto.id_producto,
                          'cantidad': cantidad, 'precio_unitario': precio}],
        }, format='json')

    def test_devolver_reduce_la_deuda_del_cliente(self):
        """El bug: el stock volvía pero el cliente seguía debiendo todo.

        Es el mismo arreglo que ya tenía el lado de compras desde 1.8.0; acá
        faltaba el espejo.
        """
        producto = self._producto('Llanta-Audit', 20, venta='1000.00')
        venta = self._venta_a_credito(producto, 5, 1000)   # C$5.000 a crédito

        r = self._devolver(venta, producto, 2, 1000)       # devuelve C$2.000
        self.assertEqual(r.status_code, 201)

        venta.refresh_from_db()
        self.assertEqual(float(venta.saldo_pendiente), 3000.0)
        self.assertEqual(float(venta.total_devuelto()), 2000.0)
        self.assertEqual(venta.estado_pago, 'pendiente')

    def test_devolver_todo_lo_vendido_deja_la_deuda_en_cero(self):
        producto = self._producto('Casco-Audit', 10, venta='500.00')
        venta = self._venta_a_credito(producto, 2, 500)    # C$1.000

        self._devolver(venta, producto, 2, 500)

        venta.refresh_from_db()
        self.assertEqual(float(venta.saldo_pendiente), 0.0)
        self.assertEqual(venta.estado_pago, 'pagado')

    def test_devolver_sobre_una_venta_pagada_deja_saldo_a_favor(self):
        """Si ya había pagado, el negocio le queda debiendo al cliente."""
        producto = self._producto('Aceite-Audit', 30, venta='300.00')
        venta = self._venta_a_credito(producto, 4, 300)    # C$1.200
        PagoVenta.objects.create(id_venta=venta, monto=1200, metodo_pago='efectivo')
        venta.calcular_saldo()
        self.assertEqual(float(venta.saldo_pendiente), 0.0)

        self._devolver(venta, producto, 1, 300)            # devuelve C$300

        venta.refresh_from_db()
        # Neto 900 − pagado 1200 = −300: el negocio le debe C$300.
        self.assertEqual(float(venta.saldo_pendiente), -300.0)
        self.assertEqual(float(venta.saldo_a_favor()), 300.0)
        # Y no se muestra como deuda pendiente de cobro.
        self.assertEqual(venta.estado_pago, 'pagado')

    def test_una_devolucion_anulada_no_reduce_la_deuda(self):
        """Anular la nota de crédito devuelve la deuda a su valor original."""
        producto = self._producto('Espejo-Audit', 10, venta='200.00')
        venta = self._venta_a_credito(producto, 5, 200)    # C$1.000

        self._devolver(venta, producto, 2, 200)
        venta.refresh_from_db()
        self.assertEqual(float(venta.saldo_pendiente), 600.0)

        Devolucion.objects.filter(id_venta=venta.id_venta).update(estado='anulada')
        venta.calcular_saldo()

        venta.refresh_from_db()
        self.assertEqual(float(venta.saldo_pendiente), 1000.0)
        self.assertEqual(float(venta.total_devuelto()), 0.0)

    def test_el_detalle_de_la_venta_expone_lo_devuelto(self):
        producto = self._producto('Guaya-Audit', 10, venta='400.00')
        venta = self._venta_a_credito(producto, 3, 400)
        self._devolver(venta, producto, 1, 400)

        datos = self.client.get(f'/api/ordenes-venta/{venta.id_venta}/').json()
        self.assertEqual(datos['total_devuelto'], 400.0)
        self.assertIn('saldo_a_favor', datos)

    def test_una_devolucion_sin_venta_no_revienta(self):
        """`id_venta` es opcional: hay devoluciones sin venta asociada."""
        producto = self._producto('Suelto-Audit', 10, venta='100.00')
        r = self.client.post('/api/devoluciones/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(timezone.localdate()),
            'motivo': 'Sin venta de referencia',
            'detalles': [{'producto': producto.id_producto,
                          'cantidad': 1, 'precio_unitario': 100}],
        }, format='json')
        # El serializer exige la venta; lo que importa es que responda 400 y no 500.
        self.assertIn(r.status_code, (201, 400))

    # ==================================================================
    # #7 — Una venta no se borra ni se edita: se cancela
    # ==================================================================

    def test_no_se_puede_borrar_una_venta(self):
        """El borrado directo era el único camino sin rastro: no devolvía stock,
        no dejaba movimiento y no lo cubre el disparador de auditoría."""
        producto = self._producto('Borrable-Audit', 10, venta='100.00')
        venta = self._venta_a_credito(producto, 2, 100)

        r = self.client.delete(f'/api/ordenes-venta/{venta.id_venta}/')

        self.assertEqual(r.status_code, 405)
        self.assertIn('cancelar', r.json()['error'])
        self.assertTrue(OrdenVenta.objects.filter(pk=venta.id_venta).exists())

    def test_el_operador_tampoco_puede_borrar_una_venta(self):
        producto = self._producto('NoBorrable-Audit', 10, venta='100.00')
        venta = self._venta_a_credito(producto, 2, 100)

        self.client.force_authenticate(user=self.operador)
        r = self.client.delete(f'/api/ordenes-venta/{venta.id_venta}/')

        self.assertEqual(r.status_code, 405)
        self.assertTrue(OrdenVenta.objects.filter(pk=venta.id_venta).exists())

    def test_no_se_puede_editar_una_venta_registrada(self):
        """Antes daba 500 porque el serializer no implementa `update()`."""
        producto = self._producto('NoEditable-Audit', 10, venta='100.00')
        venta = self._venta_a_credito(producto, 2, 100)

        r = self.client.put(f'/api/ordenes-venta/{venta.id_venta}/',
                            {'total': 1}, format='json')
        self.assertEqual(r.status_code, 405)

        r = self.client.patch(f'/api/ordenes-venta/{venta.id_venta}/',
                              {'total': 1}, format='json')
        self.assertEqual(r.status_code, 405)

    def test_anular_un_pago_sigue_funcionando(self):
        """El método DELETE del ViewSet no se deshabilitó: lo usa la subruta de
        pagos, y bloquearlo habría roto la anulación de un abono."""
        producto = self._producto('ConPago-Audit', 10, venta='500.00')
        venta = self._venta_a_credito(producto, 2, 500)
        pago = PagoVenta.objects.create(id_venta=venta, monto=200, metodo_pago='transferencia')

        r = self.client.delete(
            f'/api/ordenes-venta/{venta.id_venta}/pagos/{pago.id_pago}/')

        self.assertIn(r.status_code, (200, 204))
        self.assertFalse(PagoVenta.objects.filter(pk=pago.id_pago).exists())

    # ==================================================================
    # #8 — El costo de compra es dato de dueño
    # ==================================================================

    def test_el_operador_no_ve_el_costo_en_el_listado(self):
        """Con el costo y el precio de venta juntos, un vendedor calculaba el
        margen de cada producto en una hoja de cálculo."""
        self._producto('Costoso-Audit', 10, costo=750, venta='1500.00')

        self.client.force_authenticate(user=self.operador)
        datos = self.client.get('/api/productos/').json()
        filas = datos['results'] if isinstance(datos, dict) else datos

        self.assertTrue(filas)
        for fila in filas:
            self.assertIsNone(fila['precio_compra_unitario'])
            # El precio de venta sí lo necesita para vender.
            self.assertIsNotNone(fila['precio_final'])
        self.assertNotIn('750', self.client.get('/api/productos/').content.decode())

    def test_el_admin_si_ve_el_costo(self):
        self._producto('Visible-Audit', 10, costo=750, venta='1500.00')
        datos = self.client.get('/api/productos/').json()
        filas = datos['results'] if isinstance(datos, dict) else datos
        self.assertEqual(float(filas[0]['precio_compra_unitario']), 750.0)

    def test_el_operador_no_ve_el_costo_en_el_detalle(self):
        producto = self._producto('Detalle-Audit', 10, costo=333, venta='900.00')

        self.client.force_authenticate(user=self.operador)
        r = self.client.get(f'/api/productos/{producto.id_producto}/')

        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()['precio_compra_unitario'])
        self.assertNotIn('333', r.content.decode())

    def test_el_costo_tampoco_se_filtra_por_los_productos_de_un_proveedor(self):
        """Estos dos endpoints armaban el serializer sin `context`, así que el
        filtro por rol no se aplicaba y el costo salía igual."""
        self._producto('PorProveedor-Audit', 10, costo=444, venta='800.00')

        self.client.force_authenticate(user=self.operador)
        r = self.client.get(f'/api/proveedores/{self.proveedor.id_proveedor}/productos/')

        self.assertEqual(r.status_code, 200)
        self.assertNotIn('444', r.content.decode())
        for fila in r.json():
            self.assertIsNone(fila['precio_compra_unitario'])

    def test_el_costo_tampoco_se_filtra_por_los_productos_de_una_ubicacion(self):
        ubicacion = Ubicacion.objects.create(bodega='Principal', pasillo='1')
        producto = self._producto('PorUbicacion-Audit', 10, costo=555, venta='900.00')
        producto.id_ubicacion = ubicacion
        producto.save(update_fields=['id_ubicacion'])

        self.client.force_authenticate(user=self.operador)
        r = self.client.get(f'/api/ubicaciones/{ubicacion.id_ubicacion}/productos/')

        self.assertEqual(r.status_code, 200)
        self.assertNotIn('555', r.content.decode())

    def test_los_precios_historicos_de_proveedores_son_solo_de_admin(self):
        """Devuelve costos de compra: dejarlo abierto anulaba todo lo anterior."""
        producto = self._producto('Historico-Audit', 10, costo=600)

        self.client.force_authenticate(user=self.operador)
        r = self.client.get(
            f'/api/productos/{producto.id_producto}/precios-proveedores/')
        self.assertEqual(r.status_code, 403)

        self.client.force_authenticate(user=self.admin)
        r = self.client.get(
            f'/api/productos/{producto.id_producto}/precios-proveedores/')
        self.assertEqual(r.status_code, 200)


class ConfiguracionSeguraTestCase(TestCase):
    """#6 y #10: las dos fugas silenciosas de configuración."""

    def test_los_respaldos_no_entran_en_la_imagen_docker(self):
        """El Dockerfile hace `COPY . .`: sin excluirlos, los volcados locales
        (clientes, empleados con salario, costos) quedan dentro de la imagen y
        los ve cualquiera que pueda inspeccionar sus capas."""
        raiz = Path(settings.BASE_DIR)
        reglas = (raiz / '.dockerignore').read_text(encoding='utf-8').splitlines()
        reglas = [r.strip() for r in reglas if r.strip() and not r.startswith('#')]

        self.assertIn('backups/', reglas)
        self.assertIn('*.dump', reglas)
        # El respaldo cifrado que se sube al bucket tampoco.
        self.assertIn('*.dump.enc', reglas)

    def test_debug_falla_cerrado_si_nadie_lo_define(self):
        """Antes el default era True, así que una variable ausente o mal escrita
        apagaba en silencio las cookies seguras, HSTS y —lo peor— también los
        chequeos que abortan el arranque sin SECRET_KEY, porque viven dentro del
        mismo `if not DEBUG`."""
        ruta = Path(settings.BASE_DIR) / 'inventrix' / 'settings.py'
        codigo = ruta.read_text(encoding='utf-8')

        self.assertIn("os.getenv('DEBUG', 'False')", codigo)
        self.assertNotIn("os.getenv('DEBUG', 'True')", codigo)


class ConvertirCotizacionTestCase(APITestCase):
    """#2 — Convertir una cotización en venta tiene que mover el inventario.

    Antes insertaba la venta y sus líneas y nada más: la mercadería salía del
    local y el sistema seguía contándola. Tampoco comprobaba que hubiera stock,
    así que se podía "vender" con existencia cero.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_conv', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Conv')
        self.cliente = Cliente.objects.create(nombre='Cliente Conv')

    def _producto(self, nombre, stock, venta='200.00'):
        return Producto.objects.create(
            sku_producto=f'SKU-{nombre}', nombre=nombre,
            cantidad_actual=stock, cantidad_total=stock, cantidad_minima=1,
            precio_compra_unitario=100, precio_final=venta,
            id_proveedor=self.proveedor)

    def _cotizacion(self, lineas):
        """`lineas` es [(producto, cantidad, precio)]."""
        cot = Cotizacion.objects.create(
            id_cliente=self.cliente.id_cliente, fecha=timezone.localdate(),
            tipo='venta', estado='pendiente', total=0)
        with connection.cursor() as c:
            for producto, cantidad, precio in lineas:
                c.execute("""
                    INSERT INTO producto_cotizacion
                        (id_cotizacion, id_producto, cantidad, precio_unitario)
                    VALUES (%s, %s, %s, %s)
                """, [cot.id_cotizacion, producto.id_producto, cantidad, precio])
        return cot

    def _convertir(self, cot):
        return self.client.post(
            f'/api/cotizaciones/{cot.id_cotizacion}/convertir-venta/')

    def test_convertir_descuenta_el_stock(self):
        producto = self._producto('Filtro-Conv', 20)
        cot = self._cotizacion([(producto, 5, 200)])

        r = self._convertir(cot)

        self.assertEqual(r.status_code, 201, r.data)
        producto.refresh_from_db()
        self.assertEqual(producto.cantidad_actual, 15)

    def test_convertir_deja_el_movimiento_de_inventario(self):
        """Sin el movimiento no hay forma de auditar por qué bajó el stock."""
        producto = self._producto('Bujia-Conv', 10)
        cot = self._cotizacion([(producto, 3, 150)])

        r = self._convertir(cot)
        id_venta = r.data['id_venta']

        movimiento = MovimientoInventario.objects.get(
            referencia=f'VENTA-{id_venta}')
        self.assertEqual(movimiento.tipo, 'SALIDA')
        self.assertEqual(movimiento.cantidad, 3)
        self.assertEqual(movimiento.tipo_referencia, 'ORDEN_VENTA')

    def test_no_se_puede_convertir_sin_stock_suficiente(self):
        producto = self._producto('Escaso-Conv', 2)
        cot = self._cotizacion([(producto, 5, 200)])

        r = self._convertir(cot)

        self.assertEqual(r.status_code, 400)
        # Nada quedó a medias: ni venta, ni stock movido, ni estado cambiado.
        producto.refresh_from_db()
        self.assertEqual(producto.cantidad_actual, 2)
        cot.refresh_from_db()
        self.assertEqual(cot.estado, 'pendiente')
        self.assertIsNone(cot.id_venta)
        self.assertEqual(OrdenVenta.objects.count(), 0)

    def test_si_falla_una_linea_no_se_descuenta_ninguna(self):
        """La conversión es todo o nada."""
        alcanza = self._producto('Alcanza-Conv', 50)
        no_alcanza = self._producto('NoAlcanza-Conv', 1)
        cot = self._cotizacion([(alcanza, 10, 200), (no_alcanza, 5, 300)])

        r = self._convertir(cot)

        self.assertEqual(r.status_code, 400)
        alcanza.refresh_from_db(); no_alcanza.refresh_from_db()
        self.assertEqual(alcanza.cantidad_actual, 50)
        self.assertEqual(no_alcanza.cantidad_actual, 1)
        self.assertEqual(MovimientoInventario.objects.count(), 0)

    def test_el_mismo_producto_repetido_se_valida_contra_la_suma(self):
        """Dos líneas de 3 sobre un stock de 5: cada línea pasa sola, la suma no."""
        producto = self._producto('Repetido-Conv', 5)
        cot = self._cotizacion([(producto, 3, 200), (producto, 3, 200)])

        r = self._convertir(cot)

        self.assertEqual(r.status_code, 400)
        producto.refresh_from_db()
        self.assertEqual(producto.cantidad_actual, 5)

    def test_el_mismo_producto_repetido_descuenta_la_suma(self):
        producto = self._producto('Suma-Conv', 20)
        cot = self._cotizacion([(producto, 4, 200), (producto, 6, 200)])

        r = self._convertir(cot)

        self.assertEqual(r.status_code, 201, r.data)
        producto.refresh_from_db()
        self.assertEqual(producto.cantidad_actual, 10)
        # Un solo movimiento con la cantidad agregada, no dos.
        movimientos = MovimientoInventario.objects.filter(
            referencia=f'VENTA-{r.data["id_venta"]}')
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos.first().cantidad, 10)

    def test_el_total_se_calcula_con_decimales_exactos(self):
        """Con `float` el total quedaba con centavos que no cuadraban."""
        producto = self._producto('Centavos-Conv', 100, venta='10.10')
        cot = self._cotizacion([(producto, 3, '10.10')])

        r = self._convertir(cot)

        venta = OrdenVenta.objects.get(pk=r.data['id_venta'])
        self.assertEqual(venta.total, Decimal('30.30'))
        self.assertEqual(venta.saldo_pendiente, Decimal('30.30'))

    def test_convertir_dos_veces_se_rechaza(self):
        producto = self._producto('Doble-Conv', 20)
        cot = self._cotizacion([(producto, 2, 200)])

        self.assertEqual(self._convertir(cot).status_code, 201)
        self.assertEqual(self._convertir(cot).status_code, 400)

        producto.refresh_from_db()
        # Descontado una sola vez.
        self.assertEqual(producto.cantidad_actual, 18)

    def test_una_cotizacion_sin_productos_se_rechaza(self):
        cot = self._cotizacion([])
        self.assertEqual(self._convertir(cot).status_code, 400)


class ReembolsoDevolucionCompraTestCase(APITestCase):
    """#4 — El reembolso de una devolución a proveedor tiene un tope.

    Sin tope, una devolución de C$500 aceptaba un reembolso de C$50.000: inflaba
    el efectivo esperado de la caja y habilitaba pagarle al proveedor mucho más
    de lo que se le debía.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_reemb', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Reemb')
        self.producto = Producto.objects.create(
            sku_producto='SKU-REEMB', nombre='Repuesto Reembolso',
            cantidad_actual=20, cantidad_total=20, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='200.00',
            id_proveedor=self.proveedor)

        # Compra recibida de 10 unidades a C$100 = C$1.000.
        self.orden = OrdenCompra.objects.create(
            id_proveedor=self.proveedor.id_proveedor,
            id_estado=OrdenCompra.ESTADO_RECIBIDA,
            fecha_creacion=timezone.localdate(),
            fecha_recepcion=timezone.now(), stock_aplicado=True)
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO orden_producto
                    (id_orden, id_producto, cantidad, precio_unitario)
                VALUES (%s, %s, 10, 100)
            """, [self.orden.id_orden, self.producto.id_producto])

    def _devolver(self, cantidad, reembolso, metodo='credito'):
        return self.client.post('/api/devoluciones-compra/', {
            'orden': self.orden.id_orden,
            'motivo': 'Mercadería defectuosa',
            'reembolso': reembolso,
            'metodo_reembolso': metodo,
            'detalles': [{'producto': self.producto.id_producto,
                          'cantidad': cantidad}],
        }, format='json')

    def test_un_reembolso_mayor_a_lo_devuelto_se_rechaza(self):
        # Devuelve 5 × C$100 = C$500, pero pide C$50.000 de reembolso.
        r = self._devolver(5, 50000)

        self.assertEqual(r.status_code, 400)
        self.assertIn('reembolso', r.json()['error']['details'])
        self.assertEqual(DevolucionCompra.objects.count(), 0)

    def test_un_reembolso_negativo_se_rechaza(self):
        r = self._devolver(5, -100)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(DevolucionCompra.objects.count(), 0)

    def test_un_reembolso_igual_a_lo_devuelto_se_acepta(self):
        """El tope es el valor devuelto, no menos: el proveedor puede devolver
        todo."""
        r = self._devolver(5, 500)

        self.assertEqual(r.status_code, 201, r.data)
        devolucion = DevolucionCompra.objects.get()
        self.assertEqual(devolucion.total, Decimal('500'))
        self.assertEqual(devolucion.reembolso, Decimal('500'))

    def test_un_reembolso_parcial_se_acepta(self):
        r = self._devolver(5, 200)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(DevolucionCompra.objects.get().reembolso, Decimal('200'))

    def test_sin_reembolso_sigue_funcionando(self):
        r = self._devolver(3, 0)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(DevolucionCompra.objects.get().reembolso, Decimal('0'))

    def test_el_tope_no_deja_inflar_el_efectivo_esperado_de_la_caja(self):
        """Era la consecuencia concreta: un arqueo con faltante inexplicable."""
        sesion = SesionCaja.objects.create(usuario=self.admin, monto_apertura=1000)
        esperado_antes = sesion.calcular_esperado()

        r = self._devolver(5, 50000, metodo='efectivo')
        self.assertEqual(r.status_code, 400)

        sesion.refresh_from_db()
        self.assertEqual(sesion.calcular_esperado(), esperado_antes)


class CajaAislamientoTestCase(APITestCase):
    """#9 — Un operador solo toca su propio turno de caja.

    `list` y `retrieve` estaban reservados a admin por ser datos financieros,
    pero las acciones caían en `IsAuthenticated` y con eso se salteaba ese
    criterio: cualquier operador leía los movimientos de cualquier turno
    histórico y podía cerrarle el arqueo a otra persona.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='dueno_caja', password='x', is_staff=True)
        self.cajero = User.objects.create_user(username='cajero_a', password='x')
        self.otro = User.objects.create_user(username='cajero_b', password='x')

        # Turno cerrado del cajero A, con un movimiento.
        self.turno_ajeno = SesionCaja.objects.create(
            usuario=self.cajero, monto_apertura=500, estado='cerrada',
            monto_cierre_contado=800, monto_esperado=800, diferencia=0)
        MovimientoCaja.objects.create(
            sesion=self.turno_ajeno, tipo='ingreso', monto=300,
            motivo='Venta en efectivo del turno anterior', usuario=self.cajero)

    def test_el_operador_no_lee_los_movimientos_de_un_turno_ajeno(self):
        self.client.force_authenticate(user=self.otro)
        r = self.client.get(f'/api/caja/{self.turno_ajeno.id_sesion}/movimientos/')

        self.assertEqual(r.status_code, 403)
        # Y el motivo del movimiento no se filtró en la respuesta.
        self.assertNotIn('turno anterior', r.content.decode())

    def test_el_operador_si_lee_los_movimientos_de_su_propio_turno(self):
        self.client.force_authenticate(user=self.cajero)
        r = self.client.get(f'/api/caja/{self.turno_ajeno.id_sesion}/movimientos/')

        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 1)

    def test_el_admin_lee_los_movimientos_de_cualquier_turno(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/caja/{self.turno_ajeno.id_sesion}/movimientos/')
        self.assertEqual(r.status_code, 200)

    def test_el_operador_no_puede_cerrar_el_turno_de_otro(self):
        """Cerrar un turno es firmar un arqueo: no se firma el de otra persona."""
        turno = SesionCaja.objects.create(
            usuario=self.cajero, monto_apertura=1000, estado='abierta')

        self.client.force_authenticate(user=self.otro)
        r = self.client.post(f'/api/caja/{turno.id_sesion}/cerrar/',
                             {'monto_cierre_contado': 1000}, format='json')

        self.assertEqual(r.status_code, 403)
        turno.refresh_from_db()
        self.assertEqual(turno.estado, 'abierta')

    def test_el_operador_si_puede_cerrar_su_propio_turno(self):
        turno = SesionCaja.objects.create(
            usuario=self.cajero, monto_apertura=1000, estado='abierta')

        self.client.force_authenticate(user=self.cajero)
        r = self.client.post(f'/api/caja/{turno.id_sesion}/cerrar/',
                             {'monto_cierre_contado': 1000}, format='json')

        self.assertEqual(r.status_code, 200, r.data)
        turno.refresh_from_db()
        self.assertEqual(turno.estado, 'cerrada')

    def test_el_admin_puede_cerrar_el_turno_de_cualquiera(self):
        """El dueño tiene que poder cerrar una caja que alguien dejó abierta."""
        turno = SesionCaja.objects.create(
            usuario=self.cajero, monto_apertura=1000, estado='abierta')

        self.client.force_authenticate(user=self.admin)
        r = self.client.post(f'/api/caja/{turno.id_sesion}/cerrar/',
                             {'monto_cierre_contado': 1000}, format='json')

        self.assertEqual(r.status_code, 200, r.data)

    def test_el_operador_no_registra_movimientos_en_un_turno_ajeno(self):
        turno = SesionCaja.objects.create(
            usuario=self.cajero, monto_apertura=1000, estado='abierta')

        self.client.force_authenticate(user=self.otro)
        r = self.client.post(f'/api/caja/{turno.id_sesion}/movimientos/',
                             {'tipo': 'retiro', 'monto': 500,
                              'motivo': 'Retiro no autorizado'}, format='json')

        self.assertEqual(r.status_code, 403)
        self.assertEqual(turno.movimientos.count(), 0)

    def test_el_historial_de_turnos_sigue_siendo_solo_de_admin(self):
        self.client.force_authenticate(user=self.otro)
        self.assertEqual(self.client.get('/api/caja/').status_code, 403)
        self.assertEqual(
            self.client.get(f'/api/caja/{self.turno_ajeno.id_sesion}/').status_code,
            403)

    def test_abrir_y_ver_la_caja_actual_siguen_disponibles_para_el_operador(self):
        """El operador tiene que poder trabajar: abrir su turno y consultarlo."""
        self.client.force_authenticate(user=self.otro)

        r = self.client.post('/api/caja/abrir/', {'monto_apertura': 500},
                             format='json')
        self.assertEqual(r.status_code, 201, r.data)

        r = self.client.get('/api/caja/actual/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['usuario_nombre'], 'cajero_b')


class ReporteComprasTestCase(APITestCase):
    """#5 — El total de compras tiene que ser lo que se pagó de verdad.

    Usaba `SUM(p.precio_compra_unitario)`: el costo actual del catálogo sumado
    una vez por línea, ignorando la cantidad y el precio pactado. Comprar 50
    filtros a C$80 sumaba C$95 (el costo de hoy, una vez) en lugar de C$4.000. El
    número salía plausible y no significaba nada.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_rep_compras', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Reporte')
        self.hoy = timezone.localdate()

    def _producto(self, nombre, costo_catalogo):
        return Producto.objects.create(
            sku_producto=f'SKU-{nombre}', nombre=nombre,
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=costo_catalogo, precio_final='500.00',
            id_proveedor=self.proveedor)

    def _compra(self, lineas, estado=OrdenCompra.ESTADO_RECIBIDA):
        """`lineas` es [(producto, cantidad, precio_pactado)]. None = sin importes."""
        orden = OrdenCompra.objects.create(
            id_proveedor=self.proveedor.id_proveedor, id_estado=estado,
            fecha_creacion=self.hoy)
        with connection.cursor() as c:
            for producto, cantidad, precio in lineas:
                c.execute("""
                    INSERT INTO orden_producto
                        (id_orden, id_producto, cantidad, precio_unitario)
                    VALUES (%s, %s, %s, %s)
                """, [orden.id_orden, producto.id_producto, cantidad, precio])
        return orden

    def _reporte(self):
        r = self.client.get('/api/reportes/compras/', {
            'fecha_inicio': str(self.hoy - datetime.timedelta(days=1)),
            'fecha_fin': str(self.hoy + datetime.timedelta(days=1)),
        })
        self.assertEqual(r.status_code, 200)
        return r.json()

    def test_el_total_usa_cantidad_por_precio_pactado(self):
        """50 × C$80 = C$4.000, no el costo del catálogo."""
        producto = self._producto('Filtro-Rep', costo_catalogo=95)
        self._compra([(producto, 50, 80)])

        datos = self._reporte()

        self.assertEqual(datos['total_compras'], 4000.0)
        # Con la fórmula vieja habría dado 95: el costo de hoy, una sola vez.
        self.assertNotEqual(datos['total_compras'], 95.0)

    def test_el_total_no_cambia_si_cambia_el_costo_del_catalogo(self):
        """Es el punto: una compra pasada vale lo que se pagó entonces."""
        producto = self._producto('Bujia-Rep', costo_catalogo=100)
        self._compra([(producto, 10, 60)])

        antes = self._reporte()['total_compras']

        producto.precio_compra_unitario = 999
        producto.save(update_fields=['precio_compra_unitario'])

        self.assertEqual(self._reporte()['total_compras'], antes)
        self.assertEqual(antes, 600.0)

    def test_suma_todas_las_lineas_de_la_orden(self):
        uno = self._producto('Uno-Rep', 10)
        dos = self._producto('Dos-Rep', 20)
        self._compra([(uno, 3, 100), (dos, 2, 250)])

        # 3×100 + 2×250 = 800
        self.assertEqual(self._reporte()['total_compras'], 800.0)

    def test_las_ordenes_canceladas_no_suman_al_total(self):
        """No se compró nada ahí."""
        producto = self._producto('Cancelada-Rep', 50)
        self._compra([(producto, 10, 100)])
        self._compra([(producto, 99, 100)], estado=OrdenCompra.ESTADO_CANCELADA)

        datos = self._reporte()

        self.assertEqual(datos['total_compras'], 1000.0)
        self.assertEqual(datos['numero_ordenes'], 1)

    def test_las_canceladas_si_aparecen_en_el_listado(self):
        """Saber que una compra se canceló es información útil."""
        producto = self._producto('EnListado-Rep', 50)
        self._compra([(producto, 5, 100)])
        self._compra([(producto, 5, 100)], estado=OrdenCompra.ESTADO_CANCELADA)

        estados = [o['estado'] for o in self._reporte()['ordenes']]
        self.assertIn('cancelada', estados)
        self.assertIn('recibida', estados)

    def test_el_promedio_se_calcula_sobre_el_total_corregido(self):
        producto = self._producto('Promedio-Rep', 10)
        self._compra([(producto, 5, 200)])    # 1000
        self._compra([(producto, 5, 100)])    # 500

        datos = self._reporte()
        self.assertEqual(datos['total_compras'], 1500.0)
        self.assertEqual(datos['compra_promedio'], 750.0)

    def test_el_total_por_proveedor_tambien_esta_corregido(self):
        producto = self._producto('PorProv-Rep', 10)
        self._compra([(producto, 4, 250)])

        por_proveedor = self._reporte()['por_proveedor']
        self.assertEqual(len(por_proveedor), 1)
        self.assertEqual(por_proveedor[0]['total'], 1000.0)

    def test_las_ordenes_sin_importes_se_declaran(self):
        """Una orden vieja sin cantidad ni precio no puede aportar al total.

        Se informa para que un total bajo se entienda, en vez de parecer un error
        del reporte: es exactamente el caso de las compras que hay en la base,
        creadas antes de que `orden_producto` guardara esos datos.
        """
        producto = self._producto('SinImportes-Rep', 70)
        self._compra([(producto, None, None)])

        datos = self._reporte()

        self.assertEqual(datos['total_compras'], 0.0)
        self.assertEqual(datos['ordenes_sin_importes'], 1)

    def test_una_orden_con_importes_no_cuenta_como_incompleta(self):
        producto = self._producto('Completa-Rep', 70)
        self._compra([(producto, 2, 300)])

        datos = self._reporte()
        self.assertEqual(datos['total_compras'], 600.0)
        self.assertEqual(datos['ordenes_sin_importes'], 0)

    def test_el_total_coincide_con_calcular_total_del_modelo(self):
        """Las dos formas de calcular lo mismo tienen que dar lo mismo.

        La incoherencia entre reporte y modelo era el síntoma que delató el bug.
        """
        producto = self._producto('Coincide-Rep', 10)
        orden = self._compra([(producto, 7, 130)])

        self.assertEqual(self._reporte()['total_compras'],
                         float(orden.calcular_total()))

    def test_el_operador_no_ve_el_reporte(self):
        User = get_user_model()
        operador = User.objects.create_user(username='vend_rep', password='x')
        self.client.force_authenticate(user=operador)
        r = self.client.get('/api/reportes/compras/', {
            'fecha_inicio': str(self.hoy), 'fecha_fin': str(self.hoy)})
        self.assertEqual(r.status_code, 403)


class OrdenCompraFinanzasPorRolTestCase(APITestCase):
    """#8 (segunda parte) — Lo que se le debe a un proveedor es del dueño.

    La pantalla de órdenes de compra la usan los vendedores para saber qué
    mercadería viene en camino, así que se mantiene accesible: lo que se reserva
    son los números, no la información operativa.
    """

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_oc_rol', password='x', is_staff=True)
        self.operador = User.objects.create_user(username='vend_oc_rol', password='x')

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Rol')
        self.producto = Producto.objects.create(
            sku_producto='SKU-OC-ROL', nombre='Repuesto Rol',
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='300.00',
            id_proveedor=self.proveedor)

        self.orden = OrdenCompra.objects.create(
            id_proveedor=self.proveedor.id_proveedor,
            id_estado=OrdenCompra.ESTADO_PENDIENTE,
            fecha_creacion=timezone.localdate())
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO orden_producto
                    (id_orden, id_producto, cantidad, precio_unitario)
                VALUES (%s, %s, 8, 777)
            """, [self.orden.id_orden, self.producto.id_producto])
        self.orden.calcular_saldo()

    def test_el_operador_no_ve_los_montos_en_el_listado(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.get('/api/ordenes-compra/')

        datos = r.json()
        filas = datos['results'] if isinstance(datos, dict) else datos
        fila = next(f for f in filas if f['id_orden'] == self.orden.id_orden)

        for campo in ('total', 'monto_pagado', 'saldo_pendiente', 'estado_pago'):
            self.assertIsNone(fila[campo], campo)
        # Y el precio pactado no se cuela por ningún lado de la respuesta.
        self.assertNotIn('777', r.content.decode())

    def test_el_operador_si_ve_lo_operativo_en_el_listado(self):
        """Sin esto le sacaríamos la razón de usar la pantalla."""
        self.client.force_authenticate(user=self.operador)
        datos = self.client.get('/api/ordenes-compra/').json()
        filas = datos['results'] if isinstance(datos, dict) else datos
        fila = next(f for f in filas if f['id_orden'] == self.orden.id_orden)

        self.assertEqual(fila['proveedor_nombre'], 'Prov Rol')
        self.assertEqual(fila['estado'], 'pendiente')
        self.assertIsNotNone(fila['fecha_creacion'])
        self.assertIn('stock_aplicado', fila)

    def test_el_admin_si_ve_los_montos(self):
        self.client.force_authenticate(user=self.admin)
        datos = self.client.get('/api/ordenes-compra/').json()
        filas = datos['results'] if isinstance(datos, dict) else datos
        fila = next(f for f in filas if f['id_orden'] == self.orden.id_orden)

        # 8 × 777 = 6216
        self.assertEqual(float(fila['total']), 6216.0)
        self.assertIsNotNone(fila['saldo_pendiente'])
        self.assertIsNotNone(fila['estado_pago'])

    def test_el_operador_no_ve_los_precios_de_las_lineas_en_el_detalle(self):
        """Van dentro de un SerializerMethodField, así que el mixin no los
        alcanza: se filtran aparte y sin eso el costo se escapaba por acá."""
        self.client.force_authenticate(user=self.operador)
        r = self.client.get(f'/api/ordenes-compra/{self.orden.id_orden}/')

        self.assertEqual(r.status_code, 200)
        self.assertNotIn('777', r.content.decode())

        datos = r.json()
        self.assertIsNone(datos['total'])
        for linea in datos['productos']:
            self.assertIsNone(linea['precio_unitario'])
            self.assertIsNone(linea['precio_compra'])
            self.assertIsNone(linea['subtotal'])
            # La cantidad y el producto sí: es lo que viene en camino.
            self.assertEqual(linea['cantidad'], 8)
            self.assertEqual(linea['nombre'], 'Repuesto Rol')

    def test_el_admin_si_ve_los_precios_de_las_lineas(self):
        self.client.force_authenticate(user=self.admin)
        datos = self.client.get(
            f'/api/ordenes-compra/{self.orden.id_orden}/').json()

        linea = datos['productos'][0]
        self.assertEqual(float(linea['precio_unitario']), 777.0)
        self.assertEqual(float(linea['subtotal']), 6216.0)
        self.assertEqual(float(datos['total']), 6216.0)

    def test_todos_los_campos_de_dinero_del_detalle_quedan_cubiertos(self):
        """Guarda contra el olvido: si mañana se agrega un campo financiero al
        serializer y no a `CAMPOS_SOLO_ADMIN`, esta prueba lo detecta."""
        self.client.force_authenticate(user=self.operador)
        datos = self.client.get(
            f'/api/ordenes-compra/{self.orden.id_orden}/').json()

        financieros = ('total', 'subtotal', 'monto_pagado', 'saldo_pendiente',
                       'estado_pago', 'total_devuelto', 'saldo_a_favor')
        for campo in financieros:
            self.assertIn(campo, datos, f'{campo} desapareció del serializer')
            self.assertIsNone(datos[campo], f'{campo} se está filtrando')


class ActualizacionesPublicasTestCase(APITestCase):
    """Los dos endpoints de la 1.12.0 son la única superficie sin autenticación
    del sistema, y se habían enviado sin ninguna prueba."""

    def setUp(self):
        cache.clear()
        self.release = {
            'tag_name': 'v1.2.3',
            'body': 'notas',
            'published_at': '2026-01-01T00:00:00Z',
            'assets': [{'name': 'Inventrix.exe', 'size': 10,
                        'url': 'https://api.github.com/x/assets/1'}],
        }

    def tearDown(self):
        cache.clear()

    def _con_github(self, respuesta):
        return patch('api.actualizaciones_views._pedir_a_github',
                     return_value=(respuesta, None))

    def test_sin_configurar_no_dice_que_variables_faltan(self):
        """El detalle va al log: nombrar las variables de entorno le confirma a
        cualquiera cómo se configura el servidor."""
        with self.settings(GITHUB_DESKTOP_TOKEN='', GITHUB_DESKTOP_REPO=''):
            r = self.client.get('/api/desktop/version/')

        self.assertEqual(r.status_code, 503)
        cuerpo = r.content.decode()
        self.assertNotIn('GITHUB_DESKTOP_TOKEN', cuerpo)
        self.assertNotIn('GITHUB_DESKTOP_REPO', cuerpo)

    def test_la_version_se_cachea_y_no_vuelve_a_pegarle_a_github(self):
        with self._con_github(self.release) as espia:
            self.client.get('/api/desktop/version/')
            self.client.get('/api/desktop/version/')
            self.client.get('/api/desktop/version/')

        # Una sola llamada saliente pese a las tres peticiones entrantes.
        self.assertEqual(espia.call_count, 1)

    def test_la_descarga_no_le_pega_a_github_en_cada_peticion(self):
        """Era el agujero: sin caché, cualquiera podía agotar la cuota del token
        y ocupar un worker de Gunicorn por petición, sin credenciales."""
        cache.set(CACHE_CLAVE_DESCARGA,
                  'https://objects.githubusercontent.com/x', 300)

        with self._con_github(self.release) as espia:
            r = self.client.get('/api/desktop/descargar/')

        self.assertEqual(r.status_code, 302)
        self.assertEqual(espia.call_count, 0)

    def test_solo_se_redirige_a_github_por_https(self):
        for malo in ('http://objects.githubusercontent.com/x',
                     'https://evil.example.com/payload.exe',
                     'https://github.com.evil.example/x',
                     'javascript:alert(1)', ''):
            self.assertFalse(_destino_confiable(malo), malo)

        for bueno in ('https://objects.githubusercontent.com/x',
                      'https://github.com/org/repo/releases/download/v1/a.exe',
                      'https://release-assets.githubusercontent.com/x'):
            self.assertTrue(_destino_confiable(bueno), bueno)


class IdentidadDetrasDelProxyTestCase(TestCase):
    """X-Forwarded-For lo manda el cliente y el proxy sólo le añade al final.
    Leer la primera entrada dejaba falsear la IP: con eso se estrenaba un balde
    de throttle nuevo en cada petición (saltándose los 5/min del login) y se
    escribían IPs inventadas en la auditoría."""

    def test_drf_identifica_al_cliente_con_lo_que_agrego_el_proxy(self):
        from rest_framework.throttling import BaseThrottle
        from django.test import RequestFactory

        pedido = RequestFactory().get('/', HTTP_X_FORWARDED_FOR='1.2.3.4, 9.9.9.9')
        self.assertEqual(BaseThrottle().get_ident(pedido), '9.9.9.9')

    def test_dos_valores_falseados_caen_en_el_mismo_balde(self):
        from rest_framework.throttling import BaseThrottle
        from django.test import RequestFactory

        fabrica = RequestFactory()
        uno = fabrica.get('/', HTTP_X_FORWARDED_FOR='1.1.1.1, 9.9.9.9')
        otro = fabrica.get('/', HTTP_X_FORWARDED_FOR='2.2.2.2, 9.9.9.9')

        self.assertEqual(BaseThrottle().get_ident(uno),
                         BaseThrottle().get_ident(otro))

    def test_la_auditoria_registra_la_ip_que_vio_el_proxy(self):
        from django.test import RequestFactory
        from .middleware import AuditoriaUsuarioMiddleware

        medio = AuditoriaUsuarioMiddleware(lambda r: None)
        pedido = RequestFactory().get('/', HTTP_X_FORWARDED_FOR='1.2.3.4, 9.9.9.9')

        self.assertEqual(medio._resolver_ip(pedido), '9.9.9.9')


class SaneamientoNotasReleaseTestCase(TestCase):
    """El body del release sale de un CHANGELOG que narra en detalle qué
    vulnerabilidad se arregló y cómo — justo lo que necesita alguien que
    quiera atacar instalaciones que no se hayan actualizado todavía."""

    def test_descarta_la_seccion_de_seguridad_entera(self):
        cuerpo = (
            "### Fixed\n"
            "- Se corrigio un calculo del reporte de compras.\n\n"
            "### Security\n"
            "- Lo que se le debe a un proveedor ya no se le muestra a los "
            "vendedores.\n"
        )
        resultado = _sanear_notas(cuerpo)

        self.assertIn('Fixed', resultado)
        self.assertIn('reporte de compras', resultado)
        self.assertNotIn('Security', resultado)
        self.assertNotIn('proveedor', resultado)

    def test_descarta_lineas_sensibles_sin_encabezado_propio(self):
        """El 1.11.3 real no metió el resumen de la auditoría bajo un
        encabezado "Security": iba como texto introductorio suelto."""
        cuerpo = "Ultima tanda de la auditoria: con esto quedan cerrados los 10 hallazgos.\n"
        self.assertEqual(_sanear_notas(cuerpo), 'Mejoras y correcciones.')

    def test_notas_inofensivas_pasan_intactas(self):
        cuerpo = "### Added\n- Se agrego un reporte de pronostico de demanda.\n"
        self.assertIn('pronostico de demanda', _sanear_notas(cuerpo))

    def test_vacio_devuelve_vacio(self):
        self.assertEqual(_sanear_notas(''), '')

    def test_todo_filtrado_devuelve_mensaje_generico(self):
        cuerpo = "### Security\n- credenciales expuestas por un token filtrado.\n"
        self.assertEqual(_sanear_notas(cuerpo), 'Mejoras y correcciones.')


class ContratoActualizacionesTestCase(APITestCase):
    """Cubre lo que la tanda anterior de tests dejó fuera: que los endpoints
    sigan siendo públicos, el contrato que consume la app de escritorio, y que
    ningún mensaje de error vuelva a delatar la infraestructura."""

    def setUp(self):
        cache.clear()
        self.release = {
            'tag_name': 'v1.2.3',
            'body': "### Added\n- Reporte nuevo.\n\n### Security\n- Se cerro una fuga.\n",
            'published_at': '2026-01-01T00:00:00Z',
            'assets': [{'name': 'Inventrix.exe', 'size': 12345,
                        'url': 'https://api.github.com/x/assets/1'}],
        }

    def tearDown(self):
        cache.clear()

    def test_los_endpoints_no_exigen_iniciar_sesion(self):
        """Es su razón de ser: la app tiene que poder actualizarse aunque el
        fallo a corregir esté en el propio login."""
        with patch('api.actualizaciones_views._pedir_a_github',
                   return_value=(self.release, None)):
            for ruta in ('/api/desktop/version/', '/api/desktop/descargar/'):
                r = self.client.get(ruta)
                self.assertNotIn(r.status_code, (401, 403), ruta)

    def test_el_contrato_que_consume_la_app_de_escritorio(self):
        with patch('api.actualizaciones_views._pedir_a_github',
                   return_value=(self.release, None)):
            datos = self.client.get('/api/desktop/version/').json()

        for campo in ('version', 'notas', 'url_descarga', 'nombre_archivo',
                      'tamano', 'sha256', 'publicado_en', 'version_minima'):
            self.assertIn(campo, datos, f'{campo} desaparecio del contrato')

        # La app compara versiones sin la "v" del tag.
        self.assertEqual(datos['version'], '1.2.3')
        self.assertEqual(datos['nombre_archivo'], 'Inventrix.exe')
        # Sin adjunto .sha256 el checksum va nulo, y el cliente falla cerrado.
        self.assertIsNone(datos['sha256'])

    def test_las_notas_salen_saneadas_por_el_endpoint(self):
        """El saneo tiene su prueba unitaria; esta comprueba que además esta
        efectivamente enchufado en la respuesta."""
        with patch('api.actualizaciones_views._pedir_a_github',
                   return_value=(self.release, None)):
            datos = self.client.get('/api/desktop/version/').json()

        self.assertIn('Reporte nuevo', datos['notas'])
        self.assertNotIn('fuga', datos['notas'])
        self.assertNotIn('Security', datos['notas'])

    def test_una_url_cacheada_no_confiable_no_se_reenvia(self):
        """Defensa en profundidad: aunque entre basura en la cache, no se
        redirige a los equipos del taller fuera de GitHub."""
        cache.set(CACHE_CLAVE_DESCARGA, 'https://evil.example.com/payload.exe', 300)

        with patch('api.actualizaciones_views._pedir_a_github',
                   return_value=(None, 'nada')):
            r = self.client.get('/api/desktop/descargar/')

        self.assertNotEqual(r.status_code, 302)
        self.assertNotIn('evil.example.com', r.content.decode())

    def test_ningun_mensaje_de_error_nombra_la_infraestructura(self):
        """Guarda de regresion: el texto de error de un endpoint publico es
        informacion regalada. No debe delatar donde vive el binario ni en que
        estado esta la credencial del servidor."""
        fallos = [
            urllib.error.HTTPError('u', 401, 'no', {}, None),
            urllib.error.HTTPError('u', 500, 'no', {}, None),
            urllib.error.URLError('sin red'),
        ]
        prohibidas = ('github', 'token', 'credencial', 'autentic')

        for fallo in fallos:
            cache.clear()
            with self.settings(GITHUB_DESKTOP_TOKEN='x', GITHUB_DESKTOP_REPO='o/r'):
                with patch('api.actualizaciones_views.urllib.request.urlopen',
                           side_effect=fallo):
                    cuerpo = self.client.get('/api/desktop/version/').content.decode().lower()

            for palabra in prohibidas:
                self.assertNotIn(palabra, cuerpo, f'{fallo} filtro "{palabra}"')

    def test_los_endpoints_tienen_su_propio_limite_de_peticiones(self):
        """Sin esto quedarian sin tope: `throttle_classes` reemplaza la lista
        por defecto, asi que aca no aplica el limite anonimo general."""
        from .actualizaciones_views import (
            ActualizacionThrottle, descargar_escritorio, version_escritorio,
        )

        for vista in (version_escritorio, descargar_escritorio):
            self.assertIn(ActualizacionThrottle, vista.cls.throttle_classes)
        self.assertIn('desktop_version', settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'])


class OrdenesDeProveedorTestCase(APITestCase):
    """`/proveedores/{id}/ordenes/` respondía 500 siempre: ordenaba por un campo
    (`fecha`) que no existe en el modelo. El 500 además venía tapando una fuga:
    el serializer se construía sin `context`, y sin él el mixin de roles da por
    hecho que quien pregunta es el dueño."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_prov_ord', password='x', is_staff=True)
        self.operador = User.objects.create_user(
            username='vend_prov_ord', password='x')

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente) VALUES
                    (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT (id_estado) DO NOTHING
            """)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Ordenes')
        self.producto = Producto.objects.create(
            sku_producto='SKU-PROV-ORD', nombre='Repuesto Prov',
            cantidad_actual=0, cantidad_total=0, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='300.00',
            id_proveedor=self.proveedor)
        self.orden = OrdenCompra.objects.create(
            id_proveedor=self.proveedor.id_proveedor,
            id_estado=OrdenCompra.ESTADO_PENDIENTE,
            fecha_creacion=timezone.localdate())
        with connection.cursor() as c:
            c.execute("""
                INSERT INTO orden_producto
                    (id_orden, id_producto, cantidad, precio_unitario)
                VALUES (%s, %s, 4, 555)
            """, [self.orden.id_orden, self.producto.id_producto])
        self.orden.calcular_saldo()

    def _url(self):
        return f'/api/proveedores/{self.proveedor.id_proveedor}/ordenes/'

    def test_el_endpoint_responde_en_vez_de_reventar(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(self._url())

        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 1)

    def test_el_dueno_ve_los_montos(self):
        self.client.force_authenticate(user=self.admin)
        fila = self.client.get(self._url()).json()[0]
        self.assertEqual(float(fila['total']), 2220.0)

    def test_el_operador_no_ve_los_montos_por_esta_via(self):
        """La fuga que el 500 escondía: sin `context` el mixin no oculta nada."""
        self.client.force_authenticate(user=self.operador)
        r = self.client.get(self._url())

        self.assertEqual(r.status_code, 200)
        fila = r.json()[0]
        for campo in ('total', 'monto_pagado', 'saldo_pendiente', 'estado_pago'):
            self.assertIsNone(fila[campo], campo)
        self.assertNotIn('555', r.content.decode())
        self.assertNotIn('2220', r.content.decode())


class PaginacionConfigurableTestCase(APITestCase):
    """`PageNumberPagination` a secas ignora `page_size` en silencio. El frontend
    lo manda en 15 sitios y recibía 20 filas: el selector de clientes de
    "Agendar servicio" no dejaba elegir del cliente 21 en adelante."""

    def setUp(self):
        User = get_user_model()
        self.admin = get_user_model().objects.create_user(
            username='admin_pag', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)
        for i in range(25):
            Cliente.objects.create(nombre=f'Cliente Pag {i:02d}')

    def test_sin_parametro_manda_el_valor_por_defecto(self):
        datos = self.client.get('/api/clientes/').json()
        self.assertEqual(len(datos['results']), 20)

    def test_el_cliente_puede_pedir_mas_por_pagina(self):
        datos = self.client.get('/api/clientes/?page_size=25').json()
        self.assertEqual(len(datos['results']), 25)

    def test_el_tope_evita_que_pidan_la_tabla_entera(self):
        """Sin `max_page_size`, un ?page_size=100000 obliga al servidor a
        serializarlo todo."""
        from .pagination import PaginacionConfigurable

        datos = self.client.get('/api/clientes/?page_size=100000').json()
        self.assertLessEqual(len(datos['results']), PaginacionConfigurable.max_page_size)


class PresupuestoAprobadoNoSeConvierteEnVentaTestCase(APITestCase):
    """Un presupuesto de reparación aprobado ya sacó sus repuestos del
    inventario. Convertirlo *además* en venta los descontaba una segunda vez y
    los facturaba dos veces."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin-dobledesc', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

        self.proveedor = Proveedor.objects.create(nombre_empresa='Prov Doble')
        self.producto = Producto.objects.create(
            sku_producto='SKU-DOBLE-1', nombre='Kit doble',
            cantidad_actual=10, cantidad_total=10, cantidad_minima=1,
            precio_compra_unitario=100, precio_final='200.00',
            id_proveedor=self.proveedor)
        self.cliente = Cliente.objects.create(nombre='Dueno Doble')
        self.moto = Moto.objects.create(
            id_cliente=self.cliente, marca='Honda', modelo='CG125',
            anio=2020, placa='DOBLE-1')
        self.tipo = Servicio.objects.create(
            nombre='Reparacion doble', tipo='Reparacion',
            precio_mano_obra='300.00', es_plantilla=True)

        r = self.client.post('/api/servicios-motos/', {
            'id_moto': self.moto.id_moto,
            'fecha_servicio': str(datetime.date.today()),
            'tipo_servicio': 'Reparacion doble',
            'id_tipo_servicio': self.tipo.id_servicio,
        }, format='json')
        self.id_servicio = r.data['id_servicio']
        for estado in ('recibida', 'en_diagnostico'):
            self.client.post(
                f'/api/servicios-motos/{self.id_servicio}/cambiar-estado/',
                {'estado': estado}, format='json')

        r = self.client.post(
            f'/api/servicios-motos/{self.id_servicio}/presupuestar/', {
                'servicios': [{'servicio': self.tipo.id_servicio,
                               'cantidad': 1, 'precio_unitario': 300}],
                'productos': [{'producto': self.producto.id_producto,
                               'cantidad': 3, 'precio_unitario': 200}],
            }, format='json')
        self.id_cotizacion = r.data['id_cotizacion']

        # Aprobar: acá es donde los repuestos salen del inventario.
        # Ojo con la ruta: en cotizaciones la acción es `cambiar_estado` con
        # guion bajo (en servicios-motos sí lleva guion). Con la otra el POST
        # se va a un 404 y el test pasa sin haber aprobado nada.
        r = self.client.post(
            f'/api/cotizaciones/{self.id_cotizacion}/cambiar_estado/',
            {'estado': 'aprobada'}, format='json')
        assert r.status_code == 200, r.data

    def test_aprobar_descuenta_el_stock_una_sola_vez(self):
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 7)

        cot = Cotizacion.objects.get(pk=self.id_cotizacion)
        self.assertTrue(cot.cargado_a_orden)

    def test_convertir_en_venta_un_presupuesto_ya_cargado_se_rechaza(self):
        r = self.client.post(
            f'/api/cotizaciones/{self.id_cotizacion}/convertir-venta/', {},
            format='json')

        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

        # Y sobre todo: el stock quedó como estaba, no bajó a 4.
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 7)

    def test_no_queda_una_venta_fantasma_ni_movimientos_de_mas(self):
        antes = MovimientoInventario.objects.filter(
            producto=self.producto).count()

        self.client.post(
            f'/api/cotizaciones/{self.id_cotizacion}/convertir-venta/', {},
            format='json')

        cot = Cotizacion.objects.get(pk=self.id_cotizacion)
        self.assertIsNone(cot.id_venta)
        self.assertNotEqual(cot.estado, 'convertida')
        self.assertEqual(
            MovimientoInventario.objects.filter(producto=self.producto).count(),
            antes)


class IntegridadDevolucionesVentaTestCase(APITestCase):
    """El importe de una devolución y el tope de un cobro salen de la venta, no
    de lo que mande el cliente."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username='admin_dev_int', password='x', is_staff=True)
        self.client.force_authenticate(user=self.admin)

        self.prov = Proveedor.objects.create(nombre_empresa='Prov DevInt')
        self.cliente = Cliente.objects.create(nombre='Cliente DevInt')
        self.producto = Producto.objects.create(
            sku_producto='SKU-DEVINT', nombre='Repuesto DevInt',
            cantidad_actual=100, cantidad_total=100, cantidad_minima=1,
            precio_compra_unitario=10, precio_final='100.00',
            id_proveedor=self.prov)

    def _venta(self, cantidad, precio):
        r = self.client.post('/api/ordenes-venta/', {
            'cliente': self.cliente.id_cliente,
            'fecha': str(datetime.date.today()),
            'total': str(cantidad * precio),
            'detalles': [{'producto': self.producto.id_producto,
                          'cantidad': cantidad, 'precio_unitario': precio}],
        }, format='json')
        assert r.status_code == 201, r.data
        return r.data['id_venta']

    def _devolver(self, id_venta, cantidad, precio):
        return self.client.post('/api/devoluciones/', {
            'venta': id_venta, 'fecha': str(datetime.date.today()),
            'detalles': [{'producto': self.producto.id_producto,
                          'cantidad': cantidad, 'precio_unitario': precio}],
        }, format='json')

    def test_el_precio_inflado_de_la_peticion_se_ignora(self):
        """Se devolvía un repuesto de C$100 declarando C$5.000 y la venta
        quedaba con un saldo a favor de C$4.900 inventado."""
        id_venta = self._venta(1, 100)
        r = self._devolver(id_venta, 1, 5000)

        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        venta = OrdenVenta.objects.get(pk=id_venta)
        self.assertEqual(venta.total_devuelto(), Decimal('100'))
        self.assertEqual(venta.saldo_a_favor(), Decimal('0'))

    def test_el_precio_a_la_baja_tampoco_se_toma(self):
        """El espejo: declarar 0 dejaba la deuda intacta pese a la devolución."""
        id_venta = self._venta(1, 100)
        self._devolver(id_venta, 1, 0)

        venta = OrdenVenta.objects.get(pk=id_venta)
        self.assertEqual(venta.total_devuelto(), Decimal('100'))

    def test_no_se_puede_cobrar_lo_que_ya_se_devolvio(self):
        """Venta de 5.000 con 2.000 devueltos: la deuda real es 3.000."""
        id_venta = self._venta(5, 1000)
        self._devolver(id_venta, 2, 1000)
        SesionCaja.objects.create(
            usuario=self.admin, monto_apertura=0, estado='abierta')

        r = self.client.post(
            '/api/ordenes-venta/{}/registrar-pago/'.format(id_venta), {
                'monto': 5000, 'metodo_pago': 'efectivo',
                'fecha_pago': str(datetime.date.today()),
            }, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn('3000', str(r.data))

    def test_el_cobro_por_la_deuda_real_si_pasa(self):
        id_venta = self._venta(5, 1000)
        self._devolver(id_venta, 2, 1000)
        SesionCaja.objects.create(
            usuario=self.admin, monto_apertura=0, estado='abierta')

        r = self.client.post(
            '/api/ordenes-venta/{}/registrar-pago/'.format(id_venta), {
                'monto': 3000, 'metodo_pago': 'efectivo',
                'fecha_pago': str(datetime.date.today()),
            }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_cancelar_una_venta_ya_devuelta_se_rechaza(self):
        """Cancelar reingresaba TODO lo vendido, incluida la mercadería que la
        devolución ya había puesto de vuelta: quedaban unidades fantasma."""
        id_venta = self._venta(10, 50)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 90)

        self._devolver(id_venta, 4, 50)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 94)

        r = self.client.post(
            '/api/ordenes-venta/{}/cancelar/'.format(id_venta), {},
            format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

        # Lo que importa: el stock no se infló a 104.
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 94)
        self.assertTrue(OrdenVenta.objects.filter(pk=id_venta).exists())

    def test_cancelar_una_venta_sin_devoluciones_sigue_funcionando(self):
        id_venta = self._venta(10, 50)
        r = self.client.post(
            '/api/ordenes-venta/{}/cancelar/'.format(id_venta), {},
            format='json')

        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_actual, 100)


class CajaActualPorRolTestCase(APITestCase):
    """El arqueo en vivo es de quien tiene el turno. `actual` no se puede
    bloquear (media docena de pantallas lo usan para saber si se puede cobrar),
    así que lo que se recorta es el detalle."""

    def setUp(self):
        User = get_user_model()
        self.duenio = User.objects.create_user(
            username='caja_duenio', password='x')
        self.otro = User.objects.create_user(username='caja_otro', password='x')
        self.admin = User.objects.create_user(
            username='caja_admin_rol', password='x', is_staff=True)

        self.client.force_authenticate(user=self.duenio)
        self.client.post('/api/caja/abrir/', {'monto_apertura': '5000.00'},
                         format='json')

    def test_el_dueno_del_turno_ve_su_arqueo(self):
        datos = self.client.get('/api/caja/actual/').json()

        self.assertTrue(datos['es_propia'])
        self.assertEqual(float(datos['monto_apertura']), 5000.0)
        self.assertIn('totales', datos)

    def test_otro_usuario_no_ve_los_montos_del_turno_ajeno(self):
        self.client.force_authenticate(user=self.otro)
        r = self.client.get('/api/caja/actual/')

        self.assertEqual(r.status_code, 200)
        datos = r.json()
        # Sigue sabiendo que hay caja abierta: es lo que el POS necesita.
        self.assertFalse(datos['es_propia'])
        self.assertEqual(datos['usuario_nombre'], 'caja_duenio')
        # Pero no el arqueo.
        for campo in ('monto_apertura', 'esperado_actual', 'totales',
                      'movimientos', 'diferencia'):
            self.assertNotIn(campo, datos, campo)
        self.assertNotIn('5000', r.content.decode())

    def test_el_dueno_del_negocio_si_ve_cualquier_turno(self):
        self.client.force_authenticate(user=self.admin)
        datos = self.client.get('/api/caja/actual/').json()

        self.assertTrue(datos['es_propia'])
        self.assertEqual(float(datos['monto_apertura']), 5000.0)

    def test_sin_caja_abierta_responde_nulo(self):
        SesionCaja.objects.all().delete()
        self.client.force_authenticate(user=self.otro)
        # `Response(None)` no lleva Content-Type, así que .json() no sirve acá.
        self.assertIsNone(self.client.get('/api/caja/actual/').data)
