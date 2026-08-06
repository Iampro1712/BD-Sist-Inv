"""
Lista las ventas cuyo total facturado no coincide con la suma de sus líneas.

Mientras `producto_venta.precio_unitario` fue una columna entera (hasta la
migración 0025), todo precio con centavos se redondeaba al guardarlo. El total
de la venta sí conservaba los centavos, así que las dos cifras dejaron de
cuadrar — y el saldo sale de la suma de las líneas, no del total.

Ese centavo perdido **no se puede recuperar**: el precio exacto de esas líneas
no quedó guardado en ninguna parte. Lo que sí se puede es saber cuáles son las
ventas afectadas y por cuánto, para decidir qué hacer con cada una.

    python manage.py verificar_totales_venta
    python manage.py verificar_totales_venta --detalle
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Lista las ventas cuyo total no cuadra con la suma de sus líneas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detalle', action='store_true',
            help='Muestra una línea por venta descuadrada, no sólo el resumen.')
        parser.add_argument(
            '--limite', type=int, default=40,
            help='Cuántas ventas listar con --detalle (por defecto 40).')

    def handle(self, *args, **opciones):
        with connection.cursor() as cursor:
            # La mano de obra del taller no vive en `producto_venta` (esa tabla
            # exige un id_producto real), así que se suma aparte. Sin esto toda
            # venta de taller aparecería descuadrada por el importe del trabajo.
            cursor.execute("""
                SELECT v.id_venta,
                       v.fecha,
                       v.total,
                       COALESCE(lineas.suma, 0) + COALESCE(trabajo.suma, 0) AS calculado
                FROM ventas v
                LEFT JOIN (
                    SELECT id_venta, SUM(precio_unitario * cantidad) AS suma
                    FROM producto_venta GROUP BY id_venta
                ) lineas ON lineas.id_venta = v.id_venta
                LEFT JOIN (
                    SELECT id_venta, SUM(precio_mano_obra) AS suma
                    FROM servicio_motos WHERE id_venta IS NOT NULL
                    GROUP BY id_venta
                ) trabajo ON trabajo.id_venta = v.id_venta
                WHERE COALESCE(lineas.suma, 0) + COALESCE(trabajo.suma, 0) <> v.total
                  -- Las ventas sin líneas propias usan `ventas.total` como
                  -- fuente y no están descuadradas: son otro caso.
                  AND lineas.suma IS NOT NULL
                ORDER BY ABS(v.total - (COALESCE(lineas.suma,0) + COALESCE(trabajo.suma,0))) DESC
            """)
            descuadradas = cursor.fetchall()

            cursor.execute("SELECT COUNT(*) FROM ventas")
            total_ventas = cursor.fetchone()[0]

        if not descuadradas:
            self.stdout.write(self.style.SUCCESS(
                f'Las {total_ventas} ventas cuadran: el total de cada una '
                f'coincide con la suma de sus líneas.'))
            return

        diferencia_total = sum(abs(fila[2] - fila[3]) for fila in descuadradas)

        self.stdout.write(self.style.WARNING(
            f'{len(descuadradas)} de {total_ventas} ventas no cuadran.'))
        self.stdout.write(
            f'Diferencia acumulada: C${diferencia_total:.2f}')
        self.stdout.write(
            'El saldo de estas ventas sale de la suma de las líneas, así que '
            'esa es la cifra que el sistema cobra.')

        if not opciones['detalle']:
            self.stdout.write('\nUsá --detalle para ver cuáles son.')
            return

        limite = opciones['limite']
        self.stdout.write('')
        self.stdout.write(
            f'{"VENTA":>8}  {"FECHA":<12} {"FACTURADO":>12} '
            f'{"LÍNEAS":>12} {"DIFERENCIA":>12}')
        for id_venta, fecha, total, calculado in descuadradas[:limite]:
            self.stdout.write(
                f'{id_venta:>8}  {str(fecha):<12} {total:>12.2f} '
                f'{calculado:>12.2f} {total - calculado:>+12.2f}')

        if len(descuadradas) > limite:
            self.stdout.write(
                f'\n... y {len(descuadradas) - limite} más '
                f'(subí --limite para verlas).')
