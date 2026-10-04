import { describe, expect, it } from 'vitest';

import type { Evento } from '../registro/registro.ts';
import { formatearLinea } from './formato-de-linea.ts';

const evento = (parcial: Partial<Evento> = {}): Evento => ({
  instante: new Date('2026-10-04T09:12:33.481Z'),
  nivel: 'info',
  proceso: 'orquestador',
  contexto: {},
  mensaje: 'arriba',
  ...parcial,
});

describe('forma de la línea', () => {
  it('pone instante, nivel, proceso, contexto y mensaje en ese orden', () => {
    const linea = formatearLinea(evento({ contexto: { sala: '4k7m', conexion: '9b2' } }));

    expect(linea).toBe('2026-10-04T09:12:33.481Z info  orquestador sala=4k7m conexion=9b2 arriba');
  });

  it('alinea los tres niveles al mismo ancho', () => {
    const anchos = (['info', 'aviso', 'error'] as const).map(
      (nivel) => formatearLinea(evento({ nivel })).indexOf('orquestador'),
    );

    expect(new Set(anchos).size).toBe(1);
  });

  it('omite el contexto vacío sin dejar espacios de más', () => {
    expect(formatearLinea(evento())).toBe('2026-10-04T09:12:33.481Z info  orquestador arriba');
  });

  it('acepta números y booleanos en el contexto', () => {
    const linea = formatearLinea(evento({ contexto: { puerto: 51234, reconexion: true } }));

    expect(linea).toContain('puerto=51234 reconexion=true');
  });
});

describe('garantía de una sola línea', () => {
  it('escapa los saltos de línea del mensaje', () => {
    const linea = formatearLinea(evento({ mensaje: 'falló\nsegunda línea\r\ntercera' }));

    expect(linea.split('\n')).toHaveLength(1);
    expect(linea).toContain('falló\\nsegunda línea\\ntercera');
  });

  it('escapa los saltos de línea dentro de un valor del contexto', () => {
    const linea = formatearLinea(evento({ contexto: { causa: 'ECONNRESET\n  en el socket' } }));

    expect(linea.split('\n')).toHaveLength(1);
  });

  it('quita los caracteres de control que ensucian la terminal', () => {
    const linea = formatearLinea(evento({ mensaje: 'antes\u0007\u001b despues' }));

    expect(linea).not.toMatch(/[\u0000-\u001f]/);
  });
});

describe('valores que necesitan comillas', () => {
  it('entrecomilla un valor con espacios para que el par siga siendo uno', () => {
    const linea = formatearLinea(evento({ contexto: { causa: 'token no válido' } }));

    expect(linea).toContain('causa="token no válido"');
  });

  it('no entrecomilla un valor simple', () => {
    expect(formatearLinea(evento({ contexto: { sala: '4k7m' } }))).toContain('sala=4k7m');
  });

  it('escapa las comillas internas', () => {
    const linea = formatearLinea(evento({ contexto: { causa: 'dijo "no"' } }));

    expect(linea).toContain('causa="dijo \\"no\\""');
  });

  it('representa el valor vacío en lugar de dejar la clave suelta', () => {
    expect(formatearLinea(evento({ contexto: { nombre: '' } }))).toContain('nombre=""');
  });
});

describe('seguir una sala', () => {
  it('se puede filtrar una sala completa con una búsqueda de texto', () => {
    const lineas = [
      formatearLinea(evento({ contexto: { sala: 'aaaa1111' }, mensaje: 'sala abierta' })),
      formatearLinea(evento({ contexto: { sala: 'bbbb2222' }, mensaje: 'sala abierta' })),
      formatearLinea(evento({ contexto: { sala: 'aaaa1111' }, mensaje: 'invitado entró' })),
      formatearLinea(evento({ mensaje: 'latido del orquestador' })),
    ];

    const deLaSala = lineas.filter((linea) => linea.includes('sala=aaaa1111'));

    expect(deLaSala).toHaveLength(2);
    expect(deLaSala[1]).toContain('invitado entró');
  });

  it('el filtro de una sala no atrapa otra que empiece igual', () => {
    const corta = formatearLinea(evento({ contexto: { sala: 'aaaa' } }));
    const larga = formatearLinea(evento({ contexto: { sala: 'aaaa1111' } }));

    expect(corta.includes('sala=aaaa ')).toBe(true);
    expect(larga.includes('sala=aaaa ')).toBe(false);
  });
});
