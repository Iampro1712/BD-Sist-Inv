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
- El respaldo **ya restaura la base** (ver la sección siguiente): antes era solo
  datos y no alcanzaba para volver a levantar el sistema.

### Configuración (ya aplicada, queda documentada)

```bash
# 1. Bucket en Cloudflare R2 para respaldos, SIN dominio público.
R2_BACKUP_BUCKET=inventrix-respaldos

# 2. Clave de cifrado del respaldo. Generar una con:
#    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
BACKUP_ENCRYPTION_KEY=<la clave generada>
```

> Guardá `BACKUP_ENCRYPTION_KEY` **fuera del servidor** (gestor de contraseñas).
> Si se pierde, los respaldos cifrados son irrecuperables. Y ojo: si el servidor
> se compromete y la clave solo vive ahí, quien entre puede leer los respaldos.

---

## El respaldo ya restaura la base *(resuelto)*

Antes el volcado era **solo datos** (`{tabla: {columnas, filas}}`): sin esquema,
sin las secuencias de los contadores y sin las funciones ni disparadores —entre
ellos el de auditoría—. Medido sobre esta base, quedaban afuera **4
disparadores, 9 funciones y 30 secuencias**. Restaurar obligaba a reconstruir el
esquema a mano desde el repositorio y reajustar cada contador.

Ahora el respaldo automático usa `pg_dump` en formato custom, que restaura todo
con un solo comando, y **el sistema verifica cada archivo** al crearlo (lee su
índice con `pg_restore --list`); si no pasa la verificación lo descarta y avisa,
en vez de guardar un archivo inútil que aparente ser un respaldo.

### Cómo restaurar

Hace falta el archivo `.dump` y `pg_restore`. Si el archivo viene del bucket,
primero hay que descifrarlo:

```bash
# 1. Descifrar (solo si se bajó del bucket, termina en .enc)
python -c "
from cryptography.fernet import Fernet
import sys
clave = 'CONTENIDO_DE_BACKUP_ENCRYPTION_KEY'
datos = open('inventrix-AAAAMMDD-HHMMSS.dump.enc','rb').read()
open('respaldo.dump','wb').write(Fernet(clave).decrypt(datos))
"

# 2. Crear una base VACÍA (no restaurar sobre una con datos)
createdb -h HOST -U USUARIO inventrix_restaurada

# 3. Restaurar
pg_restore -h HOST -U USUARIO -d inventrix_restaurada \
    --no-owner --no-privileges respaldo.dump
```

**Vas a ver este error y es inofensivo:**

```
pg_restore: error: could not execute query: ERROR: unrecognized
configuration parameter "transaction_timeout"
pg_restore: warning: errors ignored on restore: 1
```

Pasa porque el `pg_dump` del contenedor es más nuevo que el servidor y escribe
un parámetro que la versión del servidor no conoce. Es una línea de
configuración, no datos: **la restauración se completó**. Se deja documentado
justamente para que nadie entre en pánico a las tres de la mañana.

### Comprobar que la restauración salió bien

```sql
SELECT
  (SELECT count(*) FROM productos)                              AS productos,
  (SELECT count(*) FROM ventas)                                 AS ventas,
  (SELECT count(*) FROM auth_user)                              AS usuarios,
  (SELECT count(*) FROM information_schema.triggers
     WHERE trigger_schema='public')                             AS disparadores,
  (SELECT count(*) FROM information_schema.routines
     WHERE routine_schema='public')                             AS funciones,
  (SELECT count(*) FROM django_migrations)                      AS migraciones;
```

Los disparadores y funciones tienen que venir en más de cero: si están en cero,
se restauró solo la estructura de tablas y falta lo demás.

### Qué NO va en el respaldo, a propósito

Solo las tablas efímeras: `token_blacklist_*` y `django_session`. Son
credenciales de un momento que ya pasó —no sirven de nada al restaurar— y su
filtración permite entrar al sistema; se encontraron tokens vigentes en un
respaldo público y de ahí salió todo este trabajo.

Los usuarios (`auth_user`) **sí van**: un respaldo donde nadie puede iniciar
sesión no restaura el sistema. Las claves de IA también, pero están cifradas con
`FIELD_ENCRYPTION_KEY`, que no viaja en el archivo: sin esa clave aparte no
sirven.

### Si no hay `pg_dump`

El sistema cae al volcado JSON de solo datos y **lo dice explícitamente** en la
salida del cron. Ese archivo no restaura por sí solo: haría falta el esquema
(`SQL_FILES/000_base_schema_snapshot.sql`), las migraciones y reajustar los
contadores a mano. Si aparece ese aviso, hay que revisar que el contenedor tenga
el paquete `postgresql-client` (está en el `Dockerfile`).

---

## Opciones de destino

Los respaldos pesan menos de 1 MB cada uno con el volumen actual (el formato
custom viene comprimido). Aun con uno diario y un año de retención, son unos
pocos cientos de MB: cualquier opción de esta lista sobra por volumen. Lo que
cambia entre ellas es **qué tan difícil es perderlos**.

Los precios son aproximados y conviene verificarlos: cambian.

### 1. Gratis — bucket privado de R2 *(es lo que está funcionando hoy)*

Un bucket nuevo en la cuenta de Cloudflare que ya tenés, **sin dominio público**.
Solo se accede con credenciales por la API.

- **Costo**: 0. La capa gratuita de R2 da 10 GB y, a diferencia de casi todos,
  **no cobra por descargar** (sin cargos de salida).
- **A favor**: no hay servicio nuevo ni credenciales nuevas; el código ya está
  listo; el contenido va cifrado.
- **En contra**: la copia vive en la misma cuenta que el resto. Si esa cuenta se
  ve comprometida, se pueden borrar los respaldos.

Cierra la fuga sin costo. **Ya está configurado y verificado**: el respaldo
sube cifrado a este bucket.

### 2. Recomendado — bucket privado + una segunda copia en otro proveedor

Lo de arriba, más una copia en **Backblaze B2** (10 GB gratis) o en el disco de
otra máquina.

- **Costo**: 0 dentro de las capas gratuitas.
- **Por qué**: es la regla clásica *3-2-1* — tres copias, en dos sitios
  distintos, una fuera de la infraestructura principal. Protege contra el caso
  que la opción 1 no cubre: que pierdas el acceso a la cuenta de Cloudflare.

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
