/**
 * Reintenta Word y PDF a partir del Markdown ya guardado.
 * No manda la imagen y no pide otra interpretación.
 */

export type ResultadoDeConversion =
  | { readonly ok: true; readonly word: string; readonly pdf: string }
  | { readonly ok: false };

export async function pedirConversion(opciones: {
  readonly urlDelHost: string;
  readonly tokenDeWebDelHost: string | undefined;
  readonly ruta: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<ResultadoDeConversion> {
  if (!opciones.tokenDeWebDelHost) return { ok: false };
  const fetchImpl = opciones.fetchImpl ?? fetch;
  let respuesta: Response;
  try {
    respuesta = await fetchImpl(new URL('/interpretacion/convertir', opciones.urlDelHost), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opciones.tokenDeWebDelHost}`,
      },
      body: JSON.stringify({ ruta: opciones.ruta }),
    });
  } catch {
    return { ok: false };
  }
  if (!respuesta.ok) return { ok: false };
  try {
    const cuerpo = (await respuesta.json()) as { word?: unknown; pdf?: unknown };
    if (typeof cuerpo.word !== 'string' || typeof cuerpo.pdf !== 'string') return { ok: false };
    return { ok: true, word: cuerpo.word, pdf: cuerpo.pdf };
  } catch {
    return { ok: false };
  }
}
