/**
 * Pide al host el Markdown de la zona. Manda la imagen y nada más.
 * La clave de Bedrock no sale de este módulo: no la tiene.
 */

export type ResultadoDeInterpretacion =
  | { readonly ok: true; readonly markdown: string; readonly ruta: string; readonly word: string | null; readonly pdf: string | null }
  | { readonly ok: false };

export async function pedirInterpretacion(opciones: {
  readonly urlDelHost: string;
  readonly tokenDeWebDelHost: string | undefined;
  readonly nombre: string;
  readonly imagen: Blob;
  readonly fetchImpl?: typeof fetch;
}): Promise<ResultadoDeInterpretacion> {
  if (!opciones.tokenDeWebDelHost) return { ok: false };
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const bytes = new Uint8Array(await opciones.imagen.arrayBuffer());
  let respuesta: Response;
  try {
    respuesta = await fetchImpl(new URL('/interpretacion', opciones.urlDelHost), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opciones.tokenDeWebDelHost}`,
      },
      body: JSON.stringify({ imagen: aBase64(bytes), nombre: opciones.nombre }),
    });
  } catch {
    return { ok: false };
  }
  if (!respuesta.ok) return { ok: false };
  try {
    const cuerpo = (await respuesta.json()) as { markdown?: unknown; ruta?: unknown; word?: unknown; pdf?: unknown };
    if (typeof cuerpo.markdown !== 'string' || cuerpo.markdown.trim() === '') return { ok: false };
    if (typeof cuerpo.ruta !== 'string' || cuerpo.ruta.trim() === '') return { ok: false };
    return {
      ok: true,
      markdown: cuerpo.markdown,
      ruta: cuerpo.ruta,
      word: typeof cuerpo.word === 'string' && cuerpo.word.trim() !== '' ? cuerpo.word : null,
      pdf: typeof cuerpo.pdf === 'string' && cuerpo.pdf.trim() !== '' ? cuerpo.pdf : null,
    };
  } catch {
    return { ok: false };
  }
}

function aBase64(bytes: Uint8Array): string {
  let binario = '';
  const bloque = 0x8000;
  for (let i = 0; i < bytes.length; i += bloque) {
    binario += String.fromCharCode(...bytes.subarray(i, i + bloque));
  }
  return btoa(binario);
}
