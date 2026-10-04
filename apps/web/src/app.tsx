import type { TokenDeWebDelHost } from '@harukoia/domain';
import { useEffect, useState } from 'react';

import { leerConfiguracion } from './configuracion/configuracion.ts';
import { type Invitacion, crearEnlace, esRutaDeSala, leerEnlace } from './entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import { Inicio } from './entrada/inicio/inicio.tsx';
import { guardarNombre, leerNombre } from './entrada/nombre-recordado/nombre-recordado.ts';
import { PedirNombre } from './entrada/pedir-nombre/pedir-nombre.tsx';
import { guardarCredencialDeHost, leerCredencialDeHost } from './host/credencial-de-host/credencial-de-host.ts';
import { PantallaDeSala } from './sala/pantalla-de-sala/pantalla-de-sala.tsx';

const configuracion = leerConfiguracion();

export function App() {
  const [ubicacion, setUbicacion] = useState(() => window.location.href);
  const [nombre, setNombre] = useState(() => leerNombre(localStorage));
  const [cambiandoNombre, setCambiandoNombre] = useState(false);

  useEffect(() => {
    const alVolver = () => setUbicacion(window.location.href);
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  function navegar(url: string) {
    window.history.pushState(null, '', url);
    setUbicacion(window.location.href);
  }

  function elegirNombre(elegido: string) {
    guardarNombre(localStorage, elegido);
    setNombre(elegido);
    setCambiandoNombre(false);
  }

  function serHost(invitacion: Invitacion, tokenDeWebDelHost: TokenDeWebDelHost) {
    guardarCredencialDeHost(sessionStorage, invitacion.sala, tokenDeWebDelHost);
    navegar(crearEnlace(window.location.origin, invitacion));
  }

  /** El link viejo ya no sirve: se reemplaza en la barra, sin dejarlo en el historial. */
  function cambiarElLinkEnLaBarra(invitacion: Invitacion) {
    window.history.replaceState(null, '', crearEnlace(window.location.origin, invitacion));
    setUbicacion(window.location.href);
  }

  return (
    <main>
      <h1>HaruKoia</h1>
      {contenido()}
    </main>
  );

  function contenido() {
    if ('falta' in configuracion) {
      return <p role="alert">Falta {configuracion.falta} en apps/web/.env. Cópialo de .env.example.</p>;
    }
    if (!nombre || cambiandoNombre) return <PedirNombre inicial={nombre} alElegir={elegirNombre} />;

    if (esRutaDeSala(new URL(ubicacion).pathname)) {
      const invitacion = leerEnlace(ubicacion);
      if (!invitacion) {
        return (
          <p role="alert">
            Este link de invitación está incompleto o roto. Pídele al host que te lo copie de nuevo.{' '}
            <button type="button" onClick={() => navegar('/')}>
              Ir al inicio
            </button>
          </p>
        );
      }
      return (
        <PantallaDeSala
          orquestador={configuracion.orquestador}
          invitacion={invitacion}
          nombre={nombre}
          tokenDeWebDelHost={leerCredencialDeHost(sessionStorage, invitacion.sala)}
          alCambiarLaInvitacion={(tokenDeInvitacion) => cambiarElLinkEnLaBarra({ sala: invitacion.sala, tokenDeInvitacion })}
          alSalir={() => navegar('/')}
        />
      );
    }

    return (
      <Inicio
        nombre={nombre}
        urlDelHost={configuracion.host}
        alCambiarNombre={() => setCambiandoNombre(true)}
        alSerHost={serHost}
        alUnirse={navegar}
      />
    );
  }
}
