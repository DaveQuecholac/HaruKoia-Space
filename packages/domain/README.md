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
