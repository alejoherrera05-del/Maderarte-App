# Reglas del repositorio público

Se permite versionar:

- HTML, CSS y JavaScript de la aplicación.
- Pages Functions de Cloudflare.
- Código de Apps Script sin valores privados.
- Documentación y pruebas.
- Recursos gráficos aprobados y optimizados.

Está prohibido versionar:

- clientes, teléfonos, direcciones o identificaciones;
- órdenes, cotizaciones, pagos o remisiones;
- PDFs, soportes, hojas de cálculo o respaldos;
- URLs desplegadas de Apps Script;
- tokens, contraseñas, cookies o claves privadas;
- credenciales administrativas de Firebase, Cloudflare, Google o VPS;
- archivos de fuentes tipográficas;
- imágenes de identidad no aprobadas.

Los secretos se configuran en:

- Cloudflare: `MADERARTE_APPS_SCRIPT_URL` y `MADERARTE_PROXY_TOKEN`.
- Apps Script Properties: IDs de Sheet y Drive, token del proxy y clave web de Firebase.
