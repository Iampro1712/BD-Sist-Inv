"""
Vistas para reportes del sistema
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.conf import settings
from django.db import connection
from django.utils import timezone
from decimal import Decimal
import json
import math

from inventory.encryption import decrypt_value
from inventory.models import ConfiguracionIA
from .ia_cliente import preguntar_json

# Nota: antes estos reportes usaban @cache_page, pero cachea por URL sin
# distinguir usuario — servía la respuesta cacheada de un admin a un no-admin,
# saltándose el permiso IsAdminUser. Se eliminó el cache para que el permiso
# se evalúe siempre (los reportes son consultas baratas en este dataset).


def _codigo_ubicacion(bodega, pasillo, estante, gaveta):
    """Etiqueta corta de una ubicación leída por cursor crudo.

    Replica `Ubicacion.codigo` para los reportes que no pasan por el ORM.
    """
    if not bodega:
        return None
    partes = [bodega]
    for prefijo, valor in (('P', pasillo), ('E', estante), ('G', gaveta)):
        if valor:
            partes.append(f'{prefijo}{valor}')
    return ' · '.join(partes)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_inventario(request):
    """Genera reporte del estado actual del inventario"""
    with connection.cursor() as cursor:
        # Total de productos
        cursor.execute("SELECT COUNT(*) FROM productos")
        total_productos = cursor.fetchone()[0]
        
        # Valor total del inventario
        cursor.execute("""
            SELECT SUM(cantidad_actual * precio_final) 
            FROM productos
        """)
        valor_total = cursor.fetchone()[0] or 0
        
        # Productos con stock bajo (cantidad_actual <= cantidad_minima)
        cursor.execute("""
            SELECT COUNT(*) 
            FROM productos 
            WHERE cantidad_actual <= cantidad_minima AND cantidad_actual > 0
        """)
        productos_stock_bajo = cursor.fetchone()[0]
        
        # Productos sin stock
        cursor.execute("""
            SELECT COUNT(*) 
            FROM productos 
            WHERE cantidad_actual = 0
        """)
        productos_sin_stock = cursor.fetchone()[0]
        
        # Listado de productos
        cursor.execute("""
            SELECT 
                id_producto,
                sku_producto as codigo,
                nombre,
                cantidad_actual as stock_actual,
                cantidad_minima as stock_minimo,
                precio_final as precio_venta,
                (cantidad_actual * precio_final) as valor_stock
            FROM productos
            ORDER BY nombre
        """)
        
        productos = []
        for row in cursor.fetchall():
            productos.append({
                'id': row[0],
                'codigo': row[1],
                'nombre': row[2],
                'stock_actual': row[3],
                'stock_minimo': row[4],
                'precio_venta': float(row[5]) if row[5] else 0,
                'valor_stock': float(row[6]) if row[6] else 0,
            })
    
    return Response({
        'total_productos': total_productos,
        'valor_total': float(valor_total),
        'productos_stock_bajo': productos_stock_bajo,
        'productos_sin_stock': productos_sin_stock,
        'productos': productos,
        'por_categoria': []  # Placeholder para gráfico
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_ventas(request):
    """Genera reporte de ventas por rango de fechas"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    
    if not fecha_inicio or not fecha_fin:
        return Response({'error': 'Debe proporcionar fecha_inicio y fecha_fin'}, status=400)
    
    with connection.cursor() as cursor:
        # Total de ventas
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0), COUNT(*)
            FROM ventas
            WHERE fecha BETWEEN %s AND %s
        """, [fecha_inicio, fecha_fin])
        
        result = cursor.fetchone()
        total_ventas = float(result[0]) if result[0] else 0
        numero_ordenes = result[1]
        ticket_promedio = total_ventas / numero_ordenes if numero_ordenes > 0 else 0
        
        # Ventas por cliente
        cursor.execute("""
            SELECT 
                c.nombre as cliente,
                COALESCE(SUM(v.total), 0) as total
            FROM ventas v
            INNER JOIN cliente c ON c.id_cliente = v.id_cliente
            WHERE v.fecha BETWEEN %s AND %s
            GROUP BY c.nombre
            ORDER BY total DESC
            LIMIT 10
        """, [fecha_inicio, fecha_fin])
        
        por_cliente = []
        for row in cursor.fetchall():
            por_cliente.append({
                'cliente': row[0],
                'total': float(row[1])
            })
        
        # Listado de órdenes
        cursor.execute("""
            SELECT 
                v.id_venta as numero_orden,
                c.nombre as cliente,
                v.fecha,
                v.total
            FROM ventas v
            INNER JOIN cliente c ON c.id_cliente = v.id_cliente
            WHERE v.fecha BETWEEN %s AND %s
            ORDER BY v.fecha DESC
        """, [fecha_inicio, fecha_fin])
        
        ordenes = []
        for row in cursor.fetchall():
            ordenes.append({
                'id': row[0],
                'numero_orden': row[0],
                'cliente': row[1],
                'fecha': str(row[2]),
                'total': float(row[3]),
                'estado': 'confirmada',
                'productos': [],
            })

        # Productos vendidos por cada orden (una sola consulta para todo el rango)
        cursor.execute("""
            SELECT pv.id_venta, p.nombre, pv.cantidad, pv.precio_unitario,
                   (pv.cantidad * pv.precio_unitario) AS subtotal
            FROM producto_venta pv
            INNER JOIN ventas v ON v.id_venta = pv.id_venta
            INNER JOIN productos p ON p.id_producto = pv.id_producto
            WHERE v.fecha BETWEEN %s AND %s
            ORDER BY pv.id_venta
        """, [fecha_inicio, fecha_fin])

        items_por_venta = {}
        for r in cursor.fetchall():
            items_por_venta.setdefault(r[0], []).append({
                'nombre': r[1],
                'cantidad': int(r[2]) if r[2] else 0,
                'precio_unitario': float(r[3]) if r[3] else 0.0,
                'subtotal': float(r[4]) if r[4] else 0.0,
            })

        # Ventas que provienen de una orden de trabajo del taller. El vínculo es
        # explícito (servicio_motos.id_venta); antes se adivinaba cruzando
        # fecha + costo + cliente, lo que confundía servicios iguales del mismo
        # día y se rompía si se editaba el costo.
        cursor.execute("""
            SELECT sm.id_venta, sm.tipo_servicio
            FROM servicio_motos sm
            INNER JOIN ventas v ON v.id_venta = sm.id_venta
            WHERE v.fecha BETWEEN %s AND %s
        """, [fecha_inicio, fecha_fin])
        servicios = {row[0]: row[1] for row in cursor.fetchall()}

        for orden in ordenes:
            orden['productos'] = items_por_venta.get(orden['id'], [])
            # Es venta de taller si nació de una orden de trabajo. Puede traer
            # además líneas de producto (los repuestos que se le facturaron),
            # así que no se exige que venga sin productos.
            tipo = servicios.get(orden['id'])
            orden['es_servicio'] = bool(tipo)
            orden['tipo_servicio'] = tipo

    return Response({
        'total_ventas': total_ventas,
        'numero_ordenes': numero_ordenes,
        'ticket_promedio': ticket_promedio,
        'por_cliente': por_cliente,
        'ordenes': ordenes
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_compras(request):
    """Compras por rango de fechas: cuánto se le compró a cada proveedor.

    Sobre el cálculo del total, que estaba mal: usaba
    `SUM(p.precio_compra_unitario)`, o sea el costo **actual del catálogo** sumado
    una vez por línea, ignorando la cantidad y el precio que se pactó en esa
    compra. Comprar 50 filtros a C$80 sumaba C$95 (el costo de hoy, una sola vez)
    en lugar de C$4.000. El número salía plausible y no significaba nada.

    Ahora es `SUM(op.cantidad * op.precio_unitario)`: lo que de verdad se pagó,
    igual que `OrdenCompra.calcular_total()` y que los reportes de desempeño de
    proveedores y cuentas por pagar. Al no depender más del catálogo, sobra el
    JOIN con `productos`.

    Los totales excluyen las órdenes canceladas —no se compró nada ahí— pero el
    listado sí las muestra con su estado, porque saber que se canceló una compra
    es información útil.
    """
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    proveedor_id = request.GET.get('proveedor')

    if not fecha_inicio or not fecha_fin:
        return Response({'error': 'Debe proporcionar fecha_inicio y fecha_fin'}, status=400)

    with connection.cursor() as cursor:
        where_clause = "WHERE oc.fecha_creacion BETWEEN %s AND %s"
        params = [fecha_inicio, fecha_fin]

        if proveedor_id:
            where_clause += " AND oc.id_proveedor = %s"
            params.append(proveedor_id)

        # Para los agregados, además, fuera las canceladas.
        where_activas = where_clause + " AND oc.id_estado <> 1"

        # Total de compras: un único JOIN agregado en lugar de subconsultas
        # correlacionadas por fila. El LEFT JOIN preserva órdenes sin líneas.
        cursor.execute(f"""
            SELECT COUNT(DISTINCT oc.id_orden),
                   COALESCE(SUM(op.cantidad * op.precio_unitario), 0)
            FROM orden_compra oc
            LEFT JOIN orden_producto op ON op.id_orden = oc.id_orden
            {where_activas}
        """, params)

        result = cursor.fetchone()
        numero_ordenes = result[0]
        total_compras = float(result[1]) if result[1] else 0
        compra_promedio = total_compras / numero_ordenes if numero_ordenes > 0 else 0

        # Órdenes que no pueden aportar al total porque sus líneas no tienen
        # cantidad ni precio: son de antes de que `orden_producto` los guardara.
        # Se informan para que un total bajo se entienda en vez de parecer un
        # error del reporte (mismo criterio que `puede_recibirse` en la interfaz).
        cursor.execute(f"""
            SELECT COUNT(DISTINCT oc.id_orden)
            FROM orden_compra oc
            JOIN orden_producto op ON op.id_orden = oc.id_orden
            {where_activas}
              AND (op.cantidad IS NULL OR op.precio_unitario IS NULL)
        """, params)
        ordenes_sin_importes = cursor.fetchone()[0]

        # Compras por proveedor (mismo JOIN agregado)
        cursor.execute(f"""
            SELECT
                pr.nombre_empresa as proveedor,
                COALESCE(SUM(op.cantidad * op.precio_unitario), 0) as total
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
            LEFT JOIN orden_producto op ON op.id_orden = oc.id_orden
            {where_activas}
            GROUP BY pr.nombre_empresa
            ORDER BY total DESC
            LIMIT 10
        """, params)

        por_proveedor = []
        for row in cursor.fetchall():
            por_proveedor.append({
                'proveedor': row[0],
                'total': float(row[1])
            })

        # Listado de órdenes (total por orden vía GROUP BY, sin subconsultas).
        # Acá sí van las canceladas: se ven con su estado.
        cursor.execute(f"""
            SELECT
                oc.id_orden as numero_orden,
                pr.nombre_empresa as proveedor,
                oc.fecha_creacion as fecha,
                COALESCE(SUM(op.cantidad * op.precio_unitario), 0) as total,
                CASE
                    WHEN oc.id_estado = 1 THEN 'cancelada'
                    WHEN oc.id_estado = 2 THEN 'pendiente'
                    WHEN oc.id_estado = 3 THEN 'recibida'
                    ELSE 'desconocido'
                END as estado
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
            LEFT JOIN orden_producto op ON op.id_orden = oc.id_orden
            {where_clause}
            GROUP BY oc.id_orden, pr.nombre_empresa, oc.fecha_creacion, oc.id_estado
            ORDER BY oc.fecha_creacion DESC
        """, params)

        ordenes = []
        for row in cursor.fetchall():
            ordenes.append({
                'id': row[0],
                'numero_orden': row[0],
                'proveedor': row[1],
                'fecha': str(row[2]),
                'total': float(row[3]) if row[3] else 0,
                'estado': row[4]
            })

    return Response({
        'total_compras': total_compras,
        'numero_ordenes': numero_ordenes,
        'compra_promedio': compra_promedio,
        'ordenes_sin_importes': ordenes_sin_importes,
        'por_proveedor': por_proveedor,
        'ordenes': ordenes
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def productos_mas_vendidos(request):
    """Genera reporte de productos más vendidos"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    limite = int(request.GET.get('limite', 10))
    
    if not fecha_inicio or not fecha_fin:
        return Response({'error': 'Debe proporcionar fecha_inicio y fecha_fin'}, status=400)
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                p.id_producto as producto_id,
                p.nombre as producto,
                SUM(pv.cantidad) as cantidad_vendida,
                SUM(pv.precio_unitario * pv.cantidad) as total_ventas
            FROM producto_venta pv
            INNER JOIN ventas v ON v.id_venta = pv.id_venta
            INNER JOIN productos p ON p.id_producto = pv.id_producto
            WHERE v.fecha BETWEEN %s AND %s
            GROUP BY p.id_producto, p.nombre
            ORDER BY cantidad_vendida DESC
            LIMIT %s
        """, [fecha_inicio, fecha_fin, limite])
        
        productos = []
        for row in cursor.fetchall():
            productos.append({
                'producto_id': row[0],
                'producto': row[1],
                'cantidad_vendida': row[2],
                'total_ventas': float(row[3]) if row[3] else 0
            })

    return Response(productos)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def cuentas_por_cobrar(request):
    """Cuentas por cobrar: ventas con saldo pendiente, con antigüedad (aging).

    No se cachea: debe reflejar de inmediato cualquier pago registrado.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                v.id_venta,
                v.id_cliente,
                c.nombre  AS cliente,
                c.telefono,
                v.fecha,
                v.total,
                v.monto_pagado,
                v.saldo_pendiente,
                v.estado_pago,
                (CURRENT_DATE - v.fecha) AS dias,
                CASE
                    WHEN (CURRENT_DATE - v.fecha) <= 30 THEN '0-30'
                    WHEN (CURRENT_DATE - v.fecha) <= 60 THEN '31-60'
                    WHEN (CURRENT_DATE - v.fecha) <= 90 THEN '61-90'
                    ELSE '90+'
                END AS bucket
            FROM ventas v
            INNER JOIN cliente c ON c.id_cliente = v.id_cliente
            WHERE v.estado_pago IN ('pendiente', 'parcial')
              AND COALESCE(v.saldo_pendiente, 0) > 0
            ORDER BY v.fecha ASC
        """)
        cuentas = []
        buckets = {'0-30': 0.0, '31-60': 0.0, '61-90': 0.0, '90+': 0.0}
        total_por_cobrar = 0.0
        clientes = set()
        for r in cursor.fetchall():
            saldo = float(r[7]) if r[7] else 0.0
            buckets[r[10]] += saldo
            total_por_cobrar += saldo
            clientes.add(r[1])
            cuentas.append({
                'id_venta': r[0],
                'id_cliente': r[1],
                'cliente': r[2],
                'telefono': decrypt_value(r[3]),
                'fecha': r[4],
                'total': float(r[5]) if r[5] else 0.0,
                'monto_pagado': float(r[6]) if r[6] else 0.0,
                'saldo_pendiente': saldo,
                'estado_pago': r[8],
                'dias': int(r[9]) if r[9] is not None else 0,
                'bucket': r[10],
            })

    return Response({
        'total_por_cobrar': round(total_por_cobrar, 2),
        'num_ventas': len(cuentas),
        'num_clientes': len(clientes),
        'aging': {k: round(v, 2) for k, v in buckets.items()},
        'cuentas': cuentas,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_rentabilidad(request):
    """Rentabilidad por producto: margen unitario y utilidad realizada en ventas.

    La utilidad realizada usa el precio al que se vendió (producto_venta) menos el
    costo de compra del producto.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                p.id_producto,
                p.nombre,
                p.sku_producto,
                COALESCE(p.precio_compra_unitario, 0) AS costo,
                COALESCE(p.precio_final, 0)           AS precio_venta,
                COALESCE(p.cantidad_actual, 0)        AS stock,
                COALESCE(SUM(pv.cantidad), 0)         AS vendidos,
                COALESCE(SUM(pv.cantidad * (pv.precio_unitario - COALESCE(p.precio_compra_unitario, 0))), 0) AS utilidad
            FROM productos p
            LEFT JOIN producto_venta pv ON pv.id_producto = p.id_producto
            GROUP BY p.id_producto, p.nombre, p.sku_producto, p.precio_compra_unitario, p.precio_final, p.cantidad_actual
            ORDER BY utilidad DESC
        """)
        productos = []
        valor_costo = 0.0
        valor_venta = 0.0
        utilidad_realizada = 0.0
        for r in cursor.fetchall():
            costo = float(r[3])
            precio = float(r[4])
            stock = int(r[5])
            margen = precio - costo
            margen_pct = round((margen / precio) * 100, 1) if precio > 0 else 0.0
            valor_costo += stock * costo
            valor_venta += stock * precio
            utilidad_realizada += float(r[7])
            productos.append({
                'id_producto': r[0],
                'nombre': r[1],
                'sku': r[2],
                'costo': costo,
                'precio_venta': precio,
                'margen_unitario': round(margen, 2),
                'margen_pct': margen_pct,
                'stock': stock,
                'vendidos': int(r[6]),
                'utilidad': round(float(r[7]), 2),
            })

    return Response({
        'valor_inventario_costo': round(valor_costo, 2),
        'valor_inventario_venta': round(valor_venta, 2),
        'utilidad_potencial': round(valor_venta - valor_costo, 2),
        'utilidad_realizada': round(utilidad_realizada, 2),
        'num_productos': len(productos),
        'productos': productos,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_stock_muerto(request):
    """Productos con stock que NO se han vendido en los últimos N días (default 90).

    Mide el capital inmovilizado (stock x costo) para detectar mercadería estancada.
    """
    try:
        dias = int(request.GET.get('dias', 90))
    except (ValueError, TypeError):
        dias = 90
    if dias < 1:
        dias = 90

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                p.id_producto,
                p.nombre,
                p.sku_producto,
                COALESCE(p.cantidad_actual, 0)        AS stock,
                COALESCE(p.precio_compra_unitario, 0) AS costo,
                COALESCE(p.precio_final, 0)           AS precio_venta,
                (SELECT MAX(v.fecha)
                   FROM producto_venta pv
                   JOIN ventas v ON v.id_venta = pv.id_venta
                  WHERE pv.id_producto = p.id_producto) AS ultima_venta,
                u.bodega, u.pasillo, u.estante, u.gaveta
            FROM productos p
            LEFT JOIN ubicacion u ON u.id_ubicacion = p.id_ubicacion
            WHERE COALESCE(p.cantidad_actual, 0) > 0
              AND NOT EXISTS (
                  SELECT 1 FROM producto_venta pv
                  JOIN ventas v ON v.id_venta = pv.id_venta
                  WHERE pv.id_producto = p.id_producto
                    AND v.fecha >= CURRENT_DATE - %s::int
              )
            ORDER BY (COALESCE(p.cantidad_actual, 0) * COALESCE(p.precio_compra_unitario, 0)) DESC
        """, [dias])
        productos = []
        capital_total = 0.0
        for r in cursor.fetchall():
            stock = int(r[3])
            costo = float(r[4])
            capital = stock * costo
            capital_total += capital
            productos.append({
                'id_producto': r[0],
                'nombre': r[1],
                'sku': r[2],
                'stock': stock,
                'costo': costo,
                'precio_venta': float(r[5]),
                'ultima_venta': r[6],
                'capital_inmovilizado': round(capital, 2),
                # Para poder ir a buscarlo físicamente y liquidarlo.
                'ubicacion': _codigo_ubicacion(r[7], r[8], r[9], r[10]),
            })

    return Response({
        'dias': dias,
        'num_productos': len(productos),
        'capital_inmovilizado_total': round(capital_total, 2),
        'productos': productos,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_estado_resultados(request):
    """Estado de resultados (P&L) del período:
        ingresos - costo de ventas = utilidad bruta
        utilidad bruta - gastos operativos = utilidad neta

    Ingresos = SUM(ventas.total) en el rango (misma fuente que reporte_ventas).
    Costo de ventas = SUM(cantidad vendida * precio_compra_unitario) del rango.
    """
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    if not fecha_inicio or not fecha_fin:
        return Response({'error': 'Debe proporcionar fecha_inicio y fecha_fin'}, status=400)

    with connection.cursor() as cursor:
        # Ingresos del período
        cursor.execute(
            "SELECT COALESCE(SUM(total), 0) FROM ventas WHERE fecha BETWEEN %s AND %s",
            [fecha_inicio, fecha_fin],
        )
        ingresos = float(cursor.fetchone()[0] or 0)

        # Costo de ventas: lo que costó la mercadería vendida en el período
        cursor.execute("""
            SELECT COALESCE(SUM(pv.cantidad * COALESCE(p.precio_compra_unitario, 0)), 0)
            FROM producto_venta pv
            INNER JOIN ventas v ON v.id_venta = pv.id_venta
            INNER JOIN productos p ON p.id_producto = pv.id_producto
            WHERE v.fecha BETWEEN %s AND %s
        """, [fecha_inicio, fecha_fin])
        costo_ventas = float(cursor.fetchone()[0] or 0)

        # Gastos operativos del período, desglosados por categoría
        cursor.execute("""
            SELECT cg.nombre, COALESCE(SUM(g.monto), 0)
            FROM gasto g
            INNER JOIN categoria_gasto cg ON cg.id_categoria = g.id_categoria
            WHERE g.fecha BETWEEN %s AND %s
            GROUP BY cg.nombre
            ORDER BY SUM(g.monto) DESC
        """, [fecha_inicio, fecha_fin])
        gastos_por_categoria = [
            {'categoria': row[0], 'total': float(row[1])} for row in cursor.fetchall()
        ]

    gastos_total = sum(g['total'] for g in gastos_por_categoria)
    utilidad_bruta = ingresos - costo_ventas
    utilidad_neta = utilidad_bruta - gastos_total

    return Response({
        'fecha_inicio': fecha_inicio,
        'fecha_fin': fecha_fin,
        'ingresos': round(ingresos, 2),
        'costo_ventas': round(costo_ventas, 2),
        'utilidad_bruta': round(utilidad_bruta, 2),
        'gastos_total': round(gastos_total, 2),
        'gastos_por_categoria': gastos_por_categoria,
        'utilidad_neta': round(utilidad_neta, 2),
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_cuentas_por_pagar(request):
    """Cuentas por pagar: compras con saldo pendiente al proveedor, con
    antigüedad (aging). Espejo de cuentas_por_cobrar. No se cachea."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                oc.id_orden,
                oc.id_proveedor,
                pr.nombre_empresa AS proveedor,
                oc.fecha_creacion,
                oc.monto_pagado,
                oc.saldo_pendiente,
                oc.estado_pago,
                (CURRENT_DATE - oc.fecha_creacion) AS dias,
                CASE
                    WHEN (CURRENT_DATE - oc.fecha_creacion) <= 30 THEN '0-30'
                    WHEN (CURRENT_DATE - oc.fecha_creacion) <= 60 THEN '31-60'
                    WHEN (CURRENT_DATE - oc.fecha_creacion) <= 90 THEN '61-90'
                    ELSE '90+'
                END AS bucket
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
            WHERE oc.estado_pago IN ('pendiente', 'parcial')
              AND COALESCE(oc.saldo_pendiente, 0) > 0
              AND oc.id_estado <> 1  -- no canceladas
            ORDER BY oc.fecha_creacion ASC
        """)
        cuentas = []
        buckets = {'0-30': 0.0, '31-60': 0.0, '61-90': 0.0, '90+': 0.0}
        total_por_pagar = 0.0
        proveedores = set()
        for r in cursor.fetchall():
            saldo = float(r[5]) if r[5] else 0.0
            pagado = float(r[4]) if r[4] else 0.0
            buckets[r[8]] += saldo
            total_por_pagar += saldo
            proveedores.add(r[1])
            cuentas.append({
                'id_orden': r[0],
                'id_proveedor': r[1],
                'proveedor': r[2],
                'fecha': r[3],
                'total': round(pagado + saldo, 2),
                'monto_pagado': pagado,
                'saldo_pendiente': saldo,
                'estado_pago': r[6],
                'dias': int(r[7]) if r[7] is not None else 0,
                'bucket': r[8],
            })

    return Response({
        'total_por_pagar': round(total_por_pagar, 2),
        'num_ordenes': len(cuentas),
        'num_proveedores': len(proveedores),
        'aging': {k: round(v, 2) for k, v in buckets.items()},
        'cuentas': cuentas,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_agenda_taller(request):
    """Estado del taller: carga por mecánico y antigüedad por estado.

    Sirve para ver dónde se está atascando el trabajo (por ejemplo, órdenes
    varadas en 'esperando_repuesto') y cómo está repartida la carga.
    """
    with connection.cursor() as cursor:
        # Órdenes abiertas agrupadas por estado.
        cursor.execute("""
            SELECT estado, COUNT(*), COALESCE(SUM(costo), 0),
                   COALESCE(AVG(CURRENT_DATE - fecha_servicio), 0)
            FROM servicio_motos
            WHERE estado NOT IN ('entregada', 'cancelada')
            GROUP BY estado
        """)
        por_estado = [{
            'estado': r[0],
            'cantidad': int(r[1]),
            'monto': float(r[2]),
            'dias_promedio': round(float(r[3]), 1),
        } for r in cursor.fetchall()]

        # Carga por mecánico (solo órdenes abiertas).
        cursor.execute("""
            SELECT sm.id_mecanico, u.username, u.first_name, u.last_name,
                   COUNT(*), COALESCE(SUM(sm.costo), 0)
            FROM servicio_motos sm
            LEFT JOIN auth_user u ON u.id = sm.id_mecanico
            WHERE sm.estado NOT IN ('entregada', 'cancelada')
            GROUP BY sm.id_mecanico, u.username, u.first_name, u.last_name
            ORDER BY COUNT(*) DESC
        """)
        por_mecanico = []
        for r in cursor.fetchall():
            nombre = (f"{r[2] or ''} {r[3] or ''}".strip() or r[1]) if r[0] else 'Sin asignar'
            por_mecanico.append({
                'id_mecanico': r[0],
                'mecanico': nombre,
                'ordenes_abiertas': int(r[4]),
                'monto': float(r[5]),
            })

        # Órdenes más viejas todavía abiertas: las que hay que destrabar.
        cursor.execute("""
            SELECT sm.id_servicio, sm.estado, sm.fecha_servicio, sm.tipo_servicio,
                   sm.costo, m.placa, c.nombre,
                   (CURRENT_DATE - sm.fecha_servicio) AS dias
            FROM servicio_motos sm
            INNER JOIN motos m ON m.id_moto = sm.id_moto
            INNER JOIN cliente c ON c.id_cliente = m.id_cliente
            WHERE sm.estado NOT IN ('entregada', 'cancelada')
            ORDER BY sm.fecha_servicio ASC
            LIMIT 20
        """)
        mas_antiguas = [{
            'id_servicio': r[0],
            'estado': r[1],
            'fecha': r[2],
            'tipo_servicio': r[3],
            'costo': float(r[4]) if r[4] else 0.0,
            'placa': r[5],
            'cliente': r[6],
            'dias': int(r[7]) if r[7] is not None else 0,
        } for r in cursor.fetchall()]

        # Entregas y facturación del mes en curso.
        cursor.execute("""
            SELECT COUNT(*), COALESCE(SUM(costo), 0)
            FROM servicio_motos
            WHERE estado = 'entregada'
              AND fecha_entrega >= date_trunc('month', CURRENT_DATE)
        """)
        fila = cursor.fetchone()

    return Response({
        'abiertas': sum(e['cantidad'] for e in por_estado),
        'monto_en_taller': round(sum(e['monto'] for e in por_estado), 2),
        'entregadas_mes': int(fila[0]),
        'facturado_mes': float(fila[1]),
        'por_estado': por_estado,
        'por_mecanico': por_mecanico,
        'mas_antiguas': mas_antiguas,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_mantenimiento_preventivo(request):
    """Motos que ya toca revisar, según lo sugerido al entregar su último
    servicio. Genera trabajo recurrente en vez de esperar a que el cliente
    aparezca solo.

    `dias_vencido` positivo = ya se pasó la fecha.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT sm.id_servicio, sm.id_moto, m.marca, m.modelo, m.placa,
                   c.id_cliente, c.nombre, c.telefono,
                   sm.fecha_entrega, sm.tipo_servicio,
                   sm.proximo_mantenimiento_fecha,
                   sm.proximo_mantenimiento_km, sm.km_actual,
                   (CURRENT_DATE - sm.proximo_mantenimiento_fecha) AS dias_vencido
            FROM servicio_motos sm
            INNER JOIN motos m ON m.id_moto = sm.id_moto
            INNER JOIN cliente c ON c.id_cliente = m.id_cliente
            WHERE sm.proximo_mantenimiento_fecha IS NOT NULL
              AND sm.estado = 'entregada'
              -- Solo el último servicio con recordatorio de cada moto: si ya
              -- volvió después, el recordatorio viejo ya no aplica.
              AND sm.id_servicio = (
                  SELECT sm2.id_servicio FROM servicio_motos sm2
                  WHERE sm2.id_moto = sm.id_moto
                    AND sm2.proximo_mantenimiento_fecha IS NOT NULL
                    AND sm2.estado = 'entregada'
                  ORDER BY sm2.proximo_mantenimiento_fecha DESC
                  LIMIT 1
              )
              AND sm.proximo_mantenimiento_fecha <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY sm.proximo_mantenimiento_fecha ASC
        """)
        pendientes = []
        vencidos = 0
        for r in cursor.fetchall():
            dias = int(r[13]) if r[13] is not None else 0
            if dias > 0:
                vencidos += 1
            pendientes.append({
                'id_servicio': r[0],
                'id_moto': r[1],
                'moto': f"{r[2]} {r[3]}",
                'placa': r[4],
                'id_cliente': r[5],
                'cliente': r[6],
                # Viene cifrado de la BD; el cursor crudo no pasa por el
                # descifrado del modelo (mismo caso que cuentas_por_cobrar).
                'telefono': decrypt_value(r[7]),
                'ultimo_servicio': r[8],
                'ultimo_tipo': r[9],
                'proxima_fecha': r[10],
                'proximo_km': r[11],
                'km_ultimo': r[12],
                'dias_vencido': dias,
                'vencido': dias > 0,
            })

    return Response({
        'total': len(pendientes),
        'vencidos': vencidos,
        'proximos': len(pendientes) - vencidos,
        'motos': pendientes,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_conteo_fisico(request):
    """Hoja de conteo físico: qué hay que contar, agrupado y ordenado por lugar.

    El orden es lo que la hace útil: se recorre la tienda estante por estante en
    vez de ir saltando de un lado a otro buscando productos de una lista alfabética.

    Los productos sin ubicación van en un grupo aparte al final, para que no se
    queden fuera del conteo mientras se termina de ubicar el inventario.
    """
    bodega = request.GET.get('bodega') or None

    with connection.cursor() as cursor:
        params = []
        filtro_bodega = ''
        if bodega:
            # Con filtro de bodega no tiene sentido arrastrar los sin ubicar.
            filtro_bodega = 'WHERE u.bodega = %s'
            params.append(bodega)

        cursor.execute(f"""
            SELECT
                p.id_producto, p.sku_producto, p.nombre,
                COALESCE(p.cantidad_actual, 0) AS sistema,
                COALESCE(p.precio_final, 0)    AS precio,
                u.id_ubicacion, u.bodega, u.pasillo, u.estante, u.gaveta
            FROM productos p
            LEFT JOIN ubicacion u ON u.id_ubicacion = p.id_ubicacion
            {filtro_bodega}
            ORDER BY
                (p.id_ubicacion IS NULL),
                u.bodega NULLS LAST, u.pasillo NULLS LAST,
                u.estante NULLS LAST, u.gaveta NULLS LAST,
                p.nombre
        """, params)

        grupos = []
        indice = {}
        total_productos = 0
        valor_esperado = 0.0

        for r in cursor.fetchall():
            id_ubicacion = r[5]
            clave = id_ubicacion if id_ubicacion is not None else '__sin_ubicacion__'
            if clave not in indice:
                indice[clave] = len(grupos)
                grupos.append({
                    'id_ubicacion': id_ubicacion,
                    'ubicacion': _codigo_ubicacion(r[6], r[7], r[8], r[9]) or 'Sin ubicación',
                    'sin_ubicacion': id_ubicacion is None,
                    'productos': [],
                })
            stock = int(r[3])
            precio = float(r[4])
            total_productos += 1
            valor_esperado += stock * precio
            grupos[indice[clave]]['productos'].append({
                'id_producto': r[0],
                'sku': r[1],
                'nombre': r[2],
                'sistema': stock,
                'precio': precio,
            })

    return Response({
        'bodega': bodega,
        'total_productos': total_productos,
        'total_ubicaciones': len([g for g in grupos if not g['sin_ubicacion']]),
        'sin_ubicacion': sum(len(g['productos']) for g in grupos if g['sin_ubicacion']),
        'valor_esperado': round(valor_esperado, 2),
        'grupos': grupos,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_desempeno_proveedores(request):
    """Cómo se porta cada proveedor: qué tan rápido entrega, cuánto se le compra
    y cuánto se le debe.

    Sobre la puntualidad: solo se calcula para las órdenes que tienen fecha
    prometida. Si nadie registra fechas prometidas no se informa un 100% falso,
    se declara que no es calculable y se muestra solo la velocidad de entrega.
    """
    with connection.cursor() as cursor:
        # `fecha_recepcion` tiene zona y `fecha_creacion` es una fecha local, así
        # que hay que convertir antes de restar: un `::date` directo usa la zona
        # de la sesión (UTC) y una recepción de la noche contaría un día más,
        # haciendo ver a todos los proveedores más lentos de lo que son.
        cursor.execute("""
            SELECT
                pr.id_proveedor,
                pr.nombre_empresa,
                COUNT(DISTINCT oc.id_orden)                                    AS ordenes,
                COUNT(DISTINCT oc.id_orden) FILTER (
                    WHERE oc.fecha_recepcion IS NOT NULL)                      AS recibidas,
                AVG((oc.fecha_recepcion AT TIME ZONE %s)::date - oc.fecha_creacion) FILTER (
                    WHERE oc.fecha_recepcion IS NOT NULL)                      AS dias_promedio,
                MIN((oc.fecha_recepcion AT TIME ZONE %s)::date - oc.fecha_creacion) FILTER (
                    WHERE oc.fecha_recepcion IS NOT NULL)                      AS dias_min,
                MAX((oc.fecha_recepcion AT TIME ZONE %s)::date - oc.fecha_creacion) FILTER (
                    WHERE oc.fecha_recepcion IS NOT NULL)                      AS dias_max,
                COUNT(DISTINCT oc.id_orden) FILTER (
                    WHERE oc.fecha_esperada IS NOT NULL
                      AND oc.fecha_recepcion IS NOT NULL)                      AS con_promesa,
                COUNT(DISTINCT oc.id_orden) FILTER (
                    WHERE oc.fecha_esperada IS NOT NULL
                      AND oc.fecha_recepcion IS NOT NULL
                      AND (oc.fecha_recepcion AT TIME ZONE %s)::date <= oc.fecha_esperada)
                                                                               AS a_tiempo,
                COALESCE(SUM(oc.saldo_pendiente) FILTER (
                    WHERE oc.estado_pago IN ('pendiente','parcial')), 0)       AS saldo,
                MAX(oc.fecha_creacion)                                         AS ultima_compra
            FROM proveedores pr
            LEFT JOIN orden_compra oc
                   ON oc.id_proveedor = pr.id_proveedor
                  AND oc.id_estado <> 1          -- las canceladas no cuentan
            GROUP BY pr.id_proveedor, pr.nombre_empresa
            ORDER BY pr.nombre_empresa
        """, [settings.TIME_ZONE] * 4)
        filas = cursor.fetchall()

        # El monto comprado sale de las líneas, no de una columna: `orden_compra`
        # no guarda el total (se deriva de cantidad x precio, ver calcular_total).
        cursor.execute("""
            SELECT oc.id_proveedor,
                   COALESCE(SUM(op.cantidad * op.precio_unitario), 0) AS monto,
                   COUNT(DISTINCT op.id_producto)                     AS productos
            FROM orden_compra oc
            JOIN orden_producto op ON op.id_orden = oc.id_orden
            WHERE oc.id_estado <> 1
            GROUP BY oc.id_proveedor
        """)
        montos = {r[0]: (float(r[1]), int(r[2])) for r in cursor.fetchall()}

    proveedores = []
    for r in filas:
        monto, productos = montos.get(r[0], (0.0, 0))
        con_promesa = int(r[7] or 0)
        proveedores.append({
            'id_proveedor': r[0],
            'proveedor': r[1],
            'ordenes': int(r[2] or 0),
            'recibidas': int(r[3] or 0),
            'dias_promedio': round(float(r[4]), 1) if r[4] is not None else None,
            'dias_min': int(r[5]) if r[5] is not None else None,
            'dias_max': int(r[6]) if r[6] is not None else None,
            # None = no medible (sin fechas prometidas), no 0 ni 100.
            'puntualidad': (round(int(r[8] or 0) * 100.0 / con_promesa, 1)
                            if con_promesa else None),
            'ordenes_con_promesa': con_promesa,
            'saldo_pendiente': float(r[9] or 0),
            'monto_comprado': round(monto, 2),
            'productos_distintos': productos,
            'ultima_compra': r[10],
        })

    medibles = [p for p in proveedores if p['dias_promedio'] is not None]
    return Response({
        'num_proveedores': len(proveedores),
        'con_entregas_medibles': len(medibles),
        'puntualidad_medible': any(p['puntualidad'] is not None for p in proveedores),
        'mas_rapido': min(medibles, key=lambda p: p['dias_promedio'])['proveedor'] if medibles else None,
        'mas_lento': max(medibles, key=lambda p: p['dias_promedio'])['proveedor'] if medibles else None,
        'monto_total': round(sum(p['monto_comprado'] for p in proveedores), 2),
        'proveedores': proveedores,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_comparacion_precios(request):
    """A qué precio le vendió cada proveedor el mismo producto.

    Los precios salen del historial de compras, no de un catálogo que alguien
    tenga que mantener: cada compra recibida alimenta la comparación sola.

    Lo accionable son las **oportunidades de ahorro**: productos donde el
    proveedor asignado al producto no es el que lo dio más barato.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                p.id_producto, p.nombre, p.sku_producto, p.id_proveedor AS proveedor_asignado,
                oc.id_proveedor, pr.nombre_empresa,
                COUNT(*)                                        AS veces,
                AVG(op.precio_unitario)                         AS precio_promedio,
                MIN(op.precio_unitario)                         AS precio_min,
                MAX(oc.fecha_creacion)                          AS ultima_fecha,
                -- Precio de la compra más reciente a ese proveedor. El desempate
                -- por id_orden es necesario: dos compras al mismo proveedor el
                -- mismo día dejarían el "último precio" a criterio del motor.
                (ARRAY_AGG(op.precio_unitario
                           ORDER BY oc.fecha_creacion DESC, oc.id_orden DESC))[1]
                                                                AS ultimo_precio
            FROM orden_producto op
            JOIN orden_compra oc ON oc.id_orden = op.id_orden
            JOIN productos p     ON p.id_producto = op.id_producto
            JOIN proveedores pr  ON pr.id_proveedor = oc.id_proveedor
            WHERE op.precio_unitario IS NOT NULL
              AND op.precio_unitario > 0
              AND oc.id_estado <> 1
            GROUP BY p.id_producto, p.nombre, p.sku_producto, p.id_proveedor,
                     oc.id_proveedor, pr.nombre_empresa
            ORDER BY p.nombre, AVG(op.precio_unitario)
        """)
        filas = cursor.fetchall()

    # Agrupar por producto para poder comparar entre proveedores.
    productos = {}
    for r in filas:
        prod = productos.setdefault(r[0], {
            'id_producto': r[0], 'nombre': r[1], 'sku': r[2],
            'proveedor_asignado': r[3], 'proveedores': [],
        })
        prod['proveedores'].append({
            'id_proveedor': r[4],
            'proveedor': r[5],
            'veces_comprado': int(r[6]),
            'precio_promedio': round(float(r[7]), 2),
            'precio_min': round(float(r[8]), 2),
            'ultima_fecha': r[9],
            'ultimo_precio': round(float(r[10]), 2),
        })

    comparables, oportunidades = [], []
    for prod in productos.values():
        provs = prod['proveedores']
        mejor = min(provs, key=lambda x: x['ultimo_precio'])
        peor = max(provs, key=lambda x: x['ultimo_precio'])
        for p in provs:
            p['es_mejor_precio'] = p['id_proveedor'] == mejor['id_proveedor']
        prod['mejor_precio'] = mejor['ultimo_precio']
        prod['mejor_proveedor'] = mejor['proveedor']
        prod['diferencia'] = round(peor['ultimo_precio'] - mejor['ultimo_precio'], 2)

        # Solo tiene sentido comparar si hay más de un proveedor.
        if len(provs) > 1:
            comparables.append(prod)
            asignado = next(
                (p for p in provs if p['id_proveedor'] == prod['proveedor_asignado']), None)
            if asignado and asignado['id_proveedor'] != mejor['id_proveedor']:
                oportunidades.append({
                    'id_producto': prod['id_producto'],
                    'nombre': prod['nombre'],
                    'sku': prod['sku'],
                    'proveedor_actual': asignado['proveedor'],
                    'precio_actual': asignado['ultimo_precio'],
                    'mejor_proveedor': mejor['proveedor'],
                    'mejor_precio': mejor['ultimo_precio'],
                    'ahorro_unitario': round(
                        asignado['ultimo_precio'] - mejor['ultimo_precio'], 2),
                })

    oportunidades.sort(key=lambda o: o['ahorro_unitario'], reverse=True)
    comparables.sort(key=lambda p: p['diferencia'], reverse=True)

    return Response({
        'productos_con_historial': len(productos),
        'productos_comparables': len(comparables),
        'num_oportunidades': len(oportunidades),
        'ahorro_unitario_total': round(sum(o['ahorro_unitario'] for o in oportunidades), 2),
        'oportunidades': oportunidades,
        'productos': comparables,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_devoluciones_proveedor(request):
    """Qué se le devolvió a cada proveedor y por qué.

    La razón de negocio de la función: saber **a quién le llega mercadería
    mala**. Un proveedor barato al que hay que devolverle el 20% de lo que manda
    no es barato.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT
                pr.id_proveedor,
                pr.nombre_empresa,
                COUNT(DISTINCT dc.id_devolucion_compra) AS devoluciones,
                COALESCE(SUM(dc.total), 0)              AS monto_devuelto,
                COALESCE(SUM(dc.reembolso), 0)          AS reembolsado,
                MAX(dc.fecha)                           AS ultima
            FROM proveedores pr
            JOIN devolucion_compra dc ON dc.id_proveedor = pr.id_proveedor
            GROUP BY pr.id_proveedor, pr.nombre_empresa
            ORDER BY SUM(dc.total) DESC
        """)
        por_proveedor = [{
            'id_proveedor': r[0],
            'proveedor': r[1],
            'devoluciones': int(r[2]),
            'monto_devuelto': float(r[3]),
            'reembolsado': float(r[4]),
            # Lo que el proveedor todavía debe por lo devuelto.
            'saldo_a_favor': round(float(r[3]) - float(r[4]), 2),
            'ultima': r[5],
        } for r in cursor.fetchall()]

        # Cuánto se le compró a cada uno, para poder leer la tasa de devolución:
        # devolver C$5.000 a quien se le compró C$10.000 no es lo mismo que a
        # quien se le compró C$500.000.
        cursor.execute("""
            SELECT oc.id_proveedor, COALESCE(SUM(op.cantidad * op.precio_unitario), 0)
            FROM orden_compra oc
            JOIN orden_producto op ON op.id_orden = oc.id_orden
            WHERE oc.id_estado <> 1
            GROUP BY oc.id_proveedor
        """)
        comprado = {r[0]: float(r[1]) for r in cursor.fetchall()}

        for p in por_proveedor:
            total_comprado = comprado.get(p['id_proveedor'], 0.0)
            p['monto_comprado'] = round(total_comprado, 2)
            p['tasa_devolucion'] = (round(p['monto_devuelto'] * 100 / total_comprado, 1)
                                    if total_comprado else None)

        # Los productos que más se devuelven: suele ser un problema del producto,
        # no del proveedor.
        cursor.execute("""
            SELECT p.id_producto, p.nombre, p.sku_producto,
                   SUM(pdc.cantidad)                          AS unidades,
                   SUM(pdc.cantidad * pdc.precio_unitario)    AS monto
            FROM producto_devolucion_compra pdc
            JOIN productos p ON p.id_producto = pdc.id_producto
            GROUP BY p.id_producto, p.nombre, p.sku_producto
            ORDER BY SUM(pdc.cantidad * pdc.precio_unitario) DESC
            LIMIT 15
        """)
        productos = [{
            'id_producto': r[0], 'nombre': r[1], 'sku': r[2],
            'unidades': int(r[3]), 'monto': float(r[4]),
        } for r in cursor.fetchall()]

        cursor.execute("""
            SELECT COALESCE(NULLIF(TRIM(motivo), ''), 'Sin motivo registrado'),
                   COUNT(*), COALESCE(SUM(total), 0)
            FROM devolucion_compra
            GROUP BY 1
            ORDER BY SUM(total) DESC
        """)
        motivos = [{'motivo': r[0], 'devoluciones': int(r[1]), 'monto': float(r[2])}
                   for r in cursor.fetchall()]

    return Response({
        'total_devuelto': round(sum(p['monto_devuelto'] for p in por_proveedor), 2),
        'total_reembolsado': round(sum(p['reembolsado'] for p in por_proveedor), 2),
        'saldo_a_favor_total': round(sum(p['saldo_a_favor'] for p in por_proveedor), 2),
        'num_devoluciones': sum(p['devoluciones'] for p in por_proveedor),
        'por_proveedor': por_proveedor,
        'productos': productos,
        'motivos': motivos,
    })


# ============================================================================
# PRONÓSTICO DE DEMANDA
#
# Responde "qué recomprar, cuándo y cuánto". Reemplaza en la práctica a
# `cantidad_minima`, que es un umbral fijo puesto a mano y no sabe nada de
# velocidad: hoy hay productos que rotan 40% más rápido que otros y tienen el
# umbral más bajo, o sea al revés de lo que debería.
#
# El cálculo es aritmética determinista a propósito. Con 2-3 ventas mensuales
# por producto no hay señal para un modelo estadístico —ni para un LLM— y un
# número que decide cuánta plata inmovilizar tiene que ser auditable y dar lo
# mismo dos veces. La IA se usa aparte (ver `analizar_pronostico_ia`) para lo
# que los datos no pueden contener: estacionalidad local y explicación.
# ============================================================================

# Meses con datos que hacen falta para confiar en un promedio.
_CONFIANZA = ((6, 'alta'), (3, 'media'), (1, 'baja'))

# Se promedia por mes y no por día calendario. Ver `_meses_activos`.
DIAS_POR_MES = 30


def _confianza(meses_con_venta):
    """Qué tan sólido es el promedio de un producto.

    Un producto que vendió una vez en un año no puede mostrar un pronóstico con
    la misma cara que uno que vendió todos los meses. Sin esto, el número más
    frágil se ve idéntico al más firme.
    """
    for minimo, etiqueta in _CONFIANZA:
        if meses_con_venta >= minimo:
            return etiqueta
    return 'sin_datos'


def _meses_activos(cursor, dias):
    """Meses en los que el negocio efectivamente vendió algo, dentro de la ventana.

    Existe por un problema real de estos datos: hay meses completos sin una sola
    venta (el sistema estuvo sin uso). Promediar sobre meses calendario cuenta
    esos ceros como si el local hubiera estado abierto y subestima la demanda
    —con el historial actual, alrededor de un 27%—. Así que el divisor son los
    meses con actividad, no los transcurridos.
    """
    cursor.execute("""
        SELECT DISTINCT to_char(fecha, 'YYYY-MM')
        FROM ventas
        WHERE fecha >= CURRENT_DATE - %s::int
        ORDER BY 1
    """, [dias])
    return [r[0] for r in cursor.fetchall()]


def _plazos_por_proveedor(cursor):
    """Días de entrega por proveedor, con la fuente del dato.

    Tres fuentes en orden de preferencia, y se informa cuál se usó para que
    nadie confunda un supuesto con una medición:

    1. `medido`   — promedio de recepciones reales (hace falta más de una para
                    que un caso raro no defina el plazo).
    2. `estimado` — el campo que carga el usuario en el proveedor.
    3. `default`  — el valor del sistema, cuando no hay ninguno de los dos.
    """
    cursor.execute("""
        SELECT pr.id_proveedor,
               pr.dias_entrega_estimado,
               COUNT(*) FILTER (WHERE oc.fecha_recepcion IS NOT NULL)          AS recibidas,
               AVG((oc.fecha_recepcion AT TIME ZONE %s)::date - oc.fecha_creacion)
                   FILTER (WHERE oc.fecha_recepcion IS NOT NULL)               AS medido
        FROM proveedores pr
        LEFT JOIN orden_compra oc
               ON oc.id_proveedor = pr.id_proveedor
              AND oc.id_estado <> 1          -- las canceladas no dicen nada
        GROUP BY pr.id_proveedor, pr.dias_entrega_estimado
    """, [settings.TIME_ZONE])

    default = int(getattr(settings, 'PRONOSTICO_PLAZO_DEFAULT_DIAS', 15))
    plazos = {}
    for id_prov, estimado, recibidas, medido in cursor.fetchall():
        if recibidas and recibidas >= 2 and medido is not None:
            # Un plazo medido menor a un día se redondearía a 0 y volvería el
            # punto de reorden 0, o sea "nunca pidas".
            plazos[id_prov] = (max(1, int(round(float(medido)))), 'medido')
        elif estimado:
            plazos[id_prov] = (int(estimado), 'estimado')
        else:
            plazos[id_prov] = (default, 'default')
    return plazos, default


@api_view(['GET'])
@permission_classes([IsAdminUser])
def reporte_pronostico_demanda(request):
    """Qué recomprar, cuándo y cuánto, con la confianza de cada número.

    Parámetros: `dias` (ventana de historial, default 365) y `horizonte` (días
    de inventario que se quiere tener después de reponer, default 30).

    No llama a ninguna IA: son cuentas. La interpretación opcional está en
    `analizar_pronostico_ia`, que es otro endpoint para que un proveedor caído o
    sin saldo no pueda tumbar esta pantalla.
    """
    try:
        dias = int(request.GET.get('dias', 365))
    except (ValueError, TypeError):
        dias = 365
    if dias < 30:
        dias = 365

    try:
        horizonte = int(request.GET.get('horizonte', 30))
    except (ValueError, TypeError):
        horizonte = 30
    if horizonte < 1:
        horizonte = 30

    colchon = int(getattr(settings, 'PRONOSTICO_COLCHON_DIAS', 7))

    with connection.cursor() as cursor:
        meses_activos = _meses_activos(cursor, dias)
        plazos, plazo_default = _plazos_por_proveedor(cursor)

        # Unidades por producto y por mes: hace falta el detalle mensual para
        # saber en cuántos meses distintos se vendió (la confianza) y desde
        # cuándo existe el producto.
        cursor.execute("""
            SELECT pv.id_producto, to_char(v.fecha, 'YYYY-MM'), SUM(pv.cantidad)
            FROM producto_venta pv
            JOIN ventas v ON v.id_venta = pv.id_venta
            WHERE v.fecha >= CURRENT_DATE - %s::int
            GROUP BY 1, 2
        """, [dias])
        ventas_mes = {}
        for id_prod, mes, unidades in cursor.fetchall():
            ventas_mes.setdefault(id_prod, {})[mes] = int(unidades or 0)

        # Lo que ya está pedido y no llegó. Sin restarlo, el reporte manda a
        # comprar de nuevo algo que viene en camino: es plata gastada dos veces.
        cursor.execute("""
            SELECT op.id_producto, SUM(op.cantidad)
            FROM orden_producto op
            JOIN orden_compra oc ON oc.id_orden = op.id_orden
            WHERE oc.id_estado = 2                        -- pendiente de recibir
              AND NOT COALESCE(oc.stock_aplicado, false)
            GROUP BY 1
        """)
        en_camino = {r[0]: int(r[1] or 0) for r in cursor.fetchall()}

        cursor.execute("""
            SELECT p.id_producto, p.nombre, p.sku_producto,
                   COALESCE(p.cantidad_actual, 0),
                   COALESCE(p.precio_compra_unitario, 0),
                   COALESCE(p.cantidad_minima, 0),
                   p.id_proveedor, pr.nombre_empresa,
                   u.bodega, u.pasillo, u.estante, u.gaveta
            FROM productos p
            LEFT JOIN proveedores pr ON pr.id_proveedor = p.id_proveedor
            LEFT JOIN ubicacion u ON u.id_ubicacion = p.id_ubicacion
            ORDER BY p.nombre
        """)
        filas = cursor.fetchall()

    productos, sin_historial = [], []
    for (id_prod, nombre, sku, stock, costo, minima, id_prov, proveedor,
         bodega, pasillo, estante, gaveta) in filas:
        stock = int(stock)
        costo = float(costo)
        por_mes = ventas_mes.get(id_prod, {})
        pedido = en_camino.get(id_prod, 0)
        plazo, fuente_plazo = plazos.get(
            id_prov, (plazo_default, 'default'))

        base = {
            'id_producto': id_prod,
            'nombre': nombre,
            'sku': sku,
            'stock': stock,
            'costo': costo,
            'proveedor': proveedor,
            'en_camino': pedido,
            'ubicacion': _codigo_ubicacion(bodega, pasillo, estante, gaveta),
        }

        if not por_mes:
            # Nunca se vendió en la ventana. No se le inventa una demanda de
            # cero disfrazada de pronóstico: va a una lista aparte, porque el
            # motivo puede ser que es nuevo o que nadie lo quiere, y eso lo
            # decide una persona (o el reporte de stock muerto).
            sin_historial.append({**base, 'capital_inmovilizado': round(stock * costo, 2)})
            continue

        # El divisor arranca en el primer mes en que este producto se vendió, no
        # al inicio de la ventana: a un producto que entró hace dos meses no se
        # le puede repartir la demanda entre doce.
        primer_mes = min(por_mes)
        meses_base = [m for m in meses_activos if m >= primer_mes] or [primer_mes]

        unidades = sum(por_mes.values())
        velocidad = unidades / (len(meses_base) * DIAS_POR_MES)

        # Cuánto tarda en reponerse desde que se decide pedir.
        dias_reposicion = plazo + colchon
        punto_reorden = velocidad * dias_reposicion
        # Lo que hay que tener para cubrir la reposición más el horizonte.
        objetivo = velocidad * (dias_reposicion + horizonte)
        sugerido = max(0, math.ceil(objetivo - stock - pedido))

        cobertura = (stock / velocidad) if velocidad > 0 else None

        if stock <= 0:
            urgencia = 'sin_stock'
        elif stock + pedido <= punto_reorden:
            urgencia = 'critico'
        elif cobertura is not None and cobertura <= dias_reposicion + horizonte:
            urgencia = 'proximo'
        else:
            urgencia = 'ok'

        productos.append({
            **base,
            'unidades_vendidas': unidades,
            'meses_con_venta': len(por_mes),
            'meses_base': len(meses_base),
            'velocidad_mensual': round(velocidad * DIAS_POR_MES, 2),
            'dias_cobertura': (round(cobertura) if cobertura is not None else None),
            'plazo_entrega_dias': plazo,
            'fuente_plazo': fuente_plazo,
            'punto_reorden': math.ceil(punto_reorden),
            'cantidad_sugerida': sugerido,
            'inversion': round(sugerido * costo, 2),
            'urgencia': urgencia,
            'confianza': _confianza(len(por_mes)),
            # Para poder contrastar el umbral viejo con el calculado: es lo que
            # muestra si `cantidad_minima` estaba mal puesto.
            'cantidad_minima_actual': int(minima),
        })

    # Primero lo que urge, y dentro de cada nivel lo que más plata mueve.
    orden = {'sin_stock': 0, 'critico': 1, 'proximo': 2, 'ok': 3}
    productos.sort(key=lambda p: (orden[p['urgencia']], -p['inversion']))

    a_recomprar = [p for p in productos if p['cantidad_sugerida'] > 0]
    meses_sin_actividad = []
    if meses_activos:
        # Huecos entre el primer y el último mes con ventas: son los meses que
        # se excluyeron del promedio, y conviene que se vean.
        anio, mes = (int(x) for x in meses_activos[0].split('-'))
        ultimo = meses_activos[-1]
        actual = f'{anio:04d}-{mes:02d}'
        while actual < ultimo:
            mes += 1
            if mes > 12:
                anio, mes = anio + 1, 1
            actual = f'{anio:04d}-{mes:02d}'
            if actual < ultimo and actual not in meses_activos:
                meses_sin_actividad.append(actual)

    return Response({
        'parametros': {
            'dias': dias,
            'horizonte_dias': horizonte,
            'colchon_dias': colchon,
            'plazo_default_dias': plazo_default,
        },
        'contexto': {
            'meses_con_actividad': len(meses_activos),
            'meses_sin_actividad': meses_sin_actividad,
            'primer_mes': meses_activos[0] if meses_activos else None,
            'ultimo_mes': meses_activos[-1] if meses_activos else None,
            # El promedio se calcula sobre meses con actividad; se explicita
            # para que el número no parezca salido de la nada.
            'nota_metodo': (
                'El promedio se calcula sobre los meses que tuvieron ventas, no '
                'sobre los meses transcurridos.'
            ),
        },
        'resumen': {
            'productos_analizados': len(productos),
            'productos_a_recomprar': len(a_recomprar),
            'inversion_sugerida': round(sum(p['inversion'] for p in a_recomprar), 2),
            'sin_stock': sum(1 for p in productos if p['urgencia'] == 'sin_stock'),
            'criticos': sum(1 for p in productos if p['urgencia'] == 'critico'),
            'confianza_baja': sum(1 for p in productos
                                  if p['confianza'] in ('baja', 'sin_datos')),
            'sin_historial': len(sin_historial),
        },
        'productos': productos,
        'sin_historial': sin_historial,
    })


# Lo que se le pide a la IA. Es explícito sobre qué NO debe hacer porque un
# modelo, si se lo dejás, recalcula las cantidades y devuelve números distintos
# a los del reporte: entonces la pantalla mostraría dos verdades.
_INSTRUCCION_IA = """\
Eres asesor de compras de un taller de repuestos de motos en Nicaragua.

Recibís un pronóstico de recompra YA CALCULADO. Tu trabajo es interpretarlo con
conocimiento del mercado nicaragüense, NO recalcularlo.

Reglas estrictas:
- NUNCA propongas cantidades ni corrijas los números que te dan. Ya están
  calculados con el historial real y el plazo de cada proveedor.
- Tu aporte es lo que los datos NO pueden saber: estacionalidad local
  (temporada lluviosa de mayo a octubre desgasta frenos, cadenas y llantas; la
  seca de noviembre a abril ensucia filtros de aire por el polvo; diciembre
  mueve accesorios y mantenimiento previo a viajes; el inicio de clases sube el
  uso de motos de bajo cilindraje), y agrupar productos que conviene pedir
  juntos.
- Si un producto viene marcado con confianza baja o sin_datos, decilo en vez de
  opinar como si el número fuera firme.
- Escribí en español de Nicaragua, claro y corto. Nada de jerga técnica ni de
  fórmulas.

Respondé SOLO un objeto JSON con esta forma exacta, sin texto alrededor y sin
bloques de código:
{
  "resumen": "2 o 3 oraciones sobre la situación general de recompra",
  "estacionalidad": "qué se viene en las próximas semanas según la época del año",
  "notas": [
    {"producto": "nombre exacto tal como te lo pasaron",
     "nota": "una oración de contexto o advertencia"}
  ],
  "agrupaciones": [
    {"titulo": "por qué van juntos", "productos": ["nombre", "nombre"]}
  ]
}
Como máximo 8 notas: las que más aporten. Si algo no aplica, devolvé lista vacía."""


@api_view(['POST'])
@permission_classes([IsAdminUser])
def analizar_pronostico_ia(request):
    """Le pide al proveedor de IA activo que interprete el pronóstico.

    Va aparte del reporte a propósito: así la pantalla muestra sus números al
    instante y esto llega después. Si el proveedor está caído, lento o sin
    saldo, el pronóstico sigue sirviendo — la IA solo agrega notas.

    Sobre privacidad: se le manda **nombre de producto, cantidades y meses**.
    Ningún dato de cliente sale del sistema; no hace falta para esto.
    """
    config = ConfiguracionIA.objects.filter(activo=True).first()
    if not config or not config.api_key:
        return Response({
            'error': 'No hay proveedor de IA activo. Configuralo en Configuración.',
        }, status=status.HTTP_409_CONFLICT)
    if not config.modelo:
        return Response({
            'error': f'{config.nombre_proveedor} no tiene modelo elegido.',
        }, status=status.HTTP_409_CONFLICT)

    productos = request.data.get('productos') or []
    if not isinstance(productos, list) or not productos:
        return Response({'error': 'No hay productos que analizar.'},
                        status=status.HTTP_400_BAD_REQUEST)

    contexto = request.data.get('contexto') or {}

    # Se recorta a lo que de verdad hace falta: los que urgen. Mandar 75
    # productos costaría tokens sin mejorar el consejo, y un prompt largo
    # diluye la respuesta.
    recorte = []
    for p in productos[:25]:
        if not isinstance(p, dict):
            continue
        recorte.append({
            'producto': str(p.get('nombre', ''))[:120],
            'stock': p.get('stock'),
            'vende_por_mes': p.get('velocidad_mensual'),
            'dias_de_cobertura': p.get('dias_cobertura'),
            'sugerido': p.get('cantidad_sugerida'),
            'urgencia': p.get('urgencia'),
            'confianza': p.get('confianza'),
            'meses_con_venta': p.get('meses_con_venta'),
        })
    if not recorte:
        return Response({'error': 'Los productos enviados no tienen forma válida.'},
                        status=status.HTTP_400_BAD_REQUEST)

    hoy = timezone.localdate()
    prompt = json.dumps({
        'fecha_de_hoy': hoy.isoformat(),
        'mes_actual': hoy.strftime('%B'),
        'meses_con_datos': contexto.get('meses_con_actividad'),
        'meses_sin_actividad': contexto.get('meses_sin_actividad'),
        'productos': recorte,
    }, ensure_ascii=False)

    datos, error = preguntar_json(config, _INSTRUCCION_IA, prompt)
    if error:
        # 502: el fallo es del proveedor externo, no de esta petición. Importa
        # para que el frontend lo muestre como "la IA no pudo" y no como un
        # error del pronóstico.
        return Response({'error': error, 'proveedor': config.nombre_proveedor},
                        status=status.HTTP_502_BAD_GATEWAY)

    # Se normaliza lo que vino: el modelo puede omitir campos o cambiar tipos, y
    # el frontend no debería tener que defenderse de eso.
    notas = []
    for n in (datos.get('notas') or [])[:8]:
        if isinstance(n, dict) and n.get('producto') and n.get('nota'):
            notas.append({'producto': str(n['producto'])[:120],
                          'nota': str(n['nota'])[:400]})

    agrupaciones = []
    for g in (datos.get('agrupaciones') or [])[:5]:
        if isinstance(g, dict) and isinstance(g.get('productos'), list):
            agrupaciones.append({
                'titulo': str(g.get('titulo', ''))[:120],
                'productos': [str(x)[:120] for x in g['productos'][:8]],
            })

    return Response({
        'resumen': str(datos.get('resumen', ''))[:1000],
        'estacionalidad': str(datos.get('estacionalidad', ''))[:1000],
        'notas': notas,
        'agrupaciones': agrupaciones,
        'proveedor': config.nombre_proveedor,
        'modelo': config.modelo,
        'analizados': len(recorte),
    })
