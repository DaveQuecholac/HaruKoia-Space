# Por qué no microservicios

Microservicios no son el diseño más sólido para este motor. Son la forma de partir un sistema cuando un equipo ya no puede desplegar, escalar o fallar junto. Aquí el documento, la pizarra y el CLI tienen que ponerse de acuerdo al instante. Partirlos en servicios les mete una red en medio.

Esta nota no fija una lista de servicios finales. Responde la pregunta de fondo: por qué no crear microservicios en su lugar, si esa es la opinión más repetida.

## Qué se está eligiendo

```text
Opinión habitual                         Este motor
────────────────────────────             ────────────────────────────
Un servicio por capacidad                Un motor, varios procesos
                                         solo donde el corte ya está claro

  Pizarra          Publicador              Web ─────────┐
  Awareness        Documentos                    Sync     │  sesión en vivo
  Base de datos    Updater                       Réplica  │  documentos
  ...uno más por cada idea                  Worker     │  IA y PDF
                                                 CLI ─────┘  space update
```

Sync, réplica y worker ya van separados. Eso cubre el tiempo real, el maestro de datos y el trabajo lento. Lo que no se hace es abrir un servicio nuevo cada vez que aparece una capacidad.

## Por qué la opinión habitual no gana aquí

| Lo que se dice | Qué significa de verdad | Qué pasa en HaruKoia |
|---|---|---|
| "Escala mejor" | Un proceso puede crecer sin arrastrar a los demás | La pizarra escala por conexiones. La IA escala por trabajos. Eso ya está en dos procesos. El resto se lee en local con RxDB y no pasa por un servicio en cada click. |
| "Es más robusto" | Un fallo queda contenido | Un fallo entre cinco servicios se reparte. Hay que rastrear un trazo por la red. Si la pizarra depende de awareness, y awareness depende de documentos, se caen juntos igual. |
| "Cada cosa queda independiente" | Cada equipo despliega cuando quiere | Es un solo motor y un solo esquema (space, versión, markdown). Si esos servicios se despliegan por separado, el CLI puede recibir un documento que la web ya no entiende. |
| "Así se hace lo colaborativo" | La ficha genérica junta chat masivo, editor y tablero | Aquí la sesión es un documento compartido (Yjs). La publicación es una réplica (RxDB). Ninguna de las dos pide una malla de servicios para funcionar. |

El beneficio real de los microservicios es de organización: varios equipos, cada uno dueño de un dominio, desplegando sin coordinarse. Mientras el dominio siga llegando (la pizarra ahora, IoKoia Space después), esas fronteras todavía se van a mover. Un corte prematuro deja servicios que hay que desplegar juntos y que comparten el mismo dato. Eso es lo más caro de operar: la complejidad de la red, sin la independencia que la justificaba.

## Cuándo sí se crea uno

Una capacidad pasa a servicio propio solo si cumple alguna de estas:

1. Se despliega a otro ritmo que el resto.
2. Pide mucha más capacidad (conexiones, CPU o disco).
3. Guarda datos que el resto no debe leer directo.
4. Su fallo no puede cortar la pizarra ni la réplica.

Sync, réplica y worker ya cumplen eso. Una capacidad nueva que no cumpla ninguna entra como módulo del motor: esquema, pantalla y comando. Sacarla después, con la frontera ya probada, es directo. Volver a unir servicios mal cortados implica reescribir el producto.

## Relación con la arquitectura

El detalle del motor está en [arquitectura-recomendada.md](./arquitectura-recomendada.md).
