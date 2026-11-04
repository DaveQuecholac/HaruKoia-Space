# Decisiones anteriores que siguen vigentes

Este archivo **ya no es una arquitectura**. La decisión vigente está en [analisis-arquitectura-v2.md](./analisis-arquitectura-v2.md).

Lo que había aquí (MongoDB como maestro, NestJS, un worker aparte, y RxDB en el navegador y en el CLI) quedó fuera. No se usa para implementar.

## Lo que sí sigue

- El motor se escribe en este repositorio. IOKOIA Space no se modifica desde aquí: sus módulos se traen cuando el motor funcione. `iokdev-cli` es mapa de dominio, no el sitio donde se escribe este código.
- Un monorepo. El esquema compartido vive en un paquete, no copiado por proceso.
- Una capacidad nueva es un módulo del motor hasta que cumpla el criterio de [por-que-no-microservicios.md](./por-que-no-microservicios.md).
- La sala en vivo es **Yjs con Hocuspocus**. La réplica no lleva el tablero mientras se dibuja.
- El lienzo es **tldraw**. Un lienzo propio no es el valor del producto.
- El markdown se genera al publicar, no mientras se dibuja. Git sigue siendo la copia que el equipo revisa.
- La interfaz es de herramienta interna: el lienzo ocupa la junta; publicar, quién está y el estado viven en un margen; después de publicar se lee el markdown; la presencia lleva nombre; el fallo del modelo se muestra como estado, no como un error de red; el CLI es parte de la interfaz.

La gramática visual de IOKOIA Space (React DOM, Tailwind, Base UI) era de esa propuesta. Con React Native en la v1, esa gramática no se trae tal cual. El diseño de la app Expo es el siguiente documento, antes de H2.

## Módulos de IOKOIA Space que este motor tiene que poder recibir

Sistema de diseño, git, tareas, minutas, calendario, correo, agentes de IA, depuración, metas, procedimientos, entidades y autenticación (Authentik, OIDC). Cada uno entra como colecciones, pantallas y comandos del mismo motor. No entra como un servicio nuevo. Están fuera de la fase 1.
