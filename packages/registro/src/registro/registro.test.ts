import { describe, expect, it } from 'vitest';

import { type Evento, crearRegistro } from './registro.ts';

function registroDePrueba(proceso = 'orquestador') {
  const eventos: Evento[] = [];
  const registro = crearRegistro({
    proceso,
    destino: (evento) => eventos.push(evento),
    reloj: () => new Date('2026-10-04T09:12:33.481Z'),
  });

  return { registro, eventos };
}

describe('emisión', () => {
  it('cada evento lleva el proceso que lo emitió', () => {
    const { registro, eventos } = registroDePrueba('host');

    registro.info('arriba');

    expect(eventos[0]?.proceso).toBe('host');
  });

  it('cada nivel llega con su nivel', () => {
    const { registro, eventos } = registroDePrueba();

    registro.info('uno');
    registro.aviso('dos');
    registro.error('tres');

    expect(eventos.map((evento) => evento.nivel)).toEqual(['info', 'aviso', 'error']);
  });

  it('usa el reloj que se le inyecta', () => {
    const { registro, eventos } = registroDePrueba();

    registro.info('arriba');

    expect(eventos[0]?.instante.toISOString()).toBe('2026-10-04T09:12:33.481Z');
  });
});

describe('contexto heredado', () => {
  it('un registro de sala arrastra la sala en todas sus líneas', () => {
    const { registro, eventos } = registroDePrueba();

    const deLaSala = registro.con({ sala: '4k7m' });
    deLaSala.info('sala abierta');
    deLaSala.error('se cayó el host');

    expect(eventos.every((evento) => evento.contexto['sala'] === '4k7m')).toBe(true);
  });

  it('el contexto de la línea se suma al heredado', () => {
    const { registro, eventos } = registroDePrueba();

    registro.con({ sala: '4k7m' }).info('entró', { conexion: '9b2' });

    expect(eventos[0]?.contexto).toEqual({ sala: '4k7m', conexion: '9b2' });
  });

  it('el contexto de la línea gana sobre el heredado', () => {
    const { registro, eventos } = registroDePrueba();

    registro.con({ sala: '4k7m' }).info('relay', { sala: 'otra' });

    expect(eventos[0]?.contexto['sala']).toBe('otra');
  });

  it('se puede anidar: sala y luego conexión', () => {
    const { registro, eventos } = registroDePrueba();

    registro.con({ sala: '4k7m' }).con({ conexion: '9b2' }).info('mensaje recibido');

    expect(eventos[0]?.contexto).toEqual({ sala: '4k7m', conexion: '9b2' });
  });

  it('el registro hijo no contamina al padre', () => {
    const { registro, eventos } = registroDePrueba();

    registro.con({ sala: '4k7m' }).info('de la sala');
    registro.info('del proceso');

    expect(eventos[1]?.contexto).toEqual({});
  });

  it('una línea suelta no deja su contexto pegado a la siguiente', () => {
    const { registro, eventos } = registroDePrueba();

    registro.info('uno', { conexion: '9b2' });
    registro.info('dos');

    expect(eventos[1]?.contexto).toEqual({});
  });
});
