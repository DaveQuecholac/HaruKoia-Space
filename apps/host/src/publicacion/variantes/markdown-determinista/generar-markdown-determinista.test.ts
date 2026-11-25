import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  FORMATO_DE_TABLERO,
  generarIdentificadorDeCommit,
  type TableroEnJson,
} from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import type { EntradaDePublicacion } from '../../mecanismo/variante-de-formato.ts';
import {
  bytesDelMarkdownDeterminista,
  generarMarkdownDeterminista,
} from './generar-markdown-determinista.ts';

/** Commit id fijo (16 hex) para snapshots estables. */
const COMMIT_FIJO = 'aaaaaaaaaaaaaaaa' as EntradaDePublicacion['commit']['id'];

function entradaFixture(parcial?: {
  mensaje?: string;
  participantes?: readonly string[];
  creadoEn?: number;
  tablero?: TableroEnJson;
}): EntradaDePublicacion {
  return {
    commit: {
      id: COMMIT_FIJO,
      mensaje: parcial?.mensaje ?? 'primera version',
      autor: 'Hector',
      participantes: parcial?.participantes ?? ['Hector', 'Ana'],
      creadoEn: parcial?.creadoEn ?? Date.UTC(2026, 10, 25, 15, 0, 0),
    },
    tablero: parcial?.tablero ?? {
      formato: FORMATO_DE_TABLERO,
      formas: [
        {
          tipo: 'figura',
          id: 'fig-b',
          figura: 'texto',
          x: 10,
          y: 20,
          rotacion: 0,
          indice: 'a2',
          padre: 'pagina-1',
          bloqueado: false,
          opacidad: 1,
          props: { text: 'hola' },
          meta: {},
        },
        {
          tipo: 'figura',
          id: 'fig-a',
          figura: 'geo',
          x: 0,
          y: 0,
          rotacion: 0,
          indice: 'a1',
          padre: 'pagina-1',
          bloqueado: false,
          opacidad: 1,
          props: { w: 100, h: 50 },
          meta: {},
        },
      ],
    },
  };
}

describe('generar markdown determinista (P5)', () => {
  it('fixture fijo → mismos bytes y hash estable', () => {
    const entrada = entradaFixture();
    const a = bytesDelMarkdownDeterminista(entrada);
    const b = bytesDelMarkdownDeterminista(entrada);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);

    const texto = generarMarkdownDeterminista(entrada);
    expect(texto).toMatchSnapshot();

    // Hash concreto del fixture (mismo input → mismos bytes).
    expect(createHash('sha256').update(a).digest('hex')).toBe(
      'a5795e77bd03cd4167a42f46030366c05f937ffd43e50378830a8f665b7ae552',
    );
  });

  it('cambiar un campo del commit → markdown distinto', () => {
    const base = bytesDelMarkdownDeterminista(entradaFixture());
    const conOtroMensaje = bytesDelMarkdownDeterminista(
      entradaFixture({ mensaje: 'segunda version' }),
    );
    expect(Buffer.from(base).equals(Buffer.from(conOtroMensaje))).toBe(false);

    const conOtroParticipante = bytesDelMarkdownDeterminista(
      entradaFixture({ participantes: ['Hector', 'Ana', 'Luis'] }),
    );
    expect(Buffer.from(base).equals(Buffer.from(conOtroParticipante))).toBe(false);
  });

  it('participantes y formas se ordenan de forma estable', () => {
    const desordenado = generarMarkdownDeterminista(
      entradaFixture({ participantes: ['Zoe', 'Ana', 'Hector'] }),
    );
    const ordenado = generarMarkdownDeterminista(
      entradaFixture({ participantes: ['Ana', 'Hector', 'Zoe'] }),
    );
    expect(desordenado).toBe(ordenado);
    // Formas: fig-a antes que fig-b aunque el array venga al revés.
    expect(desordenado.indexOf('fig-a')).toBeLessThan(desordenado.indexOf('fig-b'));
  });

  it('incluye versión, participantes, fecha y datos del tablero', () => {
    const texto = generarMarkdownDeterminista(entradaFixture());
    expect(texto).toContain('## Versión');
    expect(texto).toContain(`id: ${COMMIT_FIJO}`);
    expect(texto).toContain('## Participantes');
    expect(texto).toContain('- Ana');
    expect(texto).toContain('## Fecha');
    expect(texto).toContain('2026-11-25T15:00:00.000Z');
    expect(texto).toContain('## Tablero');
    expect(texto).toContain('### Formas');
  });

  it('sin llamadas a red ni modelo en el generador', () => {
    const fuente = fs.readFileSync(
      path.join(import.meta.dirname, 'generar-markdown-determinista.ts'),
      'utf8',
    );
    expect(fuente).not.toMatch(/\bfetch\b/);
    expect(fuente).not.toMatch(/\bhttp\b/i);
    expect(fuente).not.toMatch(/\bopenai\b/i);
    expect(fuente).not.toMatch(/\banthropic\b/i);
    expect(fuente).not.toMatch(/\bWebSocket\b/);
  });

  it('acepta cualquier IdentificadorDeCommit generado', () => {
    const id = generarIdentificadorDeCommit();
    const entrada = entradaFixture();
    const conId = {
      ...entrada,
      commit: { ...entrada.commit, id },
    };
    const texto = generarMarkdownDeterminista(conId);
    expect(texto).toContain(`id: ${id}`);
  });
});
