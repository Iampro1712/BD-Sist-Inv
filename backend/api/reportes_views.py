"""
Vistas para reportes del sistema
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection
from django.views.decorators.cache import cache_page
from decimal import Decimal

# TTL de caché para reportes (segundos). Tolera datos ligeramente añejos a
# cambio de evitar recomputar consultas pesadas en cada carga.
REPORTE_CACHE_TTL = 60


@cache_page(REPORTE_CACHE_TTL)
@api_view(['GET'])
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


@cache_page(REPORTE_CACHE_TTL)
@api_view(['GET'])
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
                'estado': 'confirmada'
            })
    
    return Response({
        'total_ventas': total_ventas,
        'numero_ordenes': numero_ordenes,
        'ticket_promedio': ticket_promedio,
        'por_cliente': por_cliente,
        'ordenes': ordenes
    })


@cache_page(REPORTE_CACHE_TTL)
@api_view(['GET'])
def reporte_compras(request):
    """Genera reporte de compras por rango de fechas"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    proveedor_id = request.GET.get('proveedor')

    if not fecha_inicio or not fecha_fin:
        return Response({'error': 'Debe proporcionar fecha_inicio y fecha_fin'}, status=400)

    with connection.cursor() as cursor:
        # Construir query base
        where_clause = "WHERE oc.fecha_creacion BETWEEN %s AND %s"
        params = [fecha_inicio, fecha_fin]

        if proveedor_id:
            where_clause += " AND oc.id_proveedor = %s"
            params.append(proveedor_id)

        # Total de compras: un único JOIN agregado en lugar de subconsultas
        # correlacionadas por fila. El LEFT JOIN preserva órdenes sin líneas.
        cursor.execute(f"""
            SELECT COUNT(DISTINCT oc.id_orden),
                   COALESCE(SUM(p.precio_compra_unitario), 0)
            FROM orden_compra oc
            LEFT JOIN orden_producto op ON op.id_orden = oc.id_orden
            LEFT JOIN productos p ON p.id_producto = op.id_producto
            {where_clause}
        """, params)

        result = cursor.fetchone()
        numero_ordenes = result[0]
        total_compras = float(result[1]) if result[1] else 0
        compra_promedio = total_compras / numero_ordenes if numero_ordenes > 0 else 0

        # Compras por proveedor (mismo JOIN agregado)
        cursor.execute(f"""
            SELECT
                pr.nombre_empresa as proveedor,
                COALESCE(SUM(p.precio_compra_unitario), 0) as total
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
            LEFT JOIN orden_producto op ON op.id_orden = oc.id_orden
            LEFT JOIN productos p ON p.id_producto = op.id_producto
            {where_clause}
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

        # Listado de órdenes (total por orden vía GROUP BY, sin subconsultas)
        cursor.execute(f"""
            SELECT
                oc.id_orden as numero_orden,
                pr.nombre_empresa as proveedor,
                oc.fecha_creacion as fecha,
                COALESCE(SUM(p.precio_compra_unitario), 0) as total,
                CASE
                    WHEN oc.id_estado = 1 THEN 'cancelada'
                    WHEN oc.id_estado = 2 THEN 'pendiente'
                    WHEN oc.id_estado = 3 THEN 'recibida'
                    ELSE 'desconocido'
                END as estado
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
            LEFT JOIN orden_producto op ON op.id_orden = oc.id_orden
            LEFT JOIN productos p ON p.id_producto = op.id_producto
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
        'por_proveedor': por_proveedor,
        'ordenes': ordenes
    })


@cache_page(REPORTE_CACHE_TTL)
@api_view(['GET'])
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
                'telefono': r[3],
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
                  WHERE pv.id_producto = p.id_producto) AS ultima_venta
            FROM productos p
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
            })

    return Response({
        'dias': dias,
        'num_productos': len(productos),
        'capital_inmovilizado_total': round(capital_total, 2),
        'productos': productos,
    })
