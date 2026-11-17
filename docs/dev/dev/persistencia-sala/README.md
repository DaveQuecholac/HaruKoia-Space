# Rama `dev/persistencia-sala`

Épica **H3 — Cierro la laptop y la sala vuelve**: el documento de la sesión sobrevive en el disco del host y la identidad de la sala, en el keyring del sistema.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-h3-persistencia-sala.md](./analisis-h3-persistencia-sala.md) | Qué hereda H3, qué ya está decidido, tensiones entre documentos, decisiones que bloquean código, errores y pruebas |
| [plan-h3-persistencia-sala.md](./plan-h3-persistencia-sala.md) | Pasos con verificación, pruebas y checkpoint. Ningún paso de código arranca con una decisión E abierta |

Épicas de toda la fase: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).  
Arquitectura: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).  
H0/H1: [docs/dev/dev/motor/](../motor/README.md).  
H2 (cerrada y aprobada el 2026-11-09): [docs/dev/dev/pizarra-colaborativa/](../pizarra-colaborativa/README.md).

## Alcance

**Entra.** Persistir el documento Yjs de la sala en el disco del host, restaurarlo al rearrancar, conservar la misma identidad (y por tanto el mismo link), reconexión de quien se quedó en la página, fusión con quien dibujó sin red, estados visibles y pruebas de resistencia.

**No entra.** Staging, commit, historial, checkout, traductor JSON (H4). Réplica central y PowerSync (antes de H4, y la réplica no es este disco). Publicación, CLI, git (H5). IA (H6). Sala global (H7). Autenticación. Migración de host a otra máquina. Construir la app Expo.

## Estado

> **H3 cerrada (2026-11-12).** El segundo proceso con el archivo ocupado termina con `database is locked` y no se registra. Host 53, web 24 y pruebas entre procesos 26, en verde.

| Paso | Qué | Estado |
|------|-----|--------|
| P0 | Rama y esta carpeta | Hecho |
| D1 | Documento Yjs en SQLite del host | Hecho |
| D2 | Identidad durable | Hecho. El mismo link sobrevive a reiniciar el host |
| D3 | Restaurar al arrancar | Hecho. SIGKILL y otro proceso con el mismo disco devuelven la misma sala y el documento |
| D4 | Apagado limpio y muerte súbita | Hecho. SIGTERM cierra la sala y guarda el pendiente; el mismo link lo vuelve a abrir |
| D5 | Reconexión sin recargar | Hecho. Sin tope: al volver el host, la misma página entra sola |
| D6 | Fusión de quien trabajó sin red | Hecho en proceso. El humo de recargar la pestaña real queda pendiente de esa pestaña |
| D7 | Estados visibles | Hecho. Los textos ya alcanzan. No hubo cambio en la web |
| D8 | Compactación | Hecho sin código. El estado codificado cubre H3-T3; al commitear es H4 |
| D9 | Resistencia y cierre | Hecho. F10 incluido: el segundo proceso no publica la sala |

Humo del 2026-11-12: con la sala `fe795em077k83ebp` se dibujó, se paró el host y se volvió a levantar. El mismo link mostró el tablero, 29 trazos.

Arreglo posterior, del mismo día: el orquestador compartido a veces acepta la conexión y no contesta el upgrade. El host se quedaba esperando sin límite y la sala salía como "no está abierta en este orquestador". Ahora la conexión de control tiene un límite de apertura igual al intervalo de latido, 10 s: si no abre, se reintenta. Prueba nueva en `conexion-al-orquestador.test.ts`; host 54. Además, `apps/host/scripts/run-dev.mjs` lanza `--watch` en su propio grupo de procesos, para que apagar el host no deje procesos huérfanos con la sala.

Fuera de esta épica: commits, réplica, migración de host, dos redes, Expo.

## Qué quedó alineado en los fijos

Al cerrar la épica se actualizaron dos frases que todavía describían el host de H1: en `docs/fijos/configuracion-del-entorno.md`, reiniciar el host ya no crea una sala nueva; en la fila de seguridad del análisis v2, el link sobrevive en el disco de ese host y la sala no migra a otra máquina.
