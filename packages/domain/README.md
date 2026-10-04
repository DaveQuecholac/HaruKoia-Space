# `@harukoia/domain`

Dominio del motor: sala, host, staging, commit, push y sus estados. Reglas que no dependen del transporte ni del almacenamiento.

Aquí viven los nombres de archivo de lo que se materializa en el repositorio y las secciones del markdown, para que el host y el CLI coincidan.

## Identificadores (regla fijada en A5)

Todos los identificadores del motor —salas, commits, participantes, conexiones— se generan igual.

| Regla | Valor | Por qué |
|-------|-------|---------|
| Alfabeto | 32 símbolos: `a-z` y `0-9` **sin** `i`, `l`, `o`, `u` | Esos cuatro se confunden al leer o dictar un link |
| Bits por carácter | 5 exactos | 32 símbolos es potencia de dos, así que generar no introduce sesgo |
| Longitud mínima | 16 caracteres, o sea 80 bits | Un identificador de sala viaja en un link y no debe poder adivinarse |
| Fuente de azar | Web Crypto | Disponible igual en el navegador y en los procesos de servidor |

Lo que llega de la red **nunca** se castea a mano: pasa por `comoIdentificador`, que valida o falla.

El tipo `Identificador<'sala'>` no es asignable a `Identificador<'commit'>`, así que el compilador atrapa el intercambio de identificadores entre colecciones.

## Contrato del protocolo del relay (paso B1)

Este paquete es el **único** lugar donde vive el protocolo. El orquestador y el host lo importan; ninguno lo redefine.

### Identidad de una sala — decisión D4

Tres valores distintos, y la distinción es el punto:

| Valor | Longitud | Secreto | Para qué |
|-------|----------|---------|----------|
| Identificador de sala | 16 caracteres (80 bits) | No | Enrutar. Aparece en logs y en mensajes de control |
| Token de host | 26 caracteres (130 bits) | Sí | Probar que eres el dueño y recuperar la sala (D5) |
| Token de invitación | 26 caracteres (130 bits) | Sí | Entrar. Se comparte en el link y se puede rotar |

`rotarTokenDeInvitacion` cambia el token de invitación **sin tocar** la sala ni el token de host: los links viejos dejan de servir y las sesiones abiertas siguen.

### Dos planos separados

| Plano | Qué lleva | Codificación |
|-------|-----------|--------------|
| **Control** | Registro, latido, entra y sale invitado, cierre | Texto JSON, en `relay/codec-de-control/` |
| **Datos** | Bytes opacos del canal | Binario puro. El relay no los mira y el contrato no los describe |

El control es poco frecuente y conviene leerlo en un log; los datos no se envuelven en texto porque eso cuesta un tercio más de tamaño sin ganar nada. El formato del control vive en un solo archivo: cambiarlo por una codificación binaria no toca la forma de los mensajes.

### Canales

`relay/canal/canal.ts` es el único archivo del repositorio que enumera canales. Hoy hay uno: `sesion`. Cuando entre la réplica de la base local (H3) será otro miembro de la unión más su manejador en el host.

### Nada se ignora en silencio

`interpretarControl` devuelve `{ ok: true, mensaje }` o `{ ok: false, causa, detalle }`. Las causas son uniones de literales, no texto libre, así que el receptor puede ramificar sobre ellas.

Agregar un mensaje al protocolo = un miembro en la unión y una entrada en el mapa de lectores. Nada más.

### Sin vocabulario de pizarra

El relay no sabe qué transporta. Si en este paquete aparece la palabra trazo, figura, lienzo o commit, está en la capa equivocada, y hay una prueba que lo verifica.
