# Rama `dev/pizarra-colaborativa`

Épica **H2 — Dibujamos los dos a la vez**: lienzo colaborativo sobre la sala Yjs que ya dejó H1.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-h2-pizarra-colaborativa.md](./analisis-h2-pizarra-colaborativa.md) | Contexto, qué hereda de H1, decisiones, riesgos, puerta Expo |
| [plan-h2-pizarra-colaborativa.md](./plan-h2-pizarra-colaborativa.md) | Pasos con verificación y checkpoint tras cada uno |
| [diseno-app-expo.md](./diseno-app-expo.md) | Diseño de la app Expo (C0). Construirla es otra autorización |

Épicas de toda la fase: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).  
Arquitectura: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).  
H0/H1 (cerradas en código): [docs/dev/dev/motor/](../motor/README.md).  
Patrones Space (Expo, SQLite, secrets): [referencia-space-powersync-sqlite-secrets.md](../../../fijos/referencia-space-powersync-sqlite-secrets.md).

## Alcance

**Entra.** Diseño documentado de la app Expo (puerta antes de código de lienzo), lienzo tldraw en la web de H1, conexión al documento Yjs de la sala, cursores/selección ajena, dibujo sin red con fusión al volver, medición de latencia de un trazo.

**No entra.** Persistencia del host al disco (H3), staging/commits (H4), publicación/CLI (H5), IA (H6), sala global (H7), autenticación, construir la app Expo completa (solo su **diseño**; las pantallas siguen en Vite hasta que se autorice construirla).

## Estado

> **H2 cerrada y aprobada (2026-11-09).** El chat la probó en la app y la aprobó. El lienzo vive en la web de Vite: tablero en el documento Yjs de la sala, cursores con nombre, log local en IndexedDB y latencia medida en el relay local. No bloquea el avance a H3. La demostración entre dos redes queda como checklist residual, igual que en H1; no reabre la épica.

| Paso | Qué | Estado |
|------|-----|--------|
| P0 | Cierre documental de H1 + carpeta de esta rama | Hecho |
| C0 | Diseño de la app Expo (puerta) | Hecho. Construir la app es otra autorización |
| C1 | Lienzo vacío en la sala | Aprobado |
| C2 | Lienzo enlazado al documento de la sala | Aprobado |
| C3 | Diez clientes dibujan a la vez | Aprobado |
| C4 | Cursor y selección de los demás | Aprobado. Se apagan si nadie se mueve |
| C5 | Sin red en el cliente y fusión al volver | Aprobado |
| C6 | Latencia de un trazo | Aprobado. Mediana 0.7 ms, peor 3.2 ms, en esta máquina |
| **H2** | Épica | **Cerrada y aprobada** → siguiente: H3, persistencia del host |

## Latencia de un trazo (C6)

**Método.** Dos clientes Yjs sin navegador. Orquestador y host de prueba en `127.0.0.1`. Cinco rondas. Quien dibuja escribe un registro JSON en el mapa `tablero`; se mide hasta que el otro documento lo observa. El objetivo de la arquitectura es por debajo de 150 ms por el relay, en la misma región.

**Resultado** (2026-11-09, esta máquina): mediana **0.7 ms**, peor **3.2 ms**. Queda por debajo del objetivo en este relay local. No es una medición entre dos redes.

## Definition of done de H2

Aprobado en la app el 2026-11-09.

1. El trazo cruza el relay local por debajo de 150 ms: sí, con el número de arriba.
2. Diez clientes convergen: la prueba de C3, vista en la app.
3. Sin red se sigue dibujando y al volver no se pierde: C5, aprobado.
4. El diseño Expo está escrito; el lienzo de H2 sigue en Vite.
5. El orquestador y el cliente del relay no tienen `tldraw` ni `pizarra`.

La demostración entre dos máquinas, con redes distintas y el mismo orquestador, no se hizo. Queda como checklist residual.

## Aprobación visual

Las pantallas de esta rama se aprueban en Open Design antes de codearlas. El artefacto tiene que verse como la pantalla que se va a construir: barra, lienzo y textos reales. Un esquema sin estilo no cuenta como diseño. La instalación local está en `~/tools/open-design` (sin MCP). `pnpm dev` lo enciende junto con las apps. La propuesta de C1 es el proyecto `harukoia-sala-c1`, archivo `sala.html`: barra arriba (sala, estado, link, participantes) y el lienzo en el resto. URL: `https://diseno.harukoia.local.iokoia.dev/`.

## Relación con H1

H1 dejó sala Yjs + presencia + relay + pantallas de entrada. H2 **no** rehace eso: monta el lienzo encima del documento compartido (decisión D2 de `dev/motor`).
