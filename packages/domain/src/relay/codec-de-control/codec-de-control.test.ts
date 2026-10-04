import { describe, expect, it } from 'vitest';

import { generarIdentidadDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import { CANALES } from '../canal/canal.ts';
import { generarIdentificadorDeConexion } from '../conexion/conexion.ts';
import {
  CAUSAS_DE_CIERRE,
  CAUSAS_DE_RECHAZO,
  type MensajeDeControl,
  TIPOS_DEL_HOST,
  TIPOS_DEL_INVITADO,
  TIPOS_DEL_ORQUESTADOR,
} from '../mensaje-de-control/mensaje-de-control.ts';
import { generarTicket } from '../ticket/ticket.ts';
import { interpretarControl, serializarControl } from './codec-de-control.ts';

const identidad = generarIdentidadDeSala();
const conexion = generarIdentificadorDeConexion();
const ticket = generarTicket();

/** Un ejemplo de cada mensaje del protocolo. */
const TODOS: MensajeDeControl[] = [
  {
    tipo: 'registrar',
    sala: identidad.sala,
    tokenDeHost: identidad.tokenDeHost,
    tokenDeInvitacion: identidad.tokenDeInvitacion,
  },
  { tipo: 'latido' },
  { tipo: 'cerrar-sala' },
  { tipo: 'emparejar', conexion, ticket },
  { tipo: 'entrar', sala: identidad.sala, tokenDeInvitacion: identidad.tokenDeInvitacion },
  { tipo: 'registro-aceptado', sala: identidad.sala },
  { tipo: 'registro-rechazado', causa: 'sala-ocupada-por-otro-host' },
  { tipo: 'entra-invitado', conexion, canal: 'sesion', ticket },
  { tipo: 'sale-invitado', conexion },
  { tipo: 'sala-cerrada', causa: 'host-reemplazado' },
  { tipo: 'entrada-aceptada', conexion },
  { tipo: 'entrada-rechazada', causa: 'token-de-invitacion-invalido' },
  { tipo: 'emparejamiento-rechazado', causa: 'ticket-invalido' },
];

function ida(mensaje: MensajeDeControl): MensajeDeControl {
  const resultado = interpretarControl(serializarControl(mensaje));
  if (!resultado.ok) throw new Error(`no debió rechazarse: ${resultado.detalle}`);
  return resultado.mensaje;
}

describe('ida y vuelta', () => {
  it('cada mensaje del protocolo sobrevive el viaje sin cambiar', () => {
    for (const mensaje of TODOS) {
      expect(ida(mensaje)).toEqual(mensaje);
    }
  });

  it('el contrato cubre todos los tipos declarados', () => {
    const cubiertos = new Set(TODOS.map((mensaje) => mensaje.tipo));

    for (const tipo of [...TIPOS_DEL_HOST, ...TIPOS_DEL_INVITADO, ...TIPOS_DEL_ORQUESTADOR]) {
      expect(cubiertos.has(tipo)).toBe(true);
    }
  });

  it('todas las causas de rechazo y de cierre viajan', () => {
    for (const causa of CAUSAS_DE_RECHAZO) {
      expect(ida({ tipo: 'registro-rechazado', causa })).toEqual({
        tipo: 'registro-rechazado',
        causa,
      });
    }
    for (const causa of CAUSAS_DE_CIERRE) {
      expect(ida({ tipo: 'sala-cerrada', causa })).toEqual({ tipo: 'sala-cerrada', causa });
    }
  });
});

describe('un canal nuevo no toca el códec', () => {
  it('todos los canales declarados viajan sin código propio', () => {
    for (const canal of CANALES) {
      expect(ida({ tipo: 'entra-invitado', conexion, canal, ticket })).toEqual({
        tipo: 'entra-invitado',
        conexion,
        canal,
        ticket,
      });
    }
  });

  it('un canal que no está en la unión se rechaza con su causa', () => {
    const crudo = JSON.stringify({ tipo: 'entra-invitado', conexion, ticket, canal: 'replica' });

    const resultado = interpretarControl(crudo);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.causa).toBe('canal-no-soportado');
  });
});

describe('nada se ignora en silencio', () => {
  it('un tipo desconocido se rechaza como no reconocido', () => {
    const resultado = interpretarControl(JSON.stringify({ tipo: 'bailar' }));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.causa).toBe('mensaje-no-reconocido');
      expect(resultado.detalle).toContain('bailar');
    }
  });

  it.each([
    ['no es JSON', 'esto no es json'],
    ['un arreglo', '[]'],
    ['un número', '42'],
    ['nulo', 'null'],
    ['sin tipo', '{"sala":"abc"}'],
    ['tipo que no es texto', '{"tipo":7}'],
  ])('rechaza %s como mal formado', (_nombre, crudo) => {
    const resultado = interpretarControl(crudo);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.causa).toBe('mensaje-mal-formado');
  });

  it('rechaza un registro sin token de host', () => {
    const resultado = interpretarControl(
      JSON.stringify({ tipo: 'registrar', sala: identidad.sala }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.detalle).toContain('tokenDeHost');
  });

  it('rechaza un emparejamiento sin ticket', () => {
    const resultado = interpretarControl(JSON.stringify({ tipo: 'emparejar', conexion }));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.detalle).toContain('ticket');
  });

  it('rechaza una entrada sin token de invitación', () => {
    const resultado = interpretarControl(
      JSON.stringify({ tipo: 'entrar', sala: identidad.sala }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.detalle).toContain('tokenDeInvitacion');
  });

  it('rechaza un identificador de sala que no cumple el alfabeto', () => {
    const resultado = interpretarControl(
      JSON.stringify({
        tipo: 'registrar',
        sala: 'SALA!!!!!!!!!!!!',
        tokenDeHost: identidad.tokenDeHost,
        tokenDeInvitacion: identidad.tokenDeInvitacion,
      }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.causa).toBe('mensaje-mal-formado');
  });

  it('rechaza una causa inventada en lugar de aceptarla como texto', () => {
    const resultado = interpretarControl(
      JSON.stringify({ tipo: 'registro-rechazado', causa: 'porque-si' }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.causa).toBe('mensaje-mal-formado');
  });

  it('rechaza algo que no es texto', () => {
    expect(interpretarControl(new Uint8Array([1, 2, 3])).ok).toBe(false);
    expect(interpretarControl(undefined).ok).toBe(false);
  });
});

describe('el control no transporta datos', () => {
  it('un mensaje de control cabe en una línea de log', () => {
    for (const mensaje of TODOS) {
      const texto = serializarControl(mensaje);

      expect(texto.includes('\n')).toBe(false);
      expect(texto.length).toBeLessThan(200);
    }
  });

  it('ningún mensaje de control lleva vocabulario de pizarra', () => {
    const texto = TODOS.map(serializarControl).join(' ');

    for (const palabra of ['trazo', 'figura', 'lienzo', 'pizarra', 'commit']) {
      expect(texto).not.toContain(palabra);
    }
  });
});
