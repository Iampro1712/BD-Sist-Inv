"""
Siembra historial de compras de demostración para poder ver funcionando la
comparación de precios y el desempeño de proveedores.

Existe porque esa función **consume** historial en vez de crearlo: con la base
recién estrenada las pantallas salen vacías y no se puede evaluar si sirven.

PELIGRO: son compras FALSAS. Al recibirlas suman stock real y aparecen en los
reportes de compras y cuentas por pagar. Por eso el comando se niega a correr
contra la base de producción y sabe deshacer exactamente lo que creó
(``--limpiar``).
"""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

# Marca con la que se reconoce después lo sembrado. Va en las notas de los
# movimientos de inventario porque `orden_compra` no tiene una columna de notas
# fiable (ver OrdenCompraDetailSerializer.get_notas).
MARCADOR = 'SEED-DEMO'

# Hosts que NO son de pruebas. Sembrar acá inflaría el inventario real.
HOSTS_PRODUCCION = ('node1.eclipze.dev',)


class Command(BaseCommand):
    help = ('Siembra historial de compras de demostración (precios y tiempos de '
            'entrega variados) para probar el análisis de proveedores.')

    def add_arguments(self, parser):
        parser.add_argument('--limpiar', action='store_true',
                            help='Borra lo sembrado y revierte el stock que sumó.')
        parser.add_argument('--ordenes', type=int, default=40,
                            help='Cuántas órdenes de compra generar (default 40).')
        parser.add_argument('--forzar', action='store_true',
                            help='Permite correr contra la base de producción. '
                                 'Inserta compras falsas: usar con cuidado.')
        parser.add_argument('--semilla', type=int, default=42,
                            help='Semilla del generador, para resultados repetibles.')

    def handle(self, *args, **options):
        host = connection.settings_dict.get('HOST') or ''
        if any(p in host for p in HOSTS_PRODUCCION) and not options['forzar']:
            self.stderr.write(self.style.ERROR(
                f'La base apuntada ({host}) parece ser de producción.\n'
                'Este comando inserta compras falsas que sumarían stock real y\n'
                'ensuciarían los reportes de compras y cuentas por pagar.\n'
                'Si de verdad querés hacerlo, agregá --forzar.'
            ))
            return

        if options['limpiar']:
            self._limpiar()
            return

        self._sembrar(options['ordenes'], options['semilla'])

    # ------------------------------------------------------------------

    def _sembrar(self, n_ordenes, semilla):
        rng = random.Random(semilla)

        with connection.cursor() as cursor:
            cursor.execute("SELECT id_proveedor FROM proveedores ORDER BY id_proveedor")
            proveedores = [r[0] for r in cursor.fetchall()]
            cursor.execute("""
                SELECT id_producto, COALESCE(precio_compra_unitario, 50)
                FROM productos ORDER BY id_producto
            """)
            productos = cursor.fetchall()
            # El catálogo `estado` es del esquema legado y puede venir vacío en
            # una base recién bootstrapeada.
            cursor.execute("""
                INSERT INTO estado (id_estado, cancelado, pendiente)
                VALUES (1,'SI','NO'), (2,'NO','SI'), (3,'NO','NO')
                ON CONFLICT DO NOTHING
            """)

        if not proveedores or not productos:
            self.stderr.write(self.style.ERROR(
                'Hacen falta proveedores y productos para sembrar el historial.'))
            return

        # Cada proveedor tiene su carácter: un nivel de precio general y un rango
        # de días de entrega.
        perfiles = {}
        for i, id_prov in enumerate(proveedores):
            perfiles[id_prov] = {
                'factor': round(rng.uniform(0.88, 1.22), 3),
                'dias': (2 + i % 4, 5 + (i % 4) * 4),
            }

        # Además cada proveedor es competitivo en unos productos y caro en otros
        # (uno es bueno en lubricantes, otro en llantas). Sin esta variación por
        # producto, el proveedor más barato en general lo sería en TODO y las
        # oportunidades de ahorro saldrían siempre en cero: no habría nada que
        # demostrar.
        especialidad = {
            (id_prov, id_producto): round(rng.uniform(0.80, 1.25), 3)
            for id_prov in proveedores
            for id_producto, _ in productos
        }

        hoy = timezone.now().date()
        creadas, recibidas, lineas_totales = 0, 0, 0

        with transaction.atomic():
            with connection.cursor() as cursor:
                for _ in range(n_ordenes):
                    id_prov = rng.choice(proveedores)
                    perfil = perfiles[id_prov]

                    fecha_creacion = hoy - timedelta(days=rng.randint(10, 240))
                    dias_prometidos = rng.randint(perfil['dias'][0], perfil['dias'][1])
                    fecha_esperada = fecha_creacion + timedelta(days=dias_prometidos)
                    # La mayoría cumple; algunos se atrasan, para que la
                    # puntualidad no salga toda al 100%.
                    dias_real = dias_prometidos + (
                        rng.randint(1, 6) if rng.random() < 0.3 else -rng.randint(0, 1))
                    dias_real = max(1, dias_real)
                    fecha_recepcion = fecha_creacion + timedelta(days=dias_real)
                    if fecha_recepcion > hoy:
                        fecha_recepcion = hoy

                    cursor.execute("""
                        INSERT INTO orden_compra
                            (id_proveedor, id_estado, fecha_creacion, monto_pagado,
                             estado_pago, stock_aplicado, fecha_esperada, fecha_recepcion)
                        VALUES (%s, 3, %s, 0, 'pendiente', TRUE, %s, %s)
                        RETURNING id_orden
                    """, [id_prov, fecha_creacion, fecha_esperada, fecha_recepcion])
                    id_orden = cursor.fetchone()[0]
                    creadas += 1
                    recibidas += 1

                    total = 0
                    for id_producto, costo_ref in rng.sample(
                            productos, rng.randint(2, min(5, len(productos)))):
                        cantidad = rng.randint(2, 12)
                        precio = round(float(costo_ref) * perfil['factor']
                                       * especialidad[(id_prov, id_producto)]
                                       * rng.uniform(0.97, 1.03), 2)
                        cursor.execute("""
                            INSERT INTO orden_producto
                                (id_orden, id_producto, cantidad, precio_unitario)
                            VALUES (%s, %s, %s, %s)
                        """, [id_orden, id_producto, cantidad, precio])
                        total += cantidad * precio
                        lineas_totales += 1

                        # Se recibe de verdad: suma stock y deja el movimiento.
                        # El MARCADOR en las notas es lo que permite deshacerlo.
                        cursor.execute(
                            "UPDATE productos SET cantidad_actual = cantidad_actual + %s "
                            "WHERE id_producto = %s", [cantidad, id_producto])
                        cursor.execute("""
                            INSERT INTO movimientos_inventario
                                (producto_id, tipo, cantidad, fecha, referencia,
                                 tipo_referencia, notas)
                            VALUES (%s, 'ENTRADA', %s, %s, %s, 'ORDEN_COMPRA', %s)
                        """, [id_producto, cantidad, fecha_recepcion,
                              f'COMPRA-{id_orden}',
                              f'{MARCADOR} recepción de compra #{id_orden}'])

                    # Estado de pago variado, para que cuentas por pagar tenga
                    # algo que mostrar además del historial de precios.
                    pagado = round(total * rng.choice([0, 0, 0.5, 1]), 2)
                    estado = ('pagado' if pagado >= total
                              else 'parcial' if pagado > 0 else 'pendiente')
                    cursor.execute("""
                        UPDATE orden_compra
                        SET monto_pagado = %s, saldo_pendiente = %s, estado_pago = %s
                        WHERE id_orden = %s
                    """, [pagado, round(total - pagado, 2), estado, id_orden])

        self.stdout.write(self.style.SUCCESS(
            f'Sembradas {creadas} órdenes de compra ({lineas_totales} líneas), '
            f'{recibidas} recibidas con su stock y movimientos.'))
        self.stdout.write(
            'Para deshacerlo por completo: manage.py seed_proveedores_demo --limpiar')

    # ------------------------------------------------------------------

    def _limpiar(self):
        """Deshace lo sembrado: revierte el stock y borra órdenes y movimientos."""
        with transaction.atomic():
            with connection.cursor() as cursor:
                # Las órdenes sembradas se reconocen por el marcador que quedó en
                # las notas de sus movimientos.
                cursor.execute("""
                    SELECT DISTINCT referencia FROM movimientos_inventario
                    WHERE notas LIKE %s AND referencia LIKE 'COMPRA-%%'
                """, [f'{MARCADOR}%'])
                referencias = [r[0] for r in cursor.fetchall()]
                if not referencias:
                    self.stdout.write('No hay datos de demostración que limpiar.')
                    return

                ids = [int(r.split('-', 1)[1]) for r in referencias]

                # Revertir el stock exactamente por lo que cada movimiento sumó.
                cursor.execute("""
                    SELECT producto_id, SUM(cantidad) FROM movimientos_inventario
                    WHERE notas LIKE %s AND tipo = 'ENTRADA'
                    GROUP BY producto_id
                """, [f'{MARCADOR}%'])
                for producto_id, cantidad in cursor.fetchall():
                    cursor.execute(
                        "UPDATE productos SET cantidad_actual = GREATEST(0, cantidad_actual - %s) "
                        "WHERE id_producto = %s", [cantidad, producto_id])

                cursor.execute(
                    "DELETE FROM movimientos_inventario WHERE notas LIKE %s",
                    [f'{MARCADOR}%'])
                movimientos = cursor.rowcount
                cursor.execute(
                    "DELETE FROM pago_compra WHERE id_orden = ANY(%s)", [ids])
                cursor.execute(
                    "DELETE FROM orden_producto WHERE id_orden = ANY(%s)", [ids])
                cursor.execute(
                    "DELETE FROM orden_compra WHERE id_orden = ANY(%s)", [ids])
                ordenes = cursor.rowcount

        self.stdout.write(self.style.SUCCESS(
            f'Limpieza lista: {ordenes} órdenes y {movimientos} movimientos borrados, '
            f'stock revertido.'))
