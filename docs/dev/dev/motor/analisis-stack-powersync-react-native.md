# Decisión cerrada — PowerSync y React Native

La comparación de opciones que vivía en este archivo ya se cerró. No se usa para elegir de nuevo.

| Decisión | Resultado | Fecha |
|---|---|---|
| Base local y réplica | **PowerSync.** El host escribe en su SQLite. Una réplica central de lectura (backend de escritura, Postgres, PowerSync Service) solo la alimenta el host. La sala en vivo no pasa por ahí | 2026-10-19 |
| RxDB | **Fuera.** No se instala | 2026-10-19 |
| Frontend de la v1 | **React Native con Expo**, en web y en móvil. tldraw va en un componente DOM. Un teléfono no es host local | 2026-11-04 |

El detalle está en [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).

## Qué falta escribir antes de construir

1. **Antes de H2.** El diseño de la app Expo: pantallas, lienzo, y cómo arranca con PM2 y portless. Las pantallas de H1 siguen en Vite hasta que ese diseño exista y se autorice construir la app. Para SQLite RN, secrets (`expo-secure-store`) y Metro: partir de [referencia Space](../../../fijos/referencia-space-powersync-sqlite-secrets.md).
2. **Antes de H4.** El diseño de la réplica central. **Cerrado el 2026-11-17** en [analisis-replica-central.md](../versiones-pizarra/analisis-replica-central.md). Plan de la PdC: [plan-replica-central.md](../versiones-pizarra/plan-replica-central.md). Índice histórico: [plan-pdc-stack-powersync-react-native.md](./plan-pdc-stack-powersync-react-native.md).
