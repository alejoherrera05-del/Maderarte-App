const icons = {SALA:'sala',SOFA:'sala',COMEDOR:'comedor',SILLA:'silla',MESA:'mesa',ALCOBA:'alcoba',INFANTIL:'infantil',OFICINA:'oficina',COMPLEMENTO:'complemento',OTRO:'otro'};
export function furnitureIcon(category) { const key=String(category||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(); return '/assets/categories/furniture/'+(icons[key]||'otro')+'-v1.webp'; }
