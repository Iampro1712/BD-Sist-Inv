"""
Genera estados de pago aleatorios y COHERENTES para las ventas existentes.

Para cada venta sin pagos registrados asigna, de forma aleatoria, uno de tres
escenarios e inserta pagos reales en `pagos_venta`, recalculando luego el saldo
y el estado con OrdenVenta.calcular_saldo() para que badge, saldo e historial
siempre concuerden:

  - pendiente (~30%): no se inserta ningún pago.
  - parcial   (~35%): un abono por una fracción del total (20%-70%).
  - pagado    (~35%): uno o dos pagos que cubren el total completo.

Es seguro re-ejecutarlo: solo toca ventas que aún no tienen pagos.

Uso:  python populate_estados_pago.py
"""
import os
import random
from decimal import Decimal, ROUND_HALF_UP

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from inventory.models import OrdenVenta, PagoVenta  # noqa: E402

METODOS = ['efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque']


def cents(value):
    return Decimal(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def main():
    resumen = {'pendiente': 0, 'parcial': 0, 'pagado': 0, 'omitidas': 0}

    ventas = OrdenVenta.objects.all()
    for venta in ventas:
        # No duplicar si ya tiene pagos (re-ejecución segura)
        if venta.pagos.exists():
            resumen['omitidas'] += 1
            continue

        total = venta.calcular_total()
        if total <= 0:
            # No se pueden registrar pagos (monto > 0) sobre un total nulo
            resumen['omitidas'] += 1
            continue

        escenario = random.choices(
            ['pendiente', 'parcial', 'pagado'], weights=[30, 35, 35], k=1
        )[0]

        if escenario == 'pendiente':
            # Aun así recalculamos para fijar saldo_pendiente = total y estado
            venta.calcular_saldo()
            resumen['pendiente'] += 1
            continue

        if escenario == 'parcial':
            fraccion = Decimal(str(random.uniform(0.20, 0.70)))
            monto = cents(total * fraccion)
            if monto <= 0:
                monto = cents(total / 2)
            PagoVenta.objects.create(
                id_venta=venta,
                monto=monto,
                fecha_pago=venta.fecha,
                metodo_pago=random.choice(METODOS),
                referencia=f'ABONO-{venta.id_venta}',
            )
            resumen['parcial'] += 1

        else:  # pagado
            if random.random() < 0.5:
                # Un solo pago por el total
                PagoVenta.objects.create(
                    id_venta=venta,
                    monto=cents(total),
                    fecha_pago=venta.fecha,
                    metodo_pago=random.choice(METODOS),
                    referencia=f'PAGO-{venta.id_venta}',
                )
            else:
                # Dos pagos que suman el total
                primero = cents(total * Decimal(str(random.uniform(0.30, 0.60))))
                segundo = cents(total - primero)
                PagoVenta.objects.create(
                    id_venta=venta, monto=primero, fecha_pago=venta.fecha,
                    metodo_pago=random.choice(METODOS),
                    referencia=f'ABONO-{venta.id_venta}-1',
                )
                PagoVenta.objects.create(
                    id_venta=venta, monto=segundo, fecha_pago=venta.fecha,
                    metodo_pago=random.choice(METODOS),
                    referencia=f'ABONO-{venta.id_venta}-2',
                )
            resumen['pagado'] += 1

        venta.calcular_saldo()

    print('Resumen de estados asignados:')
    for k, v in resumen.items():
        print(f'  {k:10s}: {v}')


if __name__ == '__main__':
    main()
