# `@harukoia/registro`

Una línea por evento, con el mismo formato en el orquestador, el host y la web. Fijado en el paso A6.

## Formato

```text
2026-10-04T09:12:33.481Z info  orquestador sala=4k7m conexion=9b2 invitado entró
└ instante ISO           └ niv └ proceso   └ contexto             └ mensaje
```

Texto, no JSON: se lee con `tail` y se filtra con `grep` sin herramientas extra.

| Parte | Regla |
|-------|-------|
| Instante | ISO en UTC, para comparar dos máquinas sin pensar en husos |
| Nivel | `info`, `aviso` o `error`, rellenados al mismo ancho para que las columnas queden alineadas |
| Proceso | `orquestador`, `host` o `web` |
| Contexto | Pares `clave=valor`. `sala` es la clave que permite seguir una sala completa |
| Mensaje | Prosa, al final |

**Siempre una sola línea.** Los saltos dentro del mensaje o de un valor se escapan como `\n` y los caracteres de control se quitan. Un error de varias líneas rompería el filtrado justo cuando más se necesita.

Los valores con espacios van entrecomillados, así que `causa="token no válido"` sigue siendo un par.

## Uso

```ts
import { crearRegistro, destinoDeConsola } from '@harukoia/registro';

const registro = crearRegistro({ proceso: 'host', destino: destinoDeConsola() });

registro.info('escuchando', { puerto: 51234 });

// Un registro hijo arrastra su contexto en todas sus líneas.
const deLaSala = registro.con({ sala: '4k7m2xq8' });
deLaSala.info('invitado entró', { conexion: '9b2' });
deLaSala.error('se perdió el túnel', { causa: 'ECONNRESET' });
```

## Seguir una sala

```bash
grep "sala=4k7m2xq8" apps/*/logs/pm2/*.log | sort
```

El `sort` alfabético ordena por instante, porque la línea empieza con la marca ISO.

## Cómo se extiende

| Qué agregar | Qué se toca |
|-------------|-------------|
| Un dato nuevo en las líneas (participante, versión) | Una clave más en el contexto. Nada de código del mecanismo |
| Un destino nuevo (archivo, reenvío al orquestador) | Un módulo que exporte un `Destino`. Nada del mecanismo ni del formato |
| Un nivel nuevo | `Nivel` y el reparto de `destinoDeConsola`. Es el único cambio que toca dos archivos, y por eso los niveles son tres |

## Por qué este paquete no se compila a `dist`

Su `exports` apunta a `src/index.ts`. Node ≥ 23.6 le quita los tipos al vuelo y Vite lo transforma, así que no hay paso de construcción que recordar ni `dist` que pueda quedar viejo.

`@harukoia/domain` y `@harukoia/schema` todavía publican `dist`, así que hoy el repositorio tiene dos formas de consumir un paquete interno. **Hay que unificarlas en B1**, que es cuando el protocolo entra en `domain` y los tres procesos lo importan de verdad.
