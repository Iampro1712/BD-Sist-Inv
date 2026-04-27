-- 8. Consultas SQL
-- Realizar al menos 10 consultas, incluyendo:
-- SELECT básico, WHERE, JOIN, funciones agregadas, GROUP BY, ORDER BY, subconsulta, condiciones múltiples, UPDATE/DELETE

-- 1. SELECT básico
-- Obtener todos los productos registrados
SELECT * FROM productos;

-- 2. SELECT con WHERE
-- Obtener los productos con stock bajo (menos de 20 unidades)
SELECT * FROM productos 
WHERE cantidad_actual < 20;

-- 3. SELECT con JOIN
-- Obtener el nombre del cliente, la marca y modelo de su moto
SELECT c.nombre AS Cliente, m.marca, m.modelo, m.placa
FROM cliente c
JOIN motos m ON c.id_cliente = m.id_cliente;

-- 4. SELECT con funciones agregadas (COUNT, AVG)
-- Contar cuántas motos hay por marca y el costo promedio de los servicios registrados
SELECT COUNT(*) as total_motos FROM motos;

SELECT AVG(costo) as costo_promedio_servicio FROM servicio_motos;

-- 5. GROUP BY y ORDER BY
-- Obtener la cantidad de motos por marca, ordenadas de mayor a menor
SELECT marca, COUNT(*) as cantidad
FROM motos
GROUP BY marca
ORDER BY cantidad DESC;

-- 6. Una subconsulta
-- Obtener los productos cuyo precio final es mayor al precio promedio de todos los productos
SELECT nombre, precio_final
FROM productos
WHERE precio_final > (SELECT AVG(precio_final) FROM productos);

-- 7. Consulta con condiciones múltiples
-- Obtener servicios realizados en los últimos 60 días con un costo mayor a 600
SELECT * 
FROM servicio_motos
WHERE fecha_servicio >= CURRENT_DATE - 60 
AND costo > 600.00;

-- 8. Alguna actualización (UPDATE)
-- Aumentar el precio final de todos los productos en un 5%
UPDATE productos
SET precio_final = precio_final * 1.05;

-- 9. Alguna eliminación (DELETE)
-- Eliminar un servicio específico (por ejemplo, uno creado por error)
-- Nota: Se usa un ID hipotético para el ejemplo
DELETE FROM servicio_motos
WHERE id_servicio = 9999;

-- 10. Consulta compleja con múltiples JOINS y agregación
-- Obtener el total gastado en servicios por cada cliente
SELECT c.nombre, SUM(sm.costo) as total_gastado
FROM cliente c
JOIN motos m ON c.id_cliente = m.id_cliente
JOIN servicio_motos sm ON m.id_moto = sm.id_moto
GROUP BY c.nombre
ORDER BY total_gastado DESC;
