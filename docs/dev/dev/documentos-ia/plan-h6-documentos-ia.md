# Plan de acción — H6 Interpretación de una zona

Rama: `dev/documentos-ia`.  
Análisis: [analisis-h6-documentos-ia.md](./analisis-h6-documentos-ia.md).

Ningún paso de abajo autoriza código. Cada uno espera un sí en el chat.

## Reglas

1. Una rebanada, verificar, parar.
2. La entrada de Bedrock es la imagen de la zona. El JSON del tablero no arma el documento.
3. El rectángulo del recorte no se persiste.
4. El camino real llama a Bedrock. Las pruebas usan un modelo simulado y ese simulacro no se importa en el camino real.
5. Word y PDF no entran hasta que el Markdown ya se guardó. Guardar no es el botón Publicar de la pizarra.
6. Ese paso lo hace un convertidor de este motor. No se instala Pandoc ni otro conversor externo.

## Rebanadas

| # | Qué | Tareas | Verificación | Bloqueo |
|---|-----|--------|--------------|---------|
| **A** | Herramienta en la pizarra del host: rectángulo sobre lo que se ve, y campo para el nombre. Sin modelo y sin archivo | H6-T1 | Hecha en la web (2026-11-26). El host enmarca una zona, el nombre queda en la herramienta y cerrar no deja una forma nueva | — |
| **B** | Raster de esa zona: una imagen de lo que se ve dentro del rectángulo | H6-T2 | Hecha en la web (2026-11-26). Al soltar el rectángulo aparece la imagen de esa zona. No es un listado de formas | A hecha |
| **C** | Bedrock ve la imagen y devuelve el Markdown. Si falla, no hay archivo | H6-T3, H6-T6 | Hecha (2026-11-26). El host llama a Nova Lite con la imagen. El panel muestra el Markdown. Si falla, no hay archivo. Prueba con modelo simulado: misma imagen, mismo Markdown. El camino real no lee el JSON del tablero | B hecha |
| **D** | Al generar y guardar, el Markdown se guarda en `Harukoia/documentacion/<nombre>.md`. No usa Publicar | H6-T4, H6-T5 | Hecha (2026-11-26). El archivo aparece al pulsar Generar y guardar, sin Publicar. Si el título ya existe, el nuevo es «título v2.md», luego «v3», y el anterior queda | C hecha |
| **E** | Convertidor propio: ese Markdown pasa a Word y a PDF. Tres archivos. Si el convertidor falla, el Markdown queda y no hay otra llamada a Bedrock | H6-T7 | Hecha (2026-11-26). Al guardar quedan `.md`, `.docx` y `.pdf`. Borrar el Word y reintentar deja el Markdown y no llama al modelo. Sin Pandoc | D hecha |
| **F** | Pulido de la interfaz, pedido en el chat el 2026-11-26: panel de la herramienta, barra superior, panel lateral de versiones y pantalla de inicio. El host quita el bloque de código (```` ```markdown ````) que a veces envuelve la respuesta de Bedrock, antes de guardar los tres archivos | — | Hecha (2026-11-26). El panel no tapa la barra de tldraw y baja solo hasta los archivos guardados. El marco no sale del lienzo. La barra no corta textos. El `.md` guardado no empieza con ```` ``` ````. Typecheck y pruebas de host y web | E hecha |

## Huecos

Destino y nombre repetido cerrados (2026-11-26): `Harukoia/documentacion/<nombre>.md` en la raíz git del proyecto. Si ya existe, ` <nombre> v2.md`, luego `v3`, sin pisar el anterior. La pizarra sigue en `Harukoia/Pizarra`. Este gesto no hace commit ni push.

## Fuera de este plan

- Que un invitado dispare la llamada.
- Comando nuevo de CLI.
- Proceso nuevo para la IA.
- Cambiar la publicación determinista de `Harukoia/Pizarra/…`.
- Sala global (H7).
