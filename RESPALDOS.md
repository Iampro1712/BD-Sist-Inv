# Respaldos: estado y opciones de destino

## Qué pasó

Los respaldos automáticos se subían al bucket de R2 que tiene dominio público
(`cdn.eclipze.dev`, el mismo que sirve las fotos de la bitácora). Resultado:
**13 volcados completos de la base quedaron descargables sin autenticación**.

Contenían 1.847 filas de 40 tablas: clientes con nombre, 186 ventas, 75
productos con su precio de compra, proveedores, motos con placa y empleados.
Los teléfonos y correos sí estaban cifrados.

Lo más grave no eran los datos sino **3 tokens de sesión vigentes**: alcanzaba
con tomar uno y canjearlo para entrar al sistema como usuario autenticado.

### Ya corregido

- Los 13 respaldos **borrados** del bucket; las URLs devuelven 404.
- **`SECRET_KEY` rotada**, lo que invalidó todos los tokens filtrados. Efecto
  secundario: todos tienen que volver a iniciar sesión.
- Registros de tokens purgados de la base.
- Las tablas de tokens **excluidas del respaldo**: son credenciales, no datos de
  negocio, y nunca debieron estar ahí.
- El respaldo **ya no se sube al bucket público**. Ahora exige un bucket privado
  (`R2_BACKUP_BUCKET`) y se **cifra antes de salir del servidor**
  (`BACKUP_ENCRYPTION_KEY`). Si falta cualquiera de las dos, no sube: es
  preferible tener solo la copia local a una copia remota expuesta.

### Pendiente de configurar (por eso hoy solo hay copia local)

```bash
# 1. Crear en Cloudflare R2 un bucket NUEVO para respaldos, SIN dominio público.
R2_BACKUP_BUCKET=inventrix-respaldos

# 2. Generar la clave de cifrado del respaldo:
#    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
BACKUP_ENCRYPTION_KEY=<la clave generada>
```

> Guardá `BACKUP_ENCRYPTION_KEY` **fuera del servidor** (gestor de contraseñas).
> Si se pierde, los respaldos cifrados son irrecuperables.

---

## Advertencia: el respaldo actual no restaura la base

El volcado es **solo datos** (`{tabla: {columnas, filas}}`). No incluye el
esquema, ni las secuencias de los contadores, ni las funciones y disparadores
—como el de auditoría—. Para reconstruir el sistema desde cero haría falta:

1. `SQL_FILES/000_base_schema_snapshot.sql` (está en el repositorio),
2. las migraciones de Django,
3. este volcado de datos,
4. reajustar a mano los contadores de cada tabla.

**Recomendación**: pasar a `pg_dump -Fc`, que produce un archivo que restaura
todo de una sola vez con `pg_restore`. Es un cambio acotado y elimina el riesgo
de descubrir en una emergencia que el respaldo no alcanzaba.

---

## Opciones de destino

Los respaldos pesan ~320 KB cada uno. Aun con uno diario y un año de retención,
son ~115 MB: cualquier opción de esta lista sobra por volumen. Lo que cambia
entre ellas es **qué tan difícil es perderlos**.

Los precios son aproximados y conviene verificarlos: cambian.

### 1. Gratis — bucket privado de R2 *(implementado, falta configurarlo)*

Un bucket nuevo en la cuenta de Cloudflare que ya tenés, **sin dominio público**.
Solo se accede con credenciales por la API.

- **Costo**: 0. La capa gratuita de R2 da 10 GB y, a diferencia de casi todos,
  **no cobra por descargar** (sin cargos de salida).
- **A favor**: no hay servicio nuevo ni credenciales nuevas; el código ya está
  listo; el contenido va cifrado.
- **En contra**: la copia vive en la misma cuenta que el resto. Si esa cuenta se
  ve comprometida, se pueden borrar los respaldos.

**Es lo que recomiendo hacer hoy mismo**: cierra la fuga sin costo ni trabajo.

### 2. Recomendado — bucket privado + una segunda copia en otro proveedor

Lo de arriba, más una copia en **Backblaze B2** (10 GB gratis) o en el disco de
otra máquina.

- **Costo**: 0 dentro de las capas gratuitas.
- **Por qué**: es la regla clásica *3-2-1* — tres copias, en dos sitios
  distintos, una fuera de la infraestructura principal. Protege contra el caso
  que la opción 1 no cubre: que pierdas el acceso a la cuenta de Cloudflare.
- Sumale pasar a `pg_dump` para que el respaldo sirva de verdad.

### 3. Precio/calidad — almacenamiento con protección contra borrado

- **Hetzner Storage Box** (~4 €/mes por 1 TB): soporta BorgBackup o restic en
  **modo solo-agregar**. Un atacante que consiga las credenciales del servidor
  puede escribir respaldos nuevos pero **no borrar ni alterar los viejos**.
- **Backblaze B2** (~6 USD/TB al mes): ofrece bloqueo de objetos, mismo efecto.

- **Por qué vale la pena**: cubre el escenario en que alguien entra al servidor.
  Sin esto, quien tenga acceso puede cifrar la base *y* destruir los respaldos,
  que es exactamente cómo funciona un secuestro de datos.

### 4. Lo mejor sin mirar el precio

- **AWS S3 con bloqueo de objetos en modo cumplimiento**, versionado y traspaso
  automático a almacenamiento de archivo. En ese modo **ni el dueño de la cuenta**
  puede borrar un respaldo antes de que venza su retención. Es el estándar para
  respaldos inmutables.
- **Recuperación a un punto en el tiempo**: un Postgres gestionado (Neon,
  Supabase, RDS) que permite volver a cualquier segundo de los últimos días.
  Esto no es un archivo de respaldo, es otra categoría: es lo único que salva de
  un `DELETE` sin `WHERE` ejecutado a las tres de la tarde, porque con respaldos
  diarios perderías todo el día.
- **Costo**: decenas de dólares al mes. Se justifica cuando el negocio no puede
  permitirse perder ni una hora de operación.

---

## Sobre las fotos de la bitácora

Las imágenes del taller siguen en el bucket público, y **está bien**: la
aplicación las muestra y por eso necesitan URL pública. Vale saber que cualquiera
con el enlace puede verlas, así que no conviene subir ahí documentos con datos
personales (cédulas, contratos).
