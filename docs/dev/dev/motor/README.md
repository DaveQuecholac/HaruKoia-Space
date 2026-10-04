# Rama `dev/motor`

Primeras dos épicas del motor colaborativo: **H0 Cimientos** y **H1 Sala por link**.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-h0-h1-cimientos-y-sala.md](./analisis-h0-h1-cimientos-y-sala.md) | Por qué esta rebanada primero, qué fija el diseño, decisiones abiertas, riesgos |
| [plan-h0-h1-cimientos-y-sala.md](./plan-h0-h1-cimientos-y-sala.md) | Quince pasos con verificación, criterios y errores previstos |

Épicas y módulos de toda la fase: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).
Arquitectura vigente: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).

## Alcance

**Entra.** Arranque verificado en las dos máquinas, andamio de pruebas, reglas del contrato de datos, registro de salas, relay, sala en vivo mínima, presencia, roles mínimos y las pantallas de entrada.

**No entra.** Lienzo (H2), persistencia de la sala (H3), commits (H4), publicación y CLI (H5), autenticación, sala global (H7).

Si algo de la segunda lista aparece en un diff de esta rama, está fuera de alcance.

## Estado

| Paso | Qué | Estado |
|------|-----|--------|
| A1 | Rama y documentación | Hecho |
| A2 | Arranque en las dos máquinas | Pendiente — falta la máquina de Kua |
| A3 | Humo de WebSocket por el proxy | Pendiente |
| A4 | Andamio de pruebas | Pendiente |
| A5 | Reglas del contrato | Pendiente |
| A6 | Formato de log | Pendiente |
| B1 | Contrato del protocolo | Pendiente |
| B2 | Registro de salas | Pendiente |
| B3 | Túnel del orquestador | Pendiente |
| B4 | Conexión del host | Pendiente |
| B5 | Sala en vivo y presencia | Pendiente |
| B6 | Web: nombre, volverme host, unirme | Pendiente |
| B7 | Resistencia y reconexión | Pendiente |
| B8 | Roles mínimos | Pendiente |
| B9 | Varios participantes y cierre | Pendiente |

El esqueleto del monorepo y el arranque con PM2 y portless ya existen del trabajo previo a esta rama; A2 es verificarlo en las dos máquinas, no construirlo.

## Decisiones

Ninguna la toma quien implementa. Están en la sección 3 del análisis con sus opciones y consecuencias.

**Confirmadas:**

| # | Decisión |
|---|----------|
| D1 | Servidor con `node:http` y `ws`, sin framework |
| D3 | **Relay por túnel inverso**: conexión de control permanente y una conexión de datos saliente por invitado |
| D8 | Vitest como runner de todo el monorepo |

**Pendientes:** D4 y D5 antes del paso B2; D2 antes de B5; D6, D7 y D9 en el paso donde aparecen.

## Decisiones que podrían malinterpretarse

1. **H1 monta la sala real sin lienzo.** No es un adelanto de H2: la presencia se apoya en el mecanismo de la sala para no construir uno que se tire.
2. **La sala no persiste en esta rama.** Reiniciar el host la deja vacía, y está bien. La persistencia es H3.
3. **El orquestador no sabe qué transporta.** Si en su código aparece vocabulario de pizarra, está mal puesto.
4. **El contrato del protocolo vive en `packages/domain`**, no dentro del orquestador ni del host.
5. **Sin `enum`, `namespace`, propiedades declaradas en el constructor ni decoradores.** Node ejecuta TypeScript quitando los tipos, no transformándolos: esas construcciones compilan y fallan al correr.
6. **El orden de épicas de este plan sustituye** al orden de la sección 12 del análisis de arquitectura v2.
