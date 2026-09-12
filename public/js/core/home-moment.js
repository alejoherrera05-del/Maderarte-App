const scenes = Object.freeze({
  morning: { greeting: 'Buenos días', alt: 'Maddy da la bienvenida y prepara la jornada en Maderarte' },
  afternoon: { greeting: 'Buenas tardes', alt: 'Maddy coordina pedidos con su tableta en el almacén' },
  night: { greeting: 'Buenas noches', alt: 'Maddy cierra la jornada en el almacén iluminado' }
});
export function getHomeMoment(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23' }).format(date));
  const key = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'night';
  const label = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return { key, ...scenes[key], image: '/assets/banners/maddy-' + key + '-v1.png', dateLabel: label.charAt(0).toUpperCase() + label.slice(1) };
}
