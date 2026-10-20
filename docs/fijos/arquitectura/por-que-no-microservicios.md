# Por qué no microservicios

Microservicios no son el diseño más sólido para este motor. Son la forma de partir un sistema cuando un equipo ya no puede desplegar, escalar o fallar junto. Aquí el documento, la pizarra y el CLI tienen que ponerse de acuerdo al instante. Partirlos en servicios les mete una red en medio.

Esta nota no fija una lista de servicios finales. Responde la pregunta de fondo: por qué no crear microservicios en su lugar, si esa es la opinión más repetida.

## Qué se está eligiendo

```text
Opinión habitual                         Este motor (v2, revisión 2026-10-19)
────────────────────────────             ────────────────────────────────────
Un servicio por capacidad                Un motor, varios procesos
                                         solo donde el corte ya está claro

  Pizarra          Publicador              Web ──────────┐
  Awareness        Documentos                Orquestador  │  salas y relay
  Base de datos    Updater                   Host         │  sala en vivo, commits,
  ...uno más por cada idea                                │  IA y PDF
                                             Réplica      │  copia central de lectura
                                             CLI ─────────┘  space update
```

El orquestador, el host y la réplica central ya van separados. Eso cubre el enrutamiento, la sala con todo lo que el host hace sobre ella, y la copia que leen quienes no están. Lo que no se hace es abrir un servicio nuevo cada vez que aparece una capacidad.

## Por qué la opinión habitual no gana aquí

| Lo que se dice | Qué significa de verdad | Qué pasa en HaruKoia |
|---|---|---|
| "Escala mejor" | Un proceso puede crecer sin arrastrar a los demás | El relay escala por conexiones. La sala escala por host. Eso ya está en procesos distintos. El resto se lee en local, en el SQLite de PowerSync, y no pasa por un servicio en cada click. |
| "Es más robusto" | Un fallo queda contenido | Un fallo entre cinco servicios se reparte. Hay que rastrear un trazo por la red. Si la pizarra depende de awareness, y awareness depende de documentos, se caen juntos igual. |
| "Cada cosa queda independiente" | Cada equipo despliega cuando quiere | Es un solo motor y un solo esquema (sala, commit, markdown). Si esos servicios se despliegan por separado, el CLI puede recibir un documento que la web ya no entiende. |
| "Así se hace lo colaborativo" | La ficha genérica junta chat masivo, editor y tablero | Aquí la sesión es un documento compartido (Yjs). El historial es una réplica (PowerSync). Ninguna de las dos pide una malla de servicios para funcionar. |

El beneficio real de los microservicios es de organización: varios equipos, cada uno dueño de un dominio, desplegando sin coordinarse. Mientras el dominio siga llegando (la pizarra ahora, IoKoia Space después), esas fronteras todavía se van a mover. Un corte prematuro deja servicios que hay que desplegar juntos y que comparten el mismo dato. Eso es lo más caro de operar: la complejidad de la red, sin la independencia que la justificaba.

## Cuándo sí se crea uno

Una capacidad pasa a servicio propio solo si cumple alguna de estas:

1. Se despliega a otro ritmo que el resto.
2. Pide mucha más capacidad (conexiones, CPU o disco).
3. Guarda datos que el resto no debe leer directo.
4. Su fallo no puede cortar la pizarra ni la réplica.

El orquestador, el host y la réplica central cumplen eso:

| Proceso | Condición que cumple |
|---|---|
| Orquestador | 2 y 4: escala por conexiones, y reiniciarlo no puede tumbar las salas |
| Contenedor host | 1 y 3: uno por sala, en la máquina de su dueño, con su repo y su base |
| Réplica central | 3 y 4: guarda la copia de lectura que nadie más escribe, y si se cae la sala en vivo sigue |

Una capacidad nueva que no cumpla ninguna entra como módulo del motor: esquema, pantalla y comando. Sacarla después, con la frontera ya probada, es directo. Volver a unir servicios mal cortados implica reescribir el producto.

**Pendiente de aplicar este criterio:** si el backend de escritura de la réplica central vive dentro del orquestador o como proceso propio. Es un punto abierto de la sección 13 de la v2. Postgres y PowerSync Service son procesos de terceros y van aparte de todas formas.

## Relación con la arquitectura

La arquitectura vigente está en [analisis-arquitectura-v2.md](./analisis-arquitectura-v2.md). El detalle previo, en lo que la v2 no cambió, está en [arquitectura-recomendada.md](./arquitectura-recomendada.md).
