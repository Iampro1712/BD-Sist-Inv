"""
Siembra historial de ventas de demostración para poder ver funcionando el
pronóstico de demanda.

Existe porque el pronóstico **consume** historial en vez de crearlo: con pocos
datos las pantallas salen con confianza baja en todo y no se puede evaluar si la
función sirve.

La estacionalidad no es al azar: replica el mercado nicaragüense.

- **Lluviosa (mayo–octubre)**: los frenos, la cadena y las llantas se desgastan
  más rápido con agua, lodo y calles en mal estado.
- **Seca (noviembre–abril)**: el polvo tapa los filtros de aire y sube el
  refrigerante por el calor.
- **Diciembre**: accesorios (cascos, calcomanías, luces) por regalos, y
  mantenimiento previo a los viajes de fin de año.
- **Clases (febrero y julio)**: más uso diario de motos de bajo cilindraje, que
  son las que dominan el parque acá (YBR125, GN125, Fury 125, CB125).
- **Todo el año**: aceite, filtro de aceite y bujías, que es mantenimiento
  regular y no depende de la época.

PELIGRO: son ventas FALSAS. Aparecen en los reportes de ventas y rentabilidad
como si fueran ingresos. Por eso el comando se niega a correr contra producción
y sabe deshacer exactamente lo que creó (``--limpiar``).

DECISIÓN DELIBERADA: **no toca el stock actual**. Son ventas retroactivas cuyo
único fin es alimentar el pronóstico; descontar stock corrompería el conteo
físico real, que se cargó a mano. Tampoco genera movimientos de inventario, por
la misma razón.
"""
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from inventory.models import Cliente, OrdenVenta

# Cliente con el que se registran las ventas sembradas. Es la marca que permite
# encontrarlas y borrarlas después: `ventas` no tiene columna de notas.
CLIENTE_MARCADOR = 'CLIENTE DEMO PRONOSTICO'

# Hosts que NO son de pruebas. Sembrar acá ensuciaría los ingresos reales.
HOSTS_PRODUCCION = ('node1.eclipze.dev',)

# Multiplicador de demanda por mes (1 = enero). Cómo se lee: 1.0 es la demanda
# base del producto; 1.8 es 80% más que lo normal en ese mes.
LLUVIA = {5: 1.5, 6: 1.8, 7: 1.8, 8: 1.7, 9: 1.8, 10: 1.6,
          11: 0.9, 12: 0.8, 1: 0.7, 2: 0.7, 3: 0.8, 4: 1.0}
SECA = {11: 1.4, 12: 1.5, 1: 1.7, 2: 1.7, 3: 1.8, 4: 1.6,
        5: 1.0, 6: 0.7, 7: 0.6, 8: 0.6, 9: 0.6, 10: 0.8}
REGALOS = {12: 3.0, 11: 1.4, 1: 0.6, 2: 0.7, 3: 0.7, 4: 0.7,
           5: 0.8, 6: 0.8, 7: 0.9, 8: 0.8, 9: 0.8, 10: 0.9}
CLASES = {2: 1.6, 7: 1.5, 1: 1.2, 6: 1.1, 3: 1.0, 4: 1.0,
          5: 1.0, 8: 1.0, 9: 1.0, 10: 1.0, 11: 1.0, 12: 1.1}
ESTABLE = {m: 1.0 for m in range(1, 13)}

# Qué patrón sigue cada producto, por palabra clave en el nombre. El orden
# importa: gana la primera que coincida.
PATRONES = [
    # Lluvia: frenado y tracción.
    (('pastilla', 'zapata', 'disco de freno', 'liquido de frenos',
      'líquido de frenos', 'manigueta de freno'), LLUVIA, (6, 14)),
    (('llanta', 'neumatico', 'neumático'), LLUVIA, (3, 8)),
    (('cadena', 'arrastre', 'lubricante de cadena', 'limpiador de cadena',
      'candado de cadena'), LLUVIA, (4, 10)),
    (('rodamiento', 'reten', 'retén', 'horquilla', 'amortiguador'), LLUVIA, (2, 6)),
    # Seca: polvo y calor.
    (('filtro de aire',), SECA, (6, 14)),
    (('refrigerante',), SECA, (2, 6)),
    # Diciembre: regalos y accesorios.
    (('casco', 'guante', 'chaqueta', 'calcomania', 'calcomanía', 'funda',
      'led', 'bombillo', 'espejo', 'pito', 'cromado', 'puno', 'puño'),
     REGALOS, (2, 6)),
    # Clases: desgaste de uso diario en motos chicas.
    (('guaya', 'embrague', 'kit de limpieza', 'carburador'), CLASES, (3, 8)),
    # Mantenimiento regular todo el año.
    (('aceite', 'bujia', 'bujía', 'filtro de aceite', 'grasa',
      'filtro de combustible'), ESTABLE, (8, 18)),
]

# Para los que no caen en ningún patrón: rotación baja y sin estación marcada
# (pistones, estatores, empaques — se venden cuando algo se rompe).
POR_DEFECTO = (ESTABLE, (0, 3))


def _perfil(nombre):
    """(estacionalidad, rango de unidades por mes) de un producto."""
    n = nombre.lower()
    for claves, estacion, rango in PATRONES:
        if any(k in n for k in claves):
            return estacion, rango
    return POR_DEFECTO


class Command(BaseCommand):
    help = ('Siembra historial de ventas con estacionalidad de Nicaragua para '
            'poder probar el pronóstico de demanda.')

    def add_arguments(self, parser):
        parser.add_argument('--limpiar', action='store_true',
                            help='Borra las ventas sembradas por este comando.')
        parser.add_argument('--meses', type=int, default=14,
                            help='Cuántos meses de historial generar (default 14).')
        parser.add_argument('--forzar', action='store_true',
                            help='Permite correr contra producción. Inserta '
                                 'ventas falsas: usar con mucho cuidado.')
        parser.add_argument('--semilla', type=int, default=42,
                            help='Semilla del generador, para repetir resultados.')

    def handle(self, *args, **options):
        host = connection.settings_dict.get('HOST') or ''
        if any(p in host for p in HOSTS_PRODUCCION) and not options['forzar']:
            self.stderr.write(self.style.ERROR(
                f'La base apuntada ({host}) parece ser de producción.\n'
                'Este comando inserta ventas falsas que aparecerían como\n'
                'ingresos en los reportes de ventas y rentabilidad.\n'
                'Si de verdad querés hacerlo, agregá --forzar.'
            ))
            return

        if options['limpiar']:
            self._limpiar()
            return

        self._sembrar(options['meses'], options['semilla'])

    # -- Siembra ---------------------------------------------------------------

    @transaction.atomic
    def _sembrar(self, meses, semilla):
        azar = random.Random(semilla)

        with connection.cursor() as c:
            c.execute('SELECT id_producto, nombre, precio_final FROM productos '
                      'ORDER BY id_producto')
            productos = c.fetchall()

        if not productos:
            self.stderr.write(self.style.ERROR(
                'No hay productos en el catálogo: primero hace falta inventario.'))
            return

        cliente, creado = Cliente.objects.get_or_create(nombre=CLIENTE_MARCADOR)
        if creado:
            self.stdout.write(f'Cliente marcador creado: {CLIENTE_MARCADOR}')

        hoy = date.today()
        # Primer día del mes, `meses` atrás.
        anio, mes = hoy.year, hoy.month
        for _ in range(meses - 1):
            mes -= 1
            if mes < 1:
                anio, mes = anio - 1, 12

        ventas_creadas = lineas = unidades = 0
        while (anio, mes) <= (hoy.year, hoy.month):
            # Cuántos días tiene este mes de historial (el mes en curso va solo
            # hasta hoy, para no inventar ventas futuras).
            ultimo_dia = hoy.day if (anio, mes) == (hoy.year, hoy.month) else 28

            # Se agrupan varios productos por venta, como una compra real de
            # mostrador, en vez de una venta por producto.
            del_mes = []
            for id_prod, nombre, precio in productos:
                estacion, (bajo, alto) = _perfil(nombre)
                objetivo = azar.randint(bajo, alto) * estacion[mes]
                # Ruido: dos meses iguales no venden exactamente lo mismo.
                objetivo *= azar.uniform(0.75, 1.25)
                if (anio, mes) == (hoy.year, hoy.month):
                    # El mes en curso está incompleto: se prorratea.
                    objetivo *= ultimo_dia / 28
                cantidad = int(round(objetivo))
                if cantidad > 0:
                    del_mes.append((id_prod, nombre, float(precio or 0), cantidad))

            azar.shuffle(del_mes)
            while del_mes:
                # 1 a 4 productos por ticket. El corte se calcula una sola vez:
                # con dos randint distintos se saltearían o duplicarían líneas.
                corte = azar.randint(1, 4)
                grupo, del_mes = del_mes[:corte], del_mes[corte:]
                dia = azar.randint(1, ultimo_dia)
                fecha = date(anio, mes, dia)
                total = sum(p[2] * p[3] for p in grupo)

                venta = OrdenVenta.objects.create(
                    id_cliente=cliente.id_cliente, fecha=fecha,
                    total=round(total, 2), monto_pagado=round(total, 2),
                    saldo_pendiente=0, estado_pago='pagado')
                ventas_creadas += 1

                with connection.cursor() as c:
                    for id_prod, _nombre, precio, cantidad in grupo:
                        c.execute(
                            'INSERT INTO producto_venta '
                            '(id_venta, id_producto, cantidad, precio_unitario) '
                            'VALUES (%s, %s, %s, %s)',
                            [venta.id_venta, id_prod, cantidad, precio])
                        lineas += 1
                        unidades += cantidad

            mes += 1
            if mes > 12:
                anio, mes = anio + 1, 1

        self.stdout.write(self.style.SUCCESS(
            f'Sembrado: {ventas_creadas} ventas, {lineas} líneas, '
            f'{unidades} unidades en {meses} meses.'))
        self.stdout.write(
            'El stock NO se modificó: son ventas retroactivas solo para el '
            'pronóstico.\n'
            f'Para deshacerlo: manage.py seed_demanda_demo --limpiar')

    # -- Limpieza --------------------------------------------------------------

    @transaction.atomic
    def _limpiar(self):
        try:
            cliente = Cliente.objects.get(nombre=CLIENTE_MARCADOR)
        except Cliente.DoesNotExist:
            self.stdout.write('No hay nada sembrado por este comando.')
            return

        ventas = list(OrdenVenta.objects.filter(
            id_cliente=cliente.id_cliente).values_list('id_venta', flat=True))
        if ventas:
            with connection.cursor() as c:
                c.execute('DELETE FROM producto_venta WHERE id_venta = ANY(%s)',
                          [ventas])
                c.execute('DELETE FROM ventas WHERE id_venta = ANY(%s)', [ventas])
        cliente.delete()

        self.stdout.write(self.style.SUCCESS(
            f'Borradas {len(ventas)} ventas de demostración y su cliente marcador.'))
