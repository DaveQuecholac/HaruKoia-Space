const ayuda = `space — CLI del motor colaborativo HaruKoia

Comandos de la fase 1 (todavía sin implementar):
  space host      arranca el contenedor host para este checkout y registra la sala
  space status    qué versión local hay y si la réplica está al día
  space update    baja las versiones publicadas y escribe el markdown en el repo

Diseño: docs/fijos/arquitectura/analisis-arquitectura-v2.md
`;

export async function run(argv: string[]): Promise<number> {
  const comando = argv[0];

  if (!comando || comando === '-h' || comando === '--help') {
    process.stdout.write(ayuda);
    return 0;
  }

  process.stderr.write(`Comando no implementado: ${comando}\n`);
  return 1;
}
