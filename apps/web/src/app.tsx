import { useEffect, useState } from 'react';

import { leerConfiguracion } from './configuracion/configuracion.ts';
import { type Invitacion, crearEnlace, esRutaDeSala, leerEnlace } from './entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import { Inicio } from './entrada/inicio/inicio.tsx';
import { guardarNombre, leerNombre } from './entrada/nombre-recordado/nombre-recordado.ts';
import { PedirNombre } from './entrada/pedir-nombre/pedir-nombre.tsx';
import { marcarComoHost, rolEnLaPestana } from './host/rol-en-la-pestana/rol-en-la-pestana.ts';
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

  function serHost(invitacion: Invitacion) {
    marcarComoHost(sessionStorage, invitacion.sala);
    navegar(crearEnlace(window.location.origin, invitacion));
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
          rol={rolEnLaPestana(sessionStorage, invitacion.sala)}
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
