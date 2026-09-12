import assert from 'node:assert/strict';
import { getHomeMoment } from '../public/js/core/home-moment.js';
for (const [time,key] of [['00:00','night'],['05:59','night'],['06:00','morning'],['11:59','morning'],['12:00','afternoon'],['17:59','afternoon'],['18:00','night'],['23:59','night']]) {
 const value=getHomeMoment(new Date('2026-09-12T'+time+':00-05:00'));
 assert.equal(value.key,key,time); assert.ok(value.image.endsWith(key+'-v1.png')); assert.ok(value.alt.includes('Maddy'));
}
assert.equal(getHomeMoment(new Date('2026-09-13T02:00:00Z')).dateLabel,'Sábado, 12 de septiembre');
assert.equal(getHomeMoment(new Date('2026-09-12T17:00:00Z')).greeting,'Buenas tardes');
console.log('OK: escenas, saludos y fecha usan la hora de Bogotá, incluidos medianoche y cambios de franja.');
