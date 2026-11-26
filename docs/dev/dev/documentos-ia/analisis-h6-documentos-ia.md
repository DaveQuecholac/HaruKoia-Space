# Análisis — H6 La IA interpreta una zona de la pizarra

Rama: `dev/documentos-ia`.  
Plan: [plan-h6-documentos-ia.md](./plan-h6-documentos-ia.md).  
Épica: [fase-1 §9](../../../fijos/fases/fase-1-modulos-y-tareas.md).

## 1. Qué hace la herramienta

Está en la aplicación y la usa el host. Al elegirla, la pizarra sigue a la vista. El host dibuja un rectángulo sobre la zona que Bedrock tiene que mirar, igual que al recortar una captura de pantalla, y escribe el nombre del documento.

El host toma la imagen de esa zona y la manda a Bedrock. Lo que vuelve es un Markdown: la interpretación de lo que se ve. Ese archivo se escribe en `Harukoia/documentacion/<nombre>.md`, en la raíz git del proyecto. La pizarra sigue en `Harukoia/Pizarra`. En el mismo gesto el convertidor propio escribe el Word y el PDF en esa carpeta.

El rectángulo no se guarda. Las formas y las coordenadas siguen siendo asunto de la pizarra y de su publicación (H4 y H5). El documento de la IA no nace vacío: si no hay zona enmarcada, no hay llamada y no hay archivo.

Word y PDF salen del mismo Markdown, con un convertidor de este motor. No se instala Pandoc ni otro conversor externo. Quedan tres archivos. Si el convertidor falla, el Markdown queda y no hay otra llamada a Bedrock.

## 2. Qué quedó atrás

El texto anterior de H6 hacía otra cosa: al hacer push, el modelo leía el snapshot y el JSON del tablero, validaba secciones fijas y, si no validaba, guardaba la salida cruda. Eso está superado en la fase 1 y en la arquitectura v2 (2026-11-26).

En el código de H5, `packages/domain/src/documento/variante-de-publicacion/variante-de-publicacion.ts` todavía dice que H6 agregará un miembro `markdown-con-ia` a la publicación determinista. Esa nota no se sigue. La publicación de `Harukoia/Pizarra/…` sigue sin modelo.

## 3. Qué se reutiliza

Revisado el CLI de este repo (`apps/cli`) y el de IOKOIA Space (`/home/davesq/Documents/IoKoia/space/`):

| Pieza | Qué hay | Uso en H6 |
|-------|---------|-----------|
| `space host` / `status` / `update` | El update es un `git pull` del proyecto | El Markdown de la IA llega igual que el resto de generados. No hace falta un comando nuevo |
| `Harukoia/documentacion/` | Salidas de la herramienta de IA. Decidido el 2026-11-26 | Ahí caen `<nombre>.md`, `<nombre>.docx` y `<nombre>.pdf` |
| `Harukoia/Pizarra/…` | JSON del tablero y markdown determinista | Sigue igual. No es la entrada de Bedrock |
| IOKOIA Space | No hay un generador de documentos de pizarra ni una llamada a Bedrock que copiar | Space no se modifica desde este repo |

La llamada a Bedrock sale del host. No hay proceso nuevo.

## 4. Mecanismo

```
Mecanismo de la capacidad: interpretar lo que se ve en una zona de la pizarra y escribir un documento con el nombre elegido.
Variantes de hoy: Markdown de esa interpretación (Bedrock, imagen de la zona).
Variantes probables siguientes: Word y PDF por el convertidor propio, a partir de ese Markdown. Son conversión del mismo archivo, no otra lectura del tablero.
Módulo dueño: M12 (interpretación). M13 es el convertidor propio. M14 y el CLI entregan el archivo.
Plugins: la fuente de hoy es el recorte de la pizarra. Bedrock es el modelo de hoy.
Prueba de extensión: Word y PDF no agregan un lector nuevo. Otra fuente visual sería un miembro de la unión de fuentes, no un campo en el contrato del tablero.
Patrón existente a extender: la copia de trabajo, el git y `space update` de H5. No la variante `markdown-determinista`.
```

## 5. Hueco

Destino cerrado (2026-11-26): `Harukoia/documentacion/<nombre>.md` en la raíz git del proyecto. `Harukoia/Pizarra` no se mueve. Guardar no es el botón **Publicar** de la pizarra: al generar y guardar, ese gesto escribe el archivo. No hace commit ni push.

Si el título ya existe, el archivo nuevo se llama `<nombre> v2.md`, luego `<nombre> v3.md`, y así. El anterior no se pisa.

## 6. Errores

| Caso | Qué pasa |
|------|----------|
| No hay zona enmarcada | No hay llamada y no hay archivo |
| Bedrock falla o tarda | No se escribe el Markdown. La pizarra y su publicación siguen |
| El nombre ya existe | Se escribe otro archivo: `v2`, `v3`, … El anterior queda |
| El convertidor propio falla | El Markdown queda. Se reintenta la conversión sin otra llamada a Bedrock |

## 7. Definition of done de la épica

1. El host enmarca una zona, le pone nombre, y queda el Markdown de lo que Bedrock vio.
2. Ese archivo no es el volcado de formas ni de coordenadas.
3. El Markdown se guarda al generar y guardar, en `Harukoia/documentacion/`. Si el nombre ya existe, el nuevo lleva `v2`, `v3`, …
4. Word y PDF salen de ese Markdown con el convertidor propio, sin una segunda lectura del tablero y sin Pandoc.
