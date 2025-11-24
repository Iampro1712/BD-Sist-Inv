"""
Vistas para reportes del sistema
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection
from decimal import Decimal


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
        
        # Total de compras
        cursor.execute(f"""
            SELECT COUNT(*), COALESCE(SUM(
                (SELECT SUM(p.precio_compra_unitario)
                 FROM orden_producto op
                 INNER JOIN productos p ON p.id_producto = op.id_producto
                 WHERE op.id_orden = oc.id_orden)
            ), 0)
            FROM orden_compra oc
            {where_clause}
        """, params)
        
        result = cursor.fetchone()
        numero_ordenes = result[0]
        total_compras = float(result[1]) if result[1] else 0
        compra_promedio = total_compras / numero_ordenes if numero_ordenes > 0 else 0
        
        # Compras por proveedor
        cursor.execute(f"""
            SELECT 
                pr.nombre_empresa as proveedor,
                COALESCE(SUM(
                    (SELECT SUM(p.precio_compra_unitario)
                     FROM orden_producto op
                     INNER JOIN productos p ON p.id_producto = op.id_producto
                     WHERE op.id_orden = oc.id_orden)
                ), 0) as total
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
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
        
        # Listado de órdenes
        cursor.execute(f"""
            SELECT 
                oc.id_orden as numero_orden,
                pr.nombre_empresa as proveedor,
                oc.fecha_creacion as fecha,
                (SELECT SUM(p.precio_compra_unitario)
                 FROM orden_producto op
                 INNER JOIN productos p ON p.id_producto = op.id_producto
                 WHERE op.id_orden = oc.id_orden) as total,
                CASE 
                    WHEN oc.id_estado = 1 THEN 'cancelada'
                    WHEN oc.id_estado = 2 THEN 'pendiente'
                    WHEN oc.id_estado = 3 THEN 'recibida'
                    ELSE 'desconocido'
                END as estado
            FROM orden_compra oc
            INNER JOIN proveedores pr ON pr.id_proveedor = oc.id_proveedor
            {where_clause}
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
