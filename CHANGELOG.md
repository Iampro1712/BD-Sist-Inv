# Changelog

<div align="center">

[![Version](https://img.shields.io/badge/version-1.12.0-4F46E5?style=flat-square)](#1120---2026-08-03)
[![Keep a Changelog](https://img.shields.io/badge/Keep%20a%20Changelog-1.1.0-orange?style=flat-square)](https://keepachangelog.com/es-ES/1.1.0/)
[![Semantic Versioning](https://img.shields.io/badge/semver-2.0.0-blue?style=flat-square)](https://semver.org/lang/es/)

</div>

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

---

## [1.12.0] - 2026-08-03

### Added

- **El servidor ahora distribuye las actualizaciones de la aplicación de
  escritorio.** Dos endpoints nuevos, `/api/desktop/version/` y
  `/api/desktop/descargar/`, le dicen a la app de escritorio si hay una versión
  más nueva y de dónde bajarla. Antes había que copiar el programa a mano en cada
  equipo del taller; ahora los equipos se actualizan solos.

  El repositorio de la aplicación de escritorio es privado, así que el servidor
  hace de intermediario: guarda la credencial de acceso y la app no necesita
  llevar ninguna dentro. Eso evita que alguien que examine el ejecutable pueda
  acceder al código fuente.

  Estos son los **primeros endpoints públicos** del sistema (el resto exige
  iniciar sesión). Es deliberado: la app tiene que poder actualizarse aunque el
  fallo a corregir esté en el propio inicio de sesión. No reciben datos, no tocan
  la base de datos, y sólo informan de que existe una versión X del programa.
  Tienen su propio límite de peticiones y la respuesta se guarda en caché 15
  minutos.

### Notas de configuración

- Requiere dos variables nuevas en el `.env` del servidor:
  `GITHUB_DESKTOP_REPO` y `GITHUB_DESKTOP_TOKEN` (documentadas en
  `.env.example`). Sin ellas los endpoints responden que no hay versiones
  publicadas y la app simplemente no busca actualizaciones: nada más se ve
  afectado.

---

## [1.11.4] - 2026-08-02

Tres fallos del registro de ventas, encontrados al portar la lógica de la venta a la nueva aplicación de escritorio.

### Fixed

- **No se podían vender productos con centavos en el precio.** La columna donde se guarda el precio de cada línea vendida sólo admite números enteros, y el punto de venta enviaba el precio con decimales tal como está en el catálogo. La venta se cortaba con un error de servidor y no quedaba registrada. Afectaba a cualquier producto cuyo precio no fuera redondo: en el catálogo actual, el aceite Castrol 20W50 a C$402.50 no se podía vender. Ahora el precio se redondea al córdoba más cercano al guardar la línea y la venta se completa.
- **Vender el mismo producto en dos líneas del carrito daba un error de servidor.** Sólo puede existir una línea por producto en cada venta, así que al intentar grabar la segunda la venta fallaba entera. Ocurría al escanear dos veces el mismo artículo en lugar de subir la cantidad. Ahora las líneas repetidas se suman en una sola, con la cantidad total.
- **Una venta podía quedar registrada y cobrada pero sin garantía.** Las garantías se generaban después de confirmar la venta, fuera de la operación protegida: si algo fallaba en ese último paso, la venta y el descuento de inventario ya estaban guardados y no había vuelta atrás. El cliente se llevaba el producto sin cobertura y el sistema no dejaba ninguna señal de que faltaba. Ahora la garantía se crea junto con la venta: o se guarda todo, o no se guarda nada.
- **La garantía de un producto repetido en el carrito se emitía por la cantidad equivocada.** Se creaba una garantía por cada línea en vez de una sola por el total, dejando registros duplicados y con cantidades parciales para una misma compra.

---

## [1.11.3] - 2026-07-28

Última tanda de la auditoría: con esto quedan cerrados los 10 hallazgos.

### Fixed

- **El reporte de compras calculaba mal el total.** Sumaba el costo *actual del catálogo* una vez por línea, ignorando cuántas unidades se compraron y a qué precio se pactaron. Comprar 50 filtros a C$80 sumaba C$95 en lugar de C$4.000; y si el costo del producto cambiaba después, el total de una compra vieja cambiaba con él. Ahora suma lo que de verdad se pagó, igual que el detalle de la orden y que los demás reportes.
- **Las órdenes canceladas ya no suman al total de compras**, porque ahí no se compró nada. Siguen apareciendo en el listado con su estado, que sí es información útil.
- **El reporte avisa cuántas órdenes no tienen importes registrados.** Las compras cargadas en una etapa anterior del sistema no guardaron cantidad ni precio, así que no pueden aportar al total. Antes la fórmula equivocada las "rellenaba" con un número inventado; ahora el total baja a lo que realmente se puede calcular y el reporte declara cuántas órdenes quedaron fuera, en vez de dejar la impresión de que el reporte está roto.

### Security

- **Lo que se le debe a un proveedor ya no se le muestra a los vendedores.** La pantalla de órdenes de compra sigue disponible para todos —el vendedor necesita saber qué mercadería viene en camino, de qué proveedor y cuándo, para poder responderle a un cliente—, pero los montos quedaron reservados al dueño: el total de la compra, lo pagado, el saldo, el estado de pago y el precio de cada línea. Un empleado con el precio de compra y el de venta a la vista puede calcular el margen del negocio entero.
- Donde el dato ya no está disponible, la interfaz muestra un guion en vez de C$0.00, para no presentar un número falso.

---

## [1.11.2] - 2026-07-28

Segunda tanda de correcciones de la auditoría.

### Fixed

- **Convertir una proforma en venta no descontaba el inventario.** Se registraba la venta y sus productos, pero el stock quedaba intacto: la mercadería salía del local y el sistema seguía contándola. Tampoco verificaba que hubiera existencias, así que se podía "vender" un producto con cero en inventario. Ahora descuenta el stock, deja el movimiento correspondiente para poder auditarlo, y si falta stock de cualquier producto la conversión se rechaza completa sin dejar nada a medias.
- **Convertir una proforma con el mismo producto repetido en dos líneas daba un error de servidor.** Salió a la luz al probar el arreglo anterior. Ahora las líneas repetidas se suman en una sola, y el stock se valida contra el total: dos líneas de 3 unidades sobre una existencia de 5 se rechazan, como corresponde.
- **El total de la venta convertida se calculaba con decimales imprecisos**, dejando centavos que no cuadraban contra la suma de sus líneas.
- **El reembolso de una devolución a proveedor no tenía tope.** Una devolución de C$500 aceptaba registrar un reembolso de C$50.000: eso inflaba el efectivo esperado del turno de caja —dejando un arqueo con un faltante imposible de explicar— y habilitaba pagarle al proveedor mucho más de lo que se le debía. Ahora el reembolso no puede superar el valor de lo devuelto ni ser negativo.

### Security

- **Un operador ya no puede ver ni tocar el turno de caja de otra persona.** El historial de turnos estaba reservado al dueño por ser información financiera, pero por otra vía cualquier empleado podía leer los movimientos de efectivo de cualquier turno pasado —montos, motivos y quién los registró— y podía cerrarle el arqueo a un compañero, firmando un conteo que no hizo. Ahora cada uno opera solo sobre su propio turno; el dueño sigue viendo y cerrando cualquiera.
- Abrir un turno y consultar la caja del momento siguen disponibles para todos, que es lo que el operador necesita para trabajar.

---

## [1.11.1] - 2026-07-28

Correcciones salidas de una auditoría de seguridad y corrección del sistema completo.

### Fixed

- **Aprobar un presupuesto podía descontar el mismo repuesto dos veces.** Si el último repuesto del presupuesto no tenía stock, los anteriores ya habían salido del inventario y quedaban registrados, pero el presupuesto seguía marcado como no aprobado. Al reintentar, esos repuestos se descontaban otra vez y quedaban duplicados en la orden de trabajo, para después facturarse doble. La causa: el error se devolvía en vez de lanzarse, y eso confirmaba los cambios en lugar de deshacerlos. Ahora la aprobación es de verdad todo o nada.
- **Una devolución no reducía lo que el cliente debía.** El stock volvía al inventario, pero en cuentas por cobrar el cliente seguía debiendo la mercadería que había devuelto, y el sistema le exigía pagarla completa. Es el mismo arreglo que el lado de compras ya tenía desde 1.8.0: faltaba el espejo del lado de ventas. Si la venta ya estaba pagada, ahora queda registrado como **saldo a favor del cliente** en vez de desaparecer.
- **Una venta se podía borrar sin dejar rastro, y cualquier usuario podía hacerlo.** El borrado directo no devolvía el stock, no registraba movimiento y no quedaba en el historial de auditoría — o sea que el camino correcto (cancelar) era rastreable y el otro no. Ahora una venta solo se cancela, que sí devuelve el stock y queda registrado. Editar una venta ya registrada también quedó bloqueado: antes daba un error de servidor.

### Security

- **El precio de compra ya no se le muestra a los vendedores.** Con el costo y el precio de venta juntos en el listado de productos, cualquier empleado podía calcular el margen de cada producto. Era el mismo dato que el reporte de rentabilidad protege, así que ese candado no servía de nada. Ahora el costo solo lo ve el dueño, en el listado, en la ficha del producto, en los productos de un proveedor, en los de una ubicación y en el historial de precios por proveedor.
- **Los respaldos ya no se copian dentro de la imagen del sistema.** Los volcados guardados en el servidor —con nombres de clientes, datos de empleados incluido su salario y todos los precios de compra— quedaban dentro de la imagen que se despliega, visibles para cualquiera que pudiera inspeccionarla. Verificado sobre la imagen real: ya no viajan. El archivo de credenciales de recuperación tampoco.
- **El modo de depuración ahora falla cerrado.** Si la variable que lo controla faltaba o llegaba mal escrita en el despliegue, se apagaban en silencio las cookies seguras, la política de conexión cifrada y —lo más grave— también las comprobaciones que impiden arrancar sin las claves de cifrado, porque dependían de esa misma variable. Además los errores mostraban detalles internos de la base al usuario. Todos los entornos de desarrollo la definen explícitamente, así que el cambio solo protege el caso en que nadie la configuró.

### Notas de la auditoría

- **No se encontró inyección SQL** en ninguna de las consultas directas a la base (unas 257 revisadas): todo valor que viene del usuario viaja parametrizado.
- **No se encontró ninguna credencial filtrada en el historial del repositorio**: nunca se versionó un archivo de entorno, de credenciales ni un respaldo. Las claves de IA no llegan al navegador.
- Quedan documentados otros hallazgos menores que no se tocaron en esta versión, entre ellos: el reporte de compras calcula el total con una fórmula equivocada, el reembolso de una devolución a proveedor no tiene tope, cancelar una venta de taller falla, y el ajuste manual de inventario puede dejar stock negativo si dos personas lo hacen a la vez.

---

## [1.11.0] - 2026-07-28

### Fixed

- **El respaldo automático no podía restaurar la base.** Era un volcado de solo datos: sin el esquema, sin las secuencias de los contadores y sin las funciones ni disparadores. Medido sobre esta base quedaban afuera **4 disparadores, 9 funciones y 30 secuencias**, entre ellos el de auditoría de productos. Restaurar obligaba a reconstruir el esquema a mano desde el repositorio y reajustar cada contador — el tipo de sorpresa que aparece justo cuando el negocio está parado. Ahora usa `pg_dump` en formato comprimido y **un solo comando devuelve la base completa**.
- **Cada respaldo se verifica al crearse.** El sistema lee el índice del archivo recién generado; si no pasa la comprobación lo descarta y avisa, en vez de dejar guardado un archivo ilegible que aparente ser el respaldo del día. Un respaldo que nunca se probó es una esperanza, no un respaldo.
- **Si no se puede hacer un respaldo restaurable, se dice.** Cuando falta `pg_dump` el sistema cae al volcado de solo datos, pero lo declara con todas las letras en la salida —incluso repitiéndolo al final— en vez de dejar creer que hay copia completa. También detecta el caso en que el servidor de base de datos se actualizó y quedó más nuevo que la herramienta de respaldo, e indica qué hay que corregir.
- **La retención cuenta cada formato por separado**, para que una racha de respaldos de emergencia no pueda desplazar al último respaldo restaurable, que es justo el que conviene conservar.
- **La contraseña de la base ya no viaja en la línea de comandos** al respaldar: se pasa por variable de entorno, porque los argumentos de un proceso son visibles para cualquier otro proceso de la máquina.
- **`RESPALDOS.md` documenta el procedimiento de restauración completo**: cómo descifrar el archivo, restaurarlo, y qué consultar para confirmar que salió bien. Incluye un aviso sobre un mensaje de error inofensivo que aparece al restaurar, para que nadie lo confunda con una falla.

### Changed

- Los respaldos ahora incluyen los usuarios del sistema: sin ellos la base restaurada no dejaría iniciar sesión a nadie, o sea que no restauraría el sistema. Siguen quedando fuera las tablas de tokens de sesión, que no sirven para restaurar y cuya filtración fue el origen del incidente de 1.9.0.
- La imagen del backend incluye `postgresql-client`, que es lo que provee las herramientas de respaldo y restauración.

---

## [1.10.0] - 2026-07-27

### Added

- **Pronóstico de demanda:** nueva pantalla (solo administradores) que responde qué recomprar, cuándo y cuánto. Hasta ahora esa decisión la guiaba `cantidad_minima`, un umbral fijo escrito a mano que no sabe nada de velocidad de venta: había productos que rotaban 40% más rápido que otros y tenían el umbral **más bajo**, o sea al revés de lo que correspondía.
- **Punto de reorden calculado con el plazo real de cada proveedor.** Ya no es "avisame cuando queden 5", sino "a esta velocidad y con lo que tarda este proveedor, hay que pedir hoy". Se muestran los días de cobertura que quedan y la cantidad a comprar.
- **Se descuenta lo que ya está pedido y no llegó.** Sin esto el sistema manda a comprar de nuevo mercadería que viene en camino: es plata gastada dos veces y el error es silencioso, porque el stock se ve bajo justamente porque el pedido no llegó.
- **Cada número dice de qué se sostiene.** Un producto que vendió una vez en el año no se muestra igual que uno que vendió todos los meses: la confianza (alta, media, baja) va al lado de la cifra. Los productos sin ninguna venta **no reciben un pronóstico inventado**, van a una lista aparte con su capital inmovilizado, porque decidir si son nuevos o si nadie los quiere requiere criterio.
- **El promedio excluye los meses sin actividad.** La base tiene meses completos sin una sola venta; contarlos como ceros haría ver la demanda un 27% más baja de lo real y llevaría a comprar de menos. La pantalla declara arriba cuántos meses se usaron y cuáles se excluyeron.
- **Días de entrega por proveedor** (campo nuevo, editable). El pronóstico prefiere el **plazo medido** en recepciones reales cuando hay al menos dos; si no, usa el estimado cargado a mano; y si tampoco, un valor por defecto del sistema. Siempre informa cuál de los tres usó, para que un supuesto no se confunda con una medición.
- **Interpretación con IA, estrenando el apartado de 1.9.0.** Agrega lo que los datos no pueden contener: la estacionalidad de Nicaragua (la temporada lluviosa desgasta frenos, cadenas y llantas; la seca tapa filtros de aire con polvo; diciembre mueve accesorios) y agrupa lo que conviene pedir junto. **No toca las cantidades**: los números son cuentas y la IA los anota, no los reescribe.
- **La IA es opcional y no puede romper el pronóstico.** Va en un endpoint aparte y se dispara a pedido: la pantalla muestra sus números al instante y, si el proveedor está caído, lento o sin saldo, la función sigue sirviendo igual. A la IA solo se le mandan productos y cantidades — **ningún dato de cliente sale del sistema**.
- **`seed_demanda_demo`**: comando para sembrar historial de ventas con la estacionalidad nicaragüense y poder ver la función funcionando. Se niega a correr contra producción sin `--forzar`, marca lo que crea y sabe deshacerlo con `--limpiar`. No modifica el stock: son ventas retroactivas y descontar inventario corrompería el conteo físico.
- Campo nuevo `proveedores.dias_entrega_estimado` (migración `0024`, aditiva).

---

## [1.9.0] - 2026-07-26

### Security

- **Los respaldos automáticos quedaron públicos y se corrigió.** Se subían al mismo bucket que sirve las fotos de la bitácora, que tiene dominio público, así que **13 volcados completos de la base eran descargables sin contraseña**: clientes, ventas, precios de compra, motos con placa y empleados. Lo más grave no eran los datos sino **tres tokens de sesión vigentes** que permitían entrar al sistema. Se borraron los 13 respaldos, se **rotó la clave de firma** —lo que invalidó todos los tokens filtrados— y se purgaron los registros de tokens de la base.
- **Las credenciales ya no viajan en los respaldos.** Las tablas de tokens de sesión y de claves de IA quedaron excluidas: son credenciales, no datos del negocio, y nunca debieron estar ahí.
- **El respaldo ya no sube a un destino público.** Ahora exige un bucket privado y se **cifra antes de salir del servidor**. Si falta cualquiera de las dos cosas no sube y avisa: es preferible tener solo la copia local a una copia remota expuesta.
- **`RESPALDOS.md`** documenta qué pasó, cómo terminar de configurarlo y las opciones de destino ordenadas de gratis a premium. Incluye una advertencia que conviene leer antes de necesitarla: **el respaldo actual es solo datos y no restaura la base por sí solo**.
- Como efecto de rotar la clave de firma, **todos tienen que volver a iniciar sesión** después del despliegue.

### Added

- **Configuración de proveedores de IA:** nueva sección (solo administradores) para cargar la clave de **OpenAI, Google Gemini, DeepSeek o Anthropic (Claude)** y elegir el modelo de cada uno. Queda para las funciones con IA que vienen después; por ahora es solo la configuración.
- **La lista de modelos la da el proveedor, no el sistema.** Se le pregunta con tu clave cada vez, así que aparecen los modelos nuevos apenas salen y no se ofrecen los que ya retiraron. También refleja **a cuáles tiene acceso tu cuenta**, que depende del plan contratado. Por eso el alta es en dos pasos: primero la clave, después el modelo — antes de tener la clave no hay a quién preguntarle. Si el proveedor no responde, se puede escribir el nombre del modelo a mano.
- **Un proveedor activo a la vez**, con el modelo elegido. La base lo impone, no solo la pantalla. No se puede activar un proveedor sin modelo: quedaría "en uso" sin poder llamar a nada.
- **La clave nunca vuelve del backend.** Se guarda cifrada y la pantalla solo muestra algo como `sk-…4f2a`, lo justo para reconocer cuál está cargada. Una clave de IA permite gastar dinero de la cuenta, así que no hay motivo para devolverla ni a un administrador. Tampoco viaja en los respaldos.
- **Probar la clave** contra el proveedor antes de depender de ella: sin eso, una clave mal pegada se descubre recién cuando una función falla frente al usuario. La prueba la hace el servidor, porque hacerla desde el navegador obligaría a mandarle la clave.
- **Avisos al pegar la clave equivocada:** si se pega una de Gemini en OpenAI, o lo que muestra la pantalla en vez de la clave real, se rechaza antes de guardar y **sin pisar la que ya estaba**.
- **Agregar un proveedor nuevo no requiere migración:** todo lo específico de cada proveedor vive en un solo archivo.
- **Selector de modelo con buscador:** la lista de un proveedor como OpenAI puede traer decenas de variantes (`gpt-4.1`, `gpt-4.1-2025-04-14`, `gpt-3.5-turbo-16k`...); el selector nativo obligaba a leerlas todas una por una. El nuevo combobox deja escribir para filtrar y marca el modelo recomendado con una insignia en vez de pegarlo al nombre.
- Tabla nueva `configuracion_ia` (migración `0023`, aditiva).

### Fixed

- **Borrar la clave de un proveedor no mostraba ningún aviso de progreso.** El diálogo de confirmación pasaba la propiedad equivocada al botón y encima se cerraba apenas se hacía clic, así que la eliminación quedaba corriendo en silencio. Ahora el diálogo se queda abierto con el botón en "Borrando..." hasta que termina, y la tarjeta del proveedor se atenúa mientras tanto.

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
