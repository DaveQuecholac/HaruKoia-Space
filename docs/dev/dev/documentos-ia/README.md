# Rama `dev/documentos-ia`

Épica **H6 — La IA interpreta una zona de la pizarra**.

| Documento | Qué tiene |
|-----------|-----------|
| [analisis-h6-documentos-ia.md](./analisis-h6-documentos-ia.md) | Qué hace la herramienta, qué queda del diseño anterior, mecanismo, hueco del nombre repetido |
| [plan-h6-documentos-ia.md](./plan-h6-documentos-ia.md) | Rebanadas. Ninguna autoriza código por sí sola |

Épicas: [fase-1-modulos-y-tareas.md](../../../fijos/fases/fase-1-modulos-y-tareas.md).  
Arquitectura: [analisis-arquitectura-v2.md](../../../fijos/arquitectura/analisis-arquitectura-v2.md).

## Alcance

**Entra.** Una herramienta en la pizarra. El host enmarca una zona, como un recorte de pantalla, y le pone nombre. Bedrock ve la imagen de esa zona. El host escribe en `Harukoia/documentacion/` el Markdown, el Word y el PDF, en la raíz git del proyecto. El convertidor es de este motor. Sin Pandoc ni otro conversor externo. Quien no estuvo lo baja con el git y `space update` que ya existen, cuando esos archivos estén en un commit.

**No entra.** Volcar formas, coordenadas o el JSON del tablero. Secciones fijas. Disparar la IA al hacer push de la pizarra. Un proceso nuevo. Un comando nuevo de CLI. Que alguien que no es el host dispare la llamada. Sala global (H7).

## Estado

Rebanadas **A** a **E** (2026-11-26). Generar y guardar deja tres archivos en `Harukoia/documentacion/`: Markdown, Word y PDF. El convertidor es de este motor. Si falla, el Markdown queda y el reintento no llama a Bedrock. Sin Publicar, sin commit y sin push.
