import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { cuerpoDeConverse, leerEntornoDeBedrock, llamarABedrock, textoDeLaRespuesta } from './llamar-a-bedrock.ts';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('llamada real a Bedrock', () => {
  it('arma el cuerpo solo con la imagen', () => {
    const cuerpo = cuerpoDeConverse(png);
    const claves: string[] = [];
    const recorrer = (valor: unknown) => {
      if (Array.isArray(valor)) {
        for (const item of valor) recorrer(item);
        return;
      }
      if (valor && typeof valor === 'object') {
        for (const [clave, item] of Object.entries(valor)) {
          claves.push(clave);
          recorrer(item);
        }
      }
    };
    recorrer(cuerpo);
    expect(claves).toEqual(['messages', 'role', 'content', 'image', 'format', 'source', 'bytes', 'text']);
    expect(cuerpo.messages[0].content[0].image.source.bytes).toBe(Buffer.from(png).toString('base64'));
  });

  it('lee el Markdown de la respuesta y nada más', () => {
    expect(
      textoDeLaRespuesta({
        output: { message: { content: [{ text: '  # Zona\n\nUn perro.  ' }, { text: '' }] } },
      }),
    ).toBe('# Zona\n\nUn perro.');
    expect(textoDeLaRespuesta({ output: { message: { content: [] } } })).toBeNull();
  });

  it('pide Converse con la imagen y devuelve el Markdown', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ output: { message: { content: [{ text: '# Visto' }] } } }), { status: 200 }));
    const markdown = await llamarABedrock(
      { region: 'us-east-2', modelId: 'amazon.nova-lite-v1:0', token: 'secreto' },
      png,
      fetchImpl,
    );
    expect(markdown).toBe('# Visto');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://bedrock-runtime.us-east-2.amazonaws.com/model/amazon.nova-lite-v1%3A0/converse');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secreto');
    const enviado = JSON.parse(String(init.body)) as { messages: { content: { image?: { source: { bytes: string } } }[] }[] };
    expect(enviado.messages[0]?.content[0]?.image?.source.bytes).toBe(Buffer.from(png).toString('base64'));
  });

  it('si Bedrock responde mal, no hay Markdown', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 400 }));
    await expect(
      llamarABedrock({ region: 'us-east-2', modelId: 'amazon.nova-lite-v1:0', token: 'secreto' }, png, fetchImpl),
    ).rejects.toThrow(/bedrock 400/);
  });

  it('sin región, modelo o clave no hay entorno', () => {
    expect(leerEntornoDeBedrock({})).toBeNull();
    expect(leerEntornoDeBedrock({ AWS_REGION: 'us-east-2', BEDROCK_CHAT_MODEL_ID: 'amazon.nova-lite-v1:0' })).toBeNull();
  });

  it('el camino real no importa el modelo simulado', () => {
    const fuente = readFileSync(new URL('./llamar-a-bedrock.ts', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    expect(fuente).not.toContain('modelo-simulado');
    expect(main).not.toContain('modelo-simulado');
    expect(main).toContain('llamar-a-bedrock');
  });
});
