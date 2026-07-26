# Changelog

<div align="center">

[![Version](https://img.shields.io/badge/version-1.8.1-4F46E5?style=flat-square)](#181---2026-07-26)
[![Keep a Changelog](https://img.shields.io/badge/Keep%20a%20Changelog-1.1.0-orange?style=flat-square)](https://keepachangelog.com/es-ES/1.1.0/)
[![Semantic Versioning](https://img.shields.io/badge/semver-2.0.0-blue?style=flat-square)](https://semver.org/lang/es/)

</div>

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

---

## [1.8.1] - 2026-07-26

### Fixed

- **Los logs de auditoría atribuían todos los cambios a `postgres`.** El registro de cambios de productos lo escribe un disparador de la base de datos, que solo conoce el usuario con el que se conecta el sistema, no la persona que hizo el cambio. Ahora cada registro guarda **el nombre de la cuenta que lo hizo** y su dirección IP, así que el historial sirve para saber quién tocó un precio o un stock.
- Los cambios hechos por fuera del sistema (scripts, mantenimiento directo a la base) se identifican como **"sistema"** en vez de mostrar un nombre que parezca una persona.
- La atribución no se contagia entre sesiones: el sistema reutiliza conexiones a la base de datos, así que se limpia el contexto en cada petición para que a nadie se le carguen cambios de otro.

---

## [1.8.0] - 2026-07-25

### Added

- **Devoluciones de productos a proveedores:** nueva pestaña en Devoluciones para registrar la mercadería que se le manda de vuelta a un proveedor. Saca el stock del inventario con su movimiento correspondiente y **baja lo que se le debe por esa compra**: hasta ahora no había forma de registrarlo, así que el sistema seguía contando piezas que ya no estaban y seguía debiendo el dinero de algo que se había devuelto.
- **Saldo a favor:** si la compra ya estaba pagada, lo devuelto queda registrado como deuda del proveedor hacia el negocio y se muestra como **"te debe"** en el detalle de la compra, en vez de un saldo negativo confuso.
- **Reembolso en efectivo:** se puede registrar que el proveedor devolvió el dinero. Si es en efectivo entra al cajón (requiere caja abierta) y sube el efectivo esperado del turno; es el único movimiento con proveedores que suma dinero a la caja.
- **Doble validación de cantidades:** no se puede devolver más de lo que el proveedor entregó en esa compra (descontando lo ya devuelto) **ni más de lo que hay físicamente en inventario**. Si llegaron 10 y se vendieron 8, no se pueden devolver 5 porque no están. El formulario muestra el máximo devolvible por producto en vez de dejar escribir una cantidad que va a ser rechazada.
- **Reporte de devoluciones por proveedor**, con la tasa de devolución sobre lo comprado, los productos que más se devuelven y los motivos. Es lo que dice a quién le llega mercadería con problemas: un proveedor barato al que hay que devolverle una parte de lo que manda no es barato.
- Tablas nuevas `devolucion_compra` y `producto_devolucion_compra` (migración `0021`, aditiva).

### Fixed

- **Se podía pagar de más por mercadería devuelta:** el saldo pendiente de una compra se calculaba como total menos pagado, sin descontar lo devuelto, así que el sistema aceptaba pagos por productos que ya se habían mandado de vuelta.

---

## [1.7.0] - 2026-07-25

### Added

- **Comparación de precios entre proveedores:** nueva página "Análisis proveedores" que muestra a qué precio le vendió cada proveedor el mismo producto, y sobre todo las **oportunidades de ahorro**: los productos donde el proveedor asignado no es el que lo dio más barato, con el ahorro por unidad. Los precios salen del historial de compras, así que la comparación se alimenta sola con el uso normal: no hay ningún catálogo de precios que alguien tenga que mantener.
- **Aviso de mejor precio al momento de comprar:** al agregar un producto a una orden de compra, el sistema avisa a qué precio se lo compró antes a ese proveedor y, si otro lo vendió más barato, lo dice con la diferencia. Es el único punto donde la información sirve para cambiar la decisión, porque el buscador de productos del formulario está filtrado por proveedor y la competencia no se ve por ningún lado.
- **Desempeño de proveedores:** tiempo promedio de entrega (con su rango), monto comprado, productos que provee, saldo que se le debe y última compra. Se destaca el más rápido y el más lento.
- **Fecha de entrega prometida** (opcional) al crear una orden de compra. Es contra esa fecha que se mide la puntualidad: mientras no se registre ninguna, el reporte muestra la velocidad de entrega y **declara que la puntualidad no es calculable**, en vez de informar un cumplimiento del 100% que no significa nada.
- **Precios por proveedor en la ficha del producto**, para ver de un vistazo a quién conviene comprarle.
- Comando `seed_proveedores_demo` para generar historial de compras de demostración y poder evaluar estas pantallas con datos. Se niega a correr contra la base de producción y sabe deshacer con exactitud lo que creó (`--limpiar` revierte el stock que sumó).
- Columnas `fecha_recepcion` y `fecha_esperada` en `orden_compra` (migración `0020`, aditiva).

### Fixed

- **No se registraba cuándo llegaba la mercadería.** La recepción guardaba que la orden se había recibido pero no la fecha, así que era imposible medir cuánto tardaba cada proveedor en entregar. Ahora la recepción registra la fecha y el tiempo de entrega queda calculado.
- **Error de un día en el tiempo de entrega:** la fecha de recepción se guarda con zona horaria y se comparaba contra una fecha local, así que toda mercadería recibida después de las 6 de la tarde contaba un día extra y hacía ver a los proveedores más lentos de lo que fueron.
- **"Último precio" indefinido con dos compras el mismo día:** al comparar precios, el precio más reciente de un proveedor se ordenaba solo por fecha, así que dos compras al mismo proveedor en un mismo día dejaban el resultado a criterio del motor de base de datos.

---

## [1.6.1] - 2026-07-25

### Fixed

- **Recibir una orden de compra no sumaba el stock.** La acción solo cambiaba el estado de la orden: la mercadería entraba a la bodega y el inventario nunca se enteraba. Peor aún, la pantalla anunciaba "Orden completada — stock actualizado", así que el sistema afirmaba haber hecho algo que no hizo. Ahora recibir suma la cantidad de cada línea al inventario y deja su movimiento de entrada, todo en una sola transacción y con guarda para que recibir dos veces no sume doble.
- El botón "Marcar como recibida" llamaba a *confirmar*, mientras que la acción *recibir* nunca se invocaba desde ninguna parte. Se unificaron: ambos caminos reciben la mercadería y suman el stock, y el botón ahora dice claramente **"Recibir y sumar al inventario"**.
- **Órdenes sin cantidades registradas:** las creadas antes de que el sistema guardara la cantidad por línea no se pueden recibir, porque no hay forma de saber cuánto sumar. Antes esto habría sido un "recibido" silencioso que no movía nada; ahora se avisa en el detalle de la orden y se explica el motivo.
- Las órdenes que ya figuraban como recibidas de antes muestran que **su stock no quedó registrado** en el inventario, en vez de afirmar lo contrario.

---

## [1.6.0] - 2026-07-25

### Added

- **Ubicación física de productos:** nueva página "Ubicaciones" para registrar los lugares donde se guarda el inventario (bodega, pasillo, estante y gaveta) y ver cuántos productos y cuánto valor hay en cada uno. La ubicación aparece en el listado de productos, se puede filtrar por ella, y hay un filtro de "sin ubicar" para saber cuánto falta por acomodar.
- **Asignación en lote:** se pueden seleccionar varios productos del listado y ubicarlos todos de una vez, en vez de entrar a cada ficha. Es lo que hace viable acomodar el inventario completo de una sentada.
- **Conteo físico:** nueva hoja de conteo imprimible, **ordenada por ubicación** para poder recorrer la tienda estante por estante en vez de ir saltando de un lado a otro. Se anota lo contado, se ve en vivo qué cuadra y qué no con su impacto en córdobas, y al aplicar se ajusta el inventario de una sola pasada. Solo se ajustan los productos con diferencia (los que cuadran no ensucian la bitácora de movimientos), y cada ajuste queda registrado con la referencia del conteo. Antes esto era impracticable: el ajuste de inventario corregía un producto a la vez, así que contar todo el inventario significaba llenar un formulario por producto.
- **La ubicación en el POS:** al buscar un repuesto, el vendedor ve dónde está guardado sin salir del mostrador. También aparece en el reporte de stock muerto, que es justo el listado de lo que hay que ir a buscar para liquidar.
- Tabla nueva `ubicacion` y columna `id_ubicacion` en `productos` (migración `0018`, aditiva).

---

## [1.5.0] - 2026-07-25

### Added

- **Presupuestos de reparación:** desde una orden de trabajo en diagnóstico se le puede presupuestar al cliente el arreglo, con las operaciones de mano de obra (tomadas del catálogo de servicios) y los repuestos que llevaría. Los repuestos presupuestados **no salen del inventario** hasta que el cliente aprueba: cotizar algo y descontarlo en el mismo paso vaciaría la bodega con trabajos que nunca se autorizan.
- **La aprobación del cliente ahora autoriza la reparación:** una orden con presupuesto pendiente o rechazado no puede pasar a "en reparación". Al aprobar, la mano de obra y los repuestos se cargan a la orden de trabajo (descontando stock) de forma atómica: si falta una pieza, la aprobación falla completa en vez de dejar la orden a medio cargar. Las órdenes sin presupuesto se siguen pudiendo reparar, porque un trabajo chico no necesita uno.
- **PDF del presupuesto**, listo para mandarle al cliente: datos de la moto (marca, modelo, placa, kilometraje), el diagnóstico que justifica el precio, mano de obra y repuestos en secciones separadas con su subtotal, total, validez y **espacio de firma de autorización**. Reutiliza el generador de PDF que ya existía para las proformas.
- **Aviso por WhatsApp** al cliente de que su presupuesto o cotización está listo, con el monto y la validez ya escritos en el mensaje.
- Las cotizaciones ahora distinguen entre **proforma de productos** y **presupuesto de reparación**, con filtro por tipo en el listado. Tabla nueva `servicio_cotizacion` para las líneas de mano de obra (migración `0017`, aditiva).

### Fixed

- **Deudas invisibles en Cuentas por Cobrar:** el reporte solo muestra ventas con saldo pendiente mayor a cero, y varias partes del sistema creaban la venta sin calcular ese saldo, dejándolo vacío. El resultado es que una **venta al crédito no aparecía en el reporte** hasta que alguien le registrara un pago — justo al revés de lo que debería pasar. Se corrigió en el alta de ventas y en la conversión de cotizaciones, y la migración recalcula las ventas afectadas (**C$1,252.50** que faltaban en el reporte).
- **Mano de obra que desaparecía del saldo de una venta de taller:** el total de una venta se recalculaba sumando solo sus líneas de producto, y la mano de obra no puede vivir ahí. Una venta de C$250 (C$150 de trabajo + C$100 de piezas) se daba por pagada al abonar C$100, y el detalle mostraba líneas que no cuadraban con el total. Ahora el total suma la mano de obra de la orden de trabajo ligada.
- **Convertir una cotización en venta fallaba siempre** con un error de servidor por una referencia sin importar. La función nunca había funcionado (de ahí que no hubiera ni una sola cotización convertida en producción).

---

## [1.4.0] - 2026-07-25

### Added

- **Agenda interna del taller:** nueva página "Taller" con un tablero por estado (Agendada → Recibida → En diagnóstico → En reparación → Esperando repuesto → Lista) donde se arrastra la tarjeta para avanzar el trabajo. Hasta ahora un servicio solo existía en el sistema cuando ya había terminado: no había estado, ni cita, ni mecánico asignado, ni forma de ver qué había en el taller en ese momento.
- **Órdenes de trabajo con ciclo de vida:** cada servicio lleva estado, fecha de cita, mecánico asignado (antes era un número suelto sin relación real y un campo de texto libre), kilometraje y fecha de entrega.
- **Repuestos que descuentan inventario:** los repuestos que consume una reparación se registran en la orden y descuentan stock con su movimiento de inventario, y se restituyen si se quitan. Antes los repuestos usados en el taller no descontaban stock en ninguna parte, así que el inventario quedaba inflado.
- **Facturación al entregar:** al entregar se genera una única venta con la mano de obra más los repuestos, itemizada, que queda pendiente de cobro por el flujo normal (con su requisito de caja abierta).
- **Bitácora empujada por el estado:** avanzar la orden es lo que llena la bitácora (recepción, diagnóstico, reparación, entrega). El formulario manual se abandonaba: de los registros históricos, ninguno llegó a reparación ni a entrega.
- **Catálogo de tipos de servicio** administrable, con precio de mano de obra, derivado del propio historial del taller. El precio se congela al agendar, para que un cambio de tarifa no altere órdenes ya abiertas.
- **Mantenimiento preventivo:** nueva página "Preventivo" que lista las motos a las que ya toca revisión, con recordatorio por WhatsApp al cliente.
- Reportes nuevos de **carga del taller** (por mecánico y tiempo promedio por estado) y de **mantenimiento preventivo**.
- Tabla nueva `servicio_repuesto` y campos de ciclo de vida en `servicio_motos` (migración `0016`, aditiva).

### Fixed

- **Doble facturación y vínculo perdido en los servicios de taller:** registrar un servicio creaba una venta automáticamente, pero sin guardar a qué servicio correspondía. El vínculo se reconstruía adivinando por fecha + monto + cliente, lógica duplicada en el reporte de ventas y en el detalle de la venta: dos servicios del mismo cliente, el mismo día y por el mismo monto se confundían entre sí, y editar el monto rompía la relación en silencio. Ahora la venta se genera una sola vez al entregar y la referencia queda guardada; la migración recupera el vínculo de los servicios históricos que se pueden identificar sin ambigüedad.

---

## [1.3.0] - 2026-07-24

### Added

- **Cuentas por pagar a proveedores:** nueva página "Cuentas x Pagar" que muestra, por antigüedad de la deuda (0-30 / 31-60 / 61-90 / +90 días), cuánto le debe el negocio a cada proveedor por mercadería recibida y aún no cancelada — el espejo de las cuentas por cobrar. Es el rastreo de un pasivo, no un gasto operativo, por lo que no pasa por el módulo de Gastos (evita doble conteo del costo de ventas).
- **Registro de pagos a órdenes de compra:** desde el detalle de una compra se pueden registrar abonos (total o parcial) con método de pago, referencia y notas; la orden lleva `monto_pagado`, `saldo_pendiente` y `estado_pago` (por pagar / parcial / pagado), visible también como columna en el listado de compras.
- **Integración de pagos a proveedor con la caja:** un pago en efectivo a un proveedor sale del cajón y reduce el efectivo esperado del turno (requiere caja abierta), igual que un gasto en efectivo. Los pagos por transferencia/cheque/depósito no tocan la caja. Cualquier usuario autenticado puede registrar un pago (para que el arqueo cuadre); crear/confirmar/recibir órdenes sigue siendo admin.
- Tabla nueva `pago_compra` y columnas `monto_pagado` / `saldo_pendiente` / `estado_pago` en `orden_compra` (migración `0015`, aditiva).

### Fixed

- **Total de las órdenes de compra:** ahora el detalle de compra guarda la **cantidad** y el **precio unitario** de cada línea, y el total se calcula como Σ (cantidad × precio) en vez de sumar solo el precio de compra vigente de cada producto ignorando las cantidades. Las órdenes históricas (sin ese dato) quedan con total 0 porque el dato nunca se guardó y no es reconstruible.

---

## [1.2.0] - 2026-07-24

### Added

- **Control de gastos operativos:** nueva página "Gastos" (admin) para registrar los costos de operar el negocio (alquiler, servicios, salarios, etc.) con categorías editables, distintos de las compras de mercadería. Incluye un **estado de resultados** por rango de fechas: ingresos − costo de ventas = utilidad bruta − gastos operativos = **utilidad neta**, con desglose de gastos por categoría.
- **Integración de gastos con la caja:** un gasto pagado en efectivo sale del cajón y reduce el efectivo esperado del turno (y requiere caja abierta), igual que las ventas en efectivo lo aumentan. Los gastos por transferencia/cheque/tarjeta solo se registran para el P&L y no tocan la caja.
- Tablas nuevas `categoria_gasto` y `gasto` (migración `0014`, aditiva).

---

## [1.1.0] - 2026-07-24

### Added

- **Apertura y cierre de caja (turnos de caja):** nueva página "Caja" para abrir un turno con un fondo inicial, registrar retiros/ingresos de efectivo, y cerrar cuadrando el efectivo contado contra el que el sistema calcula (detecta faltantes/sobrantes). Solo puede haber una caja abierta a la vez (garantizado a nivel de base de datos). El historial de turnos con sus diferencias es visible para administradores.
- El POS ahora tiene **selector de método de pago** (efectivo/tarjeta/transferencia/depósito/cheque). Solo el efectivo cuenta para el cuadre de caja.
- Tablas nuevas `sesion_caja` y `movimiento_caja`, y columna `id_sesion` en `pagos_venta` para vincular cada cobro a su turno (migración `0013`, aditiva).

### Changed

- **No se puede cobrar en el POS sin una caja abierta** — el botón de cobro se bloquea y se muestra un aviso con enlace a la página de Caja. La validación también se aplica en el backend al registrar cualquier pago.

---

## [1.0.2] - 2026-07-24

### Fixed

- Corregido el dominio del backend en la `Content-Security-Policy` y en `VITE_API_URL` de `vercel.json`: apuntaban a `api-inventrix.eclipze.dev` (dominio viejo) en vez de `api.inventrix.eclipzedev.com`, lo que hacía que el navegador bloqueara todas las llamadas a la API en producción antes de siquiera llegar a CORS.

---

## [1.0.1] - 2026-07-24

### Fixed

- Revertido `SECURE_SSL_REDIRECT=True` (introducido en 1.0.0), que rompió producción: Dokploy/Traefik no reenvía `X-Forwarded-Proto` de forma que Django lo detecte de forma fiable, así que Django respondía `301` a toda petición — incluidos los preflight `OPTIONS` de CORS, bloqueando el login y toda la API. Traefik ya fuerza HTTPS en el borde; el resto de los flags de seguridad (HSTS, cookies seguras) se mantienen sin cambios.

---

## [1.0.0] - 2026-07-24

Primera versión formalmente etiquetada del proyecto: cierra la mitigación completa
de los riesgos críticos y altos identificados en `RIESGOS_SISTEMA.txt`, unifica el
control del esquema de base de datos bajo migraciones Django, y completa el backlog
de endurecimiento de seguridad de `FIXES_SEGURIDAD.md`.

### Added

- Toggle de modo oscuro en la pantalla de login.
- Respaldo automático programado de la base de datos (`manage.py backup_db`), con retención configurable y subida redundante a Cloudflare R2; servicio dedicado en `docker-compose.yml` / `docker-compose.prod.yml`.
- Suite de tests de integración (`backend/api/tests.py`) para los flujos críticos: ventas y descuento de stock, pagos/saldos, ajustes de inventario, devoluciones, permisos por rol y los endpoints de marcas/categorías.
- Pipeline de CI (`.github/workflows/backend-ci.yml`) que bootstrapea la base de datos híbrida y corre la suite de tests en cada push/PR.
- Cifrado en reposo (Fernet/AES) para teléfono y email de clientes y proveedores (`backend/inventory/encryption.py`), con comando de migración de datos existentes (`encrypt_contact_fields`).
- Snapshot de esquema versionado (`backend/SQL_FILES/000_base_schema_snapshot.sql`) para poder levantar una base de datos de pruebas idéntica a producción.
- Migraciones Django (`0007`–`0012`) que unifican el control del esquema históricamente gestionado por SQL directo (`managed=False`) bajo migraciones reales.
- Permisos por rol (`backend/api/permissions.py`, `IsAdminOrReadOnly`): acciones destructivas de catálogo/inventario (borrar productos/clientes/proveedores, importar, ajustar stock, gestionar compras) quedan restringidas a administradores.
- Validación de devoluciones contra lo realmente vendido en la venta referenciada (no se puede devolver más de lo vendido ni un producto no vendido).
- Guard de "último administrador" también en `update` (no se puede quitar `is_staff`/`is_active` al último admin activo).
- Flags de seguridad de producción en Django (`SECURE_SSL_REDIRECT`, HSTS, cookies seguras, `CSRF_TRUSTED_ORIGINS`).

### Changed

- El login distingue ahora entre credenciales inválidas (401/400), rate limit (429) y errores de conexión/servidor, en vez de mostrar siempre "usuario o contraseña incorrectos".
- Crear una venta ahora descuenta stock de forma atómica (con validación de stock suficiente) y registra el movimiento de inventario correspondiente; antes las ventas no afectaban el inventario.
- La acción de cancelar una orden de venta restituye el stock vendido y elimina la venta y sus pagos asociados.
- `docker-compose.yml` ya no crea un superusuario `admin/admin123` por defecto.
- Redis pasa a ser obligatorio en producción (antes opcional, lo que producía caché inconsistente entre workers de Gunicorn).
- Las credenciales de Cloudflare R2 se validan de forma estricta (fail-fast) en producción.
- Actualizadas dependencias del frontend con vulnerabilidades conocidas: `jspdf` (3 a 4.2.1), `react-router-dom` (7.13 a 7.18), y overrides de `lodash`, `tmp` y `form-data` a versiones parcheadas.
- Reducido el tiempo de vida del access token JWT (60 a 30 min) y el límite de throttle por usuario (1000 a 500/min).
- `CORS_ALLOW_CREDENTIALS` desactivado (la autenticación va por header JWT, no por cookies).

### Fixed

- Corregido el bug en vivo por el que `/api/marcas/` y `/api/categorias/` devolvían error 500 (las tablas nunca se habían creado físicamente pese a que Django las daba por existentes).
- Corregidas las acciones "completar"/"cancelar" de orden de venta, que fallaban por depender de código legado (`services.py`) incompatible con el esquema real de la base de datos.
- Quitado el flag `--reload` de Gunicorn en el entrypoint de producción.
- Corregido el conflicto de puerto 80 entre los servicios `frontend` y `nginx` en `docker-compose.prod.yml`.
- Corregida una fuga de datos en los reportes financieros: `@cache_page` cacheaba la respuesta por URL sin distinguir usuario, sirviendo una respuesta de administrador a un usuario sin permisos.

### Security

- Restringido `/api/backup/`, los 7 endpoints de reportes financieros y `/api/auditoria-productos/` a usuarios administradores (antes accesibles para cualquier usuario autenticado).
- De 44 vulnerabilidades conocidas en dependencias del frontend (2 críticas, 14 altas) a 1 moderada.

### Removed

- Eliminado código muerto: modelos `DetalleOrdenCompra` / `DetalleOrdenVenta` (tablas inexistentes en la base de datos real), el archivo `backend/api/services.py` completo y sus serializers asociados.
- Eliminada documentación obsoleta o redundante en la raíz del repositorio (bitácoras de features ya implementadas y guías desactualizadas).
