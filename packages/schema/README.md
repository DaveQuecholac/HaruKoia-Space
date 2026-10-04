# `@harukoia/schema`

Esquemas de las colecciones replicadas: salas, commits, snapshots, documentos y adjuntos. Incluye las versiones de esquema y sus migraciones.

Lo consumen la web, el host y el CLI. Es el contrato que evita que el markdown que escribe el host y el que lee el CLI se definan en dos lugares.

## Reglas de lo replicado (fijadas en A5)

### Campos de control

Todo documento que se replica lleva `id`, `actualizadoEn` y `borrado`.

### Orden

Orden total: primero por `actualizadoEn`, y a marca igual, por `id`. Sin ese desempate, dos documentos escritos en el mismo milisegundo se pueden perder al paginar desde un checkpoint.

**`actualizadoEn` lo asigna el host**, que es la autoridad. El cliente nunca manda esa marca: su reloj puede ir atrasado o adelantado y el orden dejaría de ser determinista.

### Borrado

Lógico, con `borrado: true`. Lo replicado **nunca** se borra físicamente: un borrado es un cambio que tiene que viajar como cualquier otro.

### Versión de esquema

Cada colección declara su versión y la cadena de migraciones, una por cada salto de versión, sin huecos. Un documento guardado con una versión anterior se migra **al leerlo**. No hay migración hacia atrás: una versión publicada no se reescribe.

Qué colecciones existen y qué campos tiene cada una se decide en la épica que las usa, no aquí.

### Estilo de tipos

Uniones de literales y tipos planos. **Sin `enum`, `namespace`, propiedades declaradas en el constructor ni decoradores**: Node ejecuta TypeScript quitando los tipos, no transformándolos, así que esas construcciones compilan y fallan al correr.
