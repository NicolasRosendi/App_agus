// Traduce las maniobras de OSRM a instrucciones en castellano rioplatense.
const DIR = {
  left: 'a la izquierda', right: 'a la derecha', 'slight left': 'levemente a la izquierda', 'slight right': 'levemente a la derecha',
  'sharp left': 'cerrado a la izquierda', 'sharp right': 'cerrado a la derecha', straight: 'derecho', uturn: 'en U',
};
const KEEP = { left: 'izquierda', 'slight left': 'izquierda', 'sharp left': 'izquierda', right: 'derecha', 'slight right': 'derecha', 'sharp right': 'derecha', straight: 'centro' };

function text(step, isLast) {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name ? ` en ${step.name}` : '';
  const onto = step.name ? ` por ${step.name}` : '';
  const dir = DIR[modifier] || '';
  switch (type) {
    case 'depart': return `Arrancá${onto}`;
    case 'arrive': return isLast ? 'Llegaste a destino' : null;
    case 'turn': return modifier === 'straight' ? `Seguí derecho${onto}` : modifier === 'uturn' ? 'Pegá la vuelta en U' : `Doblá ${dir}${road}`;
    case 'new name': return `Seguí${onto}`;
    case 'continue': return modifier && modifier !== 'straight' ? `Seguí ${dir}${onto}` : `Seguí derecho${onto}`;
    case 'merge': return `Incorporate${onto}`;
    case 'on ramp': return `Tomá la bajada/subida${onto}`;
    case 'off ramp': return `Salí ${dir}${onto}`;
    case 'fork': return `En la bifurcación, mantenete a la ${KEEP[modifier] || 'derecha'}${onto}`;
    case 'end of road': return `Al final de la calle, doblá ${dir}${road}`;
    case 'roundabout':
    case 'rotary': return `En la rotonda, tomá la ${exit || 1}ª salida${onto}`;
    case 'exit roundabout':
    case 'exit rotary': return `Salí de la rotonda${onto}`;
    default: return modifier ? `Seguí ${dir}${onto}` : null;
  }
}

/** Une los pasos de todas las patas (hay varias cuando la ruta usa un waypoint de desvío). */
export function stepsFrom(route) {
  const legs = route.legs || [];
  const out = [];
  legs.forEach((leg, li) => {
    leg.steps.forEach((step, si) => {
      const t = step.maneuver.type;
      if (t === 'depart' && li > 0) return;
      if (t === 'arrive' && li < legs.length - 1) return;
      const isLast = li === legs.length - 1 && si === leg.steps.length - 1;
      const instruction = text(step, isLast);
      if (!instruction) return;
      const [lng, lat] = step.maneuver.location;
      out.push({ text: instruction, type: t, modifier: step.maneuver.modifier || null, distance: step.distance, at: { lat, lng } });
    });
  });
  // Junta "seguí por X" repetidos de la misma calle.
  return out.filter((s, i) => !(i > 0 && s.type === 'new name' && out[i - 1].text === s.text));
}
