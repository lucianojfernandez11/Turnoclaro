/**
 * Frase del día que aparece debajo del saludo en la agenda.
 * Cambia una vez por día (todos los usuarios del consultorio ven la misma) y
 * recorre la lista completa antes de repetir. Para sumar frases, agregalas al final.
 */
export const FRASES: string[] = [
  "Cada turno bien organizado es un paciente mejor atendido.",
  "La puntualidad también es una forma de cuidar.",
  "Un buen día empieza con una agenda clara.",
  "Detrás de cada nombre en la agenda hay alguien que confía en este equipo.",
  "Lo que hacés hoy le ahorra una preocupación a alguien mañana.",
  "La amabilidad en la recepción es parte del tratamiento.",
  "Un paciente que se siente esperado ya se siente mejor.",
  "El orden de hoy es la tranquilidad de la semana.",
  "Escuchar con atención resuelve más de lo que parece.",
  "Pequeños detalles, grandes diferencias en la atención.",
  "Un equipo que se organiza bien atiende mejor.",
  "La calma también se contagia. Que hoy sea la nuestra.",
  "Confirmar un turno es confirmar un compromiso.",
  "Cada consulta empieza mucho antes de entrar al consultorio.",
  "Hacer bien lo simple es lo que distingue a los mejores.",
  "Hoy es una buena oportunidad para que alguien salga mejor de lo que entró.",
  "La primera sonrisa del día suele llegar desde la recepción.",
  "Un horario respetado es una muestra de respeto.",
  "La constancia en lo cotidiano construye la confianza.",
  "Atender bien no es un extra: es lo que nos define.",
  "Una agenda prolija es la mejor aliada de un buen profesional.",
  "Cada paciente recordado es un turno que no se pierde.",
  "Lo urgente se atiende; lo importante se organiza.",
  "Que cada paciente se vaya sabiendo cuál es su próximo paso.",
  "Trabajar en equipo hace que todo pese menos.",
  "Un buen trato no cuesta nada y vale muchísimo.",
  "Hoy también suma hacer las cosas con cuidado.",
  "La salud de muchos pasa por las manos de este equipo.",
  "Organizarse es la forma más concreta de cuidarse.",
  "Una respuesta clara evita diez preguntas.",
  "El esfuerzo de hoy se nota en la confianza de mañana.",
  "Cada día es una nueva oportunidad de hacerlo un poco mejor.",
  "Un paciente bien informado es un paciente más tranquilo.",
  "Lo que se planifica bien, sale bien.",
  "Que la agenda trabaje para nosotros, y no al revés.",
  "La empatía también se nota en cómo se da un turno.",
  "Gracias por hacer que este consultorio funcione cada día.",
  "La excelencia está en los detalles que nadie ve.",
  "Un día ordenado deja más tiempo para lo que importa.",
  "Detrás de una buena atención hay un gran equipo.",
  "Cuidar el tiempo de los demás es cuidar a las personas.",
  "Paso a paso, turno a turno, se construye un gran día.",
  "Hoy alguien va a agradecer que estemos acá.",
  "Mantener la calma es parte del profesionalismo.",
  "Un consultorio organizado transmite seguridad desde el primer contacto.",
  "Cada paciente que vuelve es la mejor señal de que vamos bien.",
  "Ser claro es una forma de ser amable.",
  "Las grandes atenciones están hechas de pequeños gestos.",
  "Un buen comienzo hace la mitad del trabajo.",
  "Lo que se hace con dedicación siempre se nota.",
  "Hoy es un gran día para cuidar a otros.",
  "La confianza se gana turno a turno.",
  "Un equipo comprometido es el mejor recurso de cualquier consultorio.",
  "La organización es invisible cuando funciona bien. Que hoy sea así.",
  "Atender con respeto es atender con calidad.",
  "Cada llamada atendida con paciencia deja una buena impresión.",
  "Lo que hoy parece rutina, para el paciente es importante.",
  "Que hoy cada uno se vaya un poco mejor de lo que llegó.",
  "Hacer las cosas bien a la primera ahorra tiempo a todos.",
  "Seguimos creciendo, un paciente a la vez.",
];

/** Frase para una fecha "AAAA-MM-DD": cambia cada día y recorre toda la lista antes de repetir. */
export function fraseDelDia(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  // Salto fijo coprimo con el largo de la lista: no repite y no sigue el orden de arriba.
  const step = 37;
  const idx = (((day * step) % FRASES.length) + FRASES.length) % FRASES.length;
  return FRASES[idx];
}
