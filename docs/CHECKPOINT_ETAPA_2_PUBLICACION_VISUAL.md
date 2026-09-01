# Checkpoint — Etapa 2A: Publicación visual temporal

Fecha de cierre: 1 de septiembre de 2026 (America/Bogota)

## Alcance aprobado

La fundación de Maderarte App quedó publicada como Cloudflare Worker con Static Assets, utilizando el repositorio público `alejoherrera05-del/Maderarte-App` y la rama `main`.

- Worker: `maderarte-app`
- URL temporal de producción: `https://maderarte-app.alejoherrera05.workers.dev`
- Commit desplegado y aprobado: `2a2b4e87f49fa96c8a4af6e881fa9fba741451fc`
- Comando de compilación en Cloudflare: ninguno
- Comando de implementación: `npx wrangler deploy`
- Directorio raíz: `/`
- Plan previsto: Workers Free

## Verificaciones completadas

### GitHub y empaquetado

- La revisión automática `Calidad` terminó correctamente sobre el commit desplegado.
- `npm ci`, `npm test` y la validación de empaquetado de Wrangler sin publicación terminaron correctamente.
- `public/` se entrega como Static Assets.
- `/api/maderarte` se ejecuta mediante el Worker en el mismo origen.

### Escritorio

- La URL de producción abre el login de Maderarte.
- HTML, CSS y JavaScript se cargan correctamente.
- El formulario y el panel visual se muestran sin errores evidentes.

### API de borde

La consulta directa a `GET /api/maderarte` respondió correctamente:

```json
{
  "status": "success",
  "code": "EDGE_OK",
  "msg": "Maderarte API disponible.",
  "data": {
    "version": "0.2.0",
    "path": "/api/maderarte"
  }
}
```

La respuesta incluyó un `requestId` único.

### iPhone y Safari

Validación manual aprobada por el propietario:

- Vista vertical correcta.
- Sin desplazamiento horizontal.
- Campos y botón accesibles.
- Panel decorativo de escritorio oculto en móvil.
- Respeto por las áreas seguras del iPhone.
- Teclado abierto sin zoom automático.
- El campo activo permanece utilizable.
- Textos legibles y sin elementos cortados.

## Barreras de seguridad vigentes

- `COMMERCIAL_WRITES` permanece en `false`.
- No hay URL privada de Apps Script configurada en Cloudflare.
- No hay secreto de proxy configurado todavía.
- El login visual no equivale aún a una sesión operativa.
- No se creó ni modificó ningún cliente, cotización, OP, abono, remisión o documento.
- No se conectó todavía el dominio principal de Maderarte.
- No se modificó el repositorio de la página pública.

## Conclusión

La Etapa 2A queda **APROBADA Y CERRADA**: la aplicación es visible y estable en la URL temporal de Cloudflare, tanto en computador como en iPhone.

## Siguiente etapa

### Etapa 2B — Dominio personalizado seguro

Objetivo: conectar únicamente `app.maderartepopayan.com`.

Antes de cambiar nameservers o registros DNS se debe:

1. Añadir `maderartepopayan.com` como zona en Cloudflare Free.
2. Inventariar y comparar todos los registros DNS detectados, especialmente raíz, `www`, MX, SPF, DKIM, DMARC y verificaciones.
3. Confirmar dónde está registrado el dominio y quién administra actualmente el correo.
4. Copiar cualquier registro faltante antes de activar los nameservers de Cloudflare.
5. Verificar que la página pública y el correo continúen funcionando.
6. Conectar el Custom Domain `app.maderartepopayan.com` al Worker.
7. Validar HTTPS, login, recursos, API y navegación móvil en el dominio final.

No se desplegará Apps Script ni se habilitarán escrituras comerciales dentro de esta etapa.
