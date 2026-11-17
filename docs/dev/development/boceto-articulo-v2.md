# HaruKoia: pizarra colaborativa para que la junta quede en el repositorio del equipo

Segunda versión. Texto sencillo para seguir editando. Trabajos relacionados y referencias quedan para el equipo.

## Índice

1. Título
2. Autores y filiación
3. Resumen y palabras clave
4. Introducción
5. Trabajos relacionados
6. Método
7. El proyecto
8. Resultados esperados
9. Discusión
10. Conclusiones y trabajo futuro
11. Referencias

## 1. Título

HaruKoia: pizarra colaborativa para que la junta quede en el repositorio del equipo.

## 2. Autores y filiación

Pendiente: nombres, materia y escuela.

## 3. Resumen y palabras clave

Los equipos de desarrollo usan una pizarra para ordenar ideas, planes y juntas. Al terminar, lo dibujado suele quedarse en la herramienta, y quien no estuvo no lo tiene entre los archivos de su repositorio. HaruKoia es un motor para esa sala. Las personas entran con un link, se ven y dibujan al mismo tiempo. De cada sala hay un dueño: es quien guarda una versión y, al publicar, deja un documento en el repositorio. Quien no participó puede bajar ese documento después, aunque la máquina del dueño esté apagada.

Este texto describe las tecnologías ya elegidas y los pasos con los que se está construyendo. El resultado que se espera es una sala que conserve el tablero, una versión a la que se pueda volver, y un documento en el repositorio de quien no estuvo. Esa prueba sigue pendiente.

Palabras clave (borrador): pizarra colaborativa, trabajo en equipo, documentación, repositorio.

## 4. Introducción

Una junta de un equipo de desarrollo sirve para ponerse de acuerdo: qué se va a hacer, cómo, y qué quedó pendiente. Muchas veces eso se dibuja en una pizarra. El problema aparece al salir. El dibujo se queda en la herramienta, el acuerdo se reescribe a mano en otro archivo, y quien no abrió la pizarra no se entera.

HaruKoia está pensado para equipos de desarrollo dentro de una empresa. La sala sirve para trabajar juntos en vivo. Al cerrar, el dueño de la sala publica lo acordado como documento, en un formato que el resto del equipo ya usa en sus repositorios. Quien no estuvo en la junta puede recibir ese documento en su máquina.

El documento del proyecto se genera al publicar, no mientras se dibuja. La primera forma es un markdown fijo, con la versión, los participantes, la fecha y las notas del tablero. Después, un modelo puede redactar otro markdown a partir de la misma versión, y de ahí salen también PDF y Word. El proveedor de ese modelo todavía no está elegido.

El resto del texto va así. La comparación con otras pizarras y con otras formas de dejar constancia de una junta va en trabajos relacionados. Después se explica cómo se está construyendo, con qué piezas, y en qué orden. Al final se dice qué resultado se espera y qué se podrá afirmar cuando esa prueba exista.

## 5. Trabajos relacionados

Esta sección la agrega el equipo.

Aquí va cada pizarra o cada forma de documentar una junta con la que se quiera comparar HaruKoia, y la fuente de donde sale. El proyecto solo tiene, por ahora, la diferencia que quiere lograr: que el documento llegue a la máquina del colaborador, que el markdown forme parte del sistema, que el formato le sirva a quien programa, y que se note el trabajo aunque la persona no esté dentro de la pizarra.

## 6. Método

HaruKoia se construye por partes. Cada parte se puede probar sola antes de pasar a la siguiente. El orden es el de la sección del proyecto: primero la sala, después el dibujo, después no perder el trabajo, después las versiones, después el documento en el repositorio, después la redacción con un modelo, y al final una sala que viva en un servidor.

Cada persona entra con un link y un nombre. En esta versión no hay cuentas de usuario.

De cada sala hay un dueño, el host. Los datos de esa sala y la versión que se guarda pasan por él. Un registro en la nube anota la sala y reparte el link. Por ese registro solo viaja el dibujo en vivo. Lo que se guarda para después va por otro camino, de la máquina del dueño a una copia de lectura, y al repositorio solo empuja el dueño.

No hay un estudio con usuarios. Lo que se va a poder mostrar es el propio sistema, paso por paso, con las pruebas de cada parte.

## 7. El proyecto

### Tecnologías definidas

- **Pizarra.** tldraw.
- **Sala en vivo.** Yjs. El servidor de esa sala es Hocuspocus y corre en la máquina del dueño de la sala.
- **Registro de salas.** Un orquestador en la nube. Anota la sala, entrega el link y retransmite el dibujo en vivo. No guarda el tablero.
- **Base del dueño.** SQLite, con el SDK de Node de PowerSync. El dueño escribe ahí.
- **Copia de lectura.** Postgres, PowerSync Service y un backend de escritura. Ese backend solo acepta al dueño de la sala. Invitados, web y la línea de comandos solo leen. Esta copia no pasa por el orquestador. Sirve para ver el historial aunque la máquina del dueño esté apagada.
- **Documento y repositorio.** El markdown se escribe al publicar. PDF y Word salen de ese markdown con Pandoc. Los archivos se integran a git, y solo el dueño de la sala empuja.
- **Aplicación.** La prevista para esta versión es React Native con Expo, en el navegador y en el teléfono, con la pizarra dentro de un componente de página. Un teléfono puede abrir el link. No puede ser el dueño de la sala. Las pantallas que ya se usan siguen en la web con Vite, hasta construir la aplicación de Expo.
- **Entrada.** Link de invitación y nombre.

PowerSync se usa autoalojado, en su edición abierta, con sus SDK.

### Pasos para lograrlo

1. **Levantar el motor.** Que el proyecto arranque y las pruebas corran.
2. **Entrar por un link.** Otra persona, desde otra red, entra y ve quién está.
3. **Dibujar a la vez.** Dos personas trazan en la misma pizarra, con cursor y nombre.
4. **No perder el tablero.** Si el dueño cierra la máquina, al volver la sala sigue.
5. **Guardar una versión.** Se elige qué entra, se guarda, se puede ver el historial y se puede volver a una versión anterior.
6. **Publicar en el repositorio.** Quien no estuvo obtiene el archivo. La primera publicación es el markdown fijo, para comprobar el camino sin depender de un modelo.
7. **Redactar con un modelo.** El mismo cierre produce el markdown redactado, el PDF y el Word.
8. **Sala en el servidor.** La sala puede vivir fuera de la máquina de un developer, sin que haga falta clonar el repositorio para hospedarla.

Cuando esos pasos estén cerrados, una sesión queda así. El dueño arranca su sala y comparte el link. Los invitados entran y dibujan. El dueño marca lo que entra en la versión y la guarda. Al publicar, se escriben los documentos, se integran al repositorio y se empujan. El resto del equipo los baja con git o con la línea de comandos. Si el dueño apaga su máquina, la sala en vivo se cierra. La última versión ya quedó en el repositorio y en la copia de lectura.

## 8. Resultados esperados

Las pruebas de sala y de pizarra hechas en la máquina de desarrollo no se presentan aquí como resultado del artículo. Lo que se espera obtener es esto:

- Dos personas, en redes distintas, entran con el mismo link y se ven por nombre.
- Dibujan al mismo tiempo y cada una ve el cursor de la otra.
- Un trazo cruza la sala en menos de 150 milisegundos, con las dos personas en la misma región.
- El dueño cierra la máquina y, al abrirla, el tablero sigue.
- Se guarda una versión y más tarde se puede volver a abrirla.
- Una persona que no estuvo en la junta obtiene el documento en su repositorio, con la máquina del dueño apagada.
- De esa versión salen el markdown, el PDF y el Word.

## 9. Discusión

Si esos resultados se cumplen, se podrá decir que la junta deja una versión a la que volver y un archivo en el repositorio de quien no estuvo. La sala en vivo y el documento publicado quedan separados a propósito: mientras se dibuja no se está reescribiendo el repositorio.

Hasta que esas pruebas existan, el artículo solo puede afirmar el diseño y el orden de construcción. También quedan decisiones sin cerrar: qué parte de cada versión sube a la copia de lectura, quién entrega el permiso para leerla, y qué modelo redacta el documento.

## 10. Conclusiones y trabajo futuro

HaruKoia busca que el trabajo de una junta quede como documento en el repositorio del equipo. Las piezas y el orden de los ocho pasos ya están definidos. El resultado que falta demostrar es el documento en manos de quien no estuvo, con la máquina del dueño apagada.

El trabajo que sigue es cerrar esos pasos en el orden de la sección 7, desde conservar el tablero hasta la sala en el servidor.

## 11. Referencias

Pendiente. Salen de los trabajos relacionados.
