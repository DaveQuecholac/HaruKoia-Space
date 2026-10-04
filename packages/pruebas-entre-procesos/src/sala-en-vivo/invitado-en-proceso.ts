/**
 * Un invitado en su propio proceso, para poder congelarlo con `SIGSTOP`: es
 * lo más parecido a una laptop que se suspende. Su conexión queda abierta y
 * muda, sin cierre que avise.
 *
 * Uso: node invitado-en-proceso.ts <base> <sala> <token> <nombre>
 */

import { comoIdentificadorDeSala, comoTokenDeInvitacion } from '@harukoia/domain';

import { invitadoDeLaSala } from './invitado-de-la-sala.ts';

const [base, sala, token, nombre] = process.argv.slice(2);
if (!base || !sala || !token || !nombre) {
  console.error('uso: invitado-en-proceso.ts <base> <sala> <token> <nombre>');
  process.exit(2);
}

const invitado = invitadoDeLaSala({
  base,
  sala: comoIdentificadorDeSala(sala),
  token: comoTokenDeInvitacion(token),
  nombre,
});

invitado.proveedor.on('synced', () => console.log('dentro'));
