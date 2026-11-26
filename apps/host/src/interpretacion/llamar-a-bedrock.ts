/**
 * Llamada real a Bedrock (H6 / C). La entrada es la imagen de la zona.
 * Este módulo no importa el modelo simulado ni lee el tablero.
 */

const INSTRUCCION =
  'Miras la imagen de una zona de una pizarra. Escribe en Markdown la interpretación de lo que se ve. No agregues nada que no esté en la imagen.';

export type EntornoDeBedrock = {
  readonly region: string;
  readonly modelId: string;
  readonly token: string;
};

export function leerEntornoDeBedrock(env: NodeJS.ProcessEnv): EntornoDeBedrock | null {
  const region = env.AWS_REGION?.trim() ?? '';
  const modelId = env.BEDROCK_CHAT_MODEL_ID?.trim() ?? '';
  const token = env.AWS_BEARER_TOKEN_BEDROCK?.trim() ?? '';
  if (!/^[a-z0-9-]+$/.test(region) || modelId === '' || token === '') return null;
  return { region, modelId, token };
}

/** Cuerpo de Converse: la imagen y la instrucción. Nada más. */
export function cuerpoDeConverse(imagen: Uint8Array): {
  readonly messages: readonly [
    {
      readonly role: 'user';
      readonly content: readonly [
        { readonly image: { readonly format: 'png'; readonly source: { readonly bytes: string } } },
        { readonly text: string },
      ];
    },
  ];
} {
  return {
    messages: [
      {
        role: 'user',
        content: [
          {
            image: {
              format: 'png',
              source: { bytes: Buffer.from(imagen).toString('base64') },
            },
          },
          { text: INSTRUCCION },
        ],
      },
    ],
  };
}

export function textoDeLaRespuesta(cuerpo: unknown): string | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null;
  const content = (cuerpo as { output?: { message?: { content?: unknown } } }).output?.message?.content;
  if (!Array.isArray(content)) return null;
  const partes: string[] = [];
  for (const bloque of content) {
    if (bloque && typeof bloque === 'object' && 'text' in bloque && typeof bloque.text === 'string') {
      const texto = bloque.text.trim();
      if (texto !== '') partes.push(texto);
    }
  }
  const junto = partes.join('\n').trim();
  return junto === '' ? null : junto;
}

export async function llamarABedrock(
  entorno: EntornoDeBedrock,
  imagen: Uint8Array,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url = `https://bedrock-runtime.${entorno.region}.amazonaws.com/model/${encodeURIComponent(entorno.modelId)}/converse`;
  const respuesta = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${entorno.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cuerpoDeConverse(imagen)),
    signal: AbortSignal.timeout(60_000),
  });
  if (!respuesta.ok) {
    const detalle = (await respuesta.text()).slice(0, 300);
    throw new Error(`bedrock ${respuesta.status}: ${detalle}`);
  }
  const texto = textoDeLaRespuesta(await respuesta.json());
  if (!texto) throw new Error('bedrock sin texto');
  return texto;
}
