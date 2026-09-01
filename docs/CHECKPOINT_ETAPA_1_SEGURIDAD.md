# Checkpoint — Etapa 1: Fundación segura

Fecha de cierre: 31 de agosto de 2026 (America/Bogota)

## Estado aprobado

- Repositorio público correcto: `alejoherrera05-del/Maderarte-App`.
- Aplicación HTML multipágina organizada en `public/`.
- Código del Cerebro organizado en `apps-script/`.
- Frontera de Cloudflare organizada en `functions/api/`.
- Base oficial nueva: `Base de Datos Maderarte App`.
- Registros comerciales iniciados en cero, sin migración.
- Identidad Firebase compartida con HomeEasy; autorización, roles y sesiones exclusivos de Maderarte.
- Usuario propietario registrado y activo en la base.
- Sedes iniciales: Principal y Terraplaza.
- Escrituras comerciales deshabilitadas.
- Integración de WhatsApp aplazada; usará el VPS actual con componentes aislados.

## Verificaciones realizadas

- Se revisaron las pestañas comerciales y permanecen sin clientes, cotizaciones, órdenes, productos, abonos, producción, remisiones ni documentos de prueba.
- Se compararon los encabezados reales del Sheet con el contrato de Apps Script.
- Se corrigió la pestaña `Sedes`: `Direccion`, `Telefono` y `Estado` quedaron como columnas independientes.
- La lista de valores `ACTIVA` / `INACTIVA` quedó aplicada exclusivamente a `Estado`.
- El Cerebro ahora rechaza encabezados duplicados en cualquier pestaña contratada.
- Las pruebas automáticas protegen el contrato completo de `Sedes` y la detección de duplicados.
- GitHub Actions terminó correctamente después de los cambios.
- Se creó un respaldo de la base al cerrar esta etapa.

## Barreras de seguridad vigentes

- `COMMERCIAL_WRITES` continúa en `false`.
- `MODO_OPERACION` continúa en `PREPARACION`.
- No hay URL de Apps Script expuesta en GitHub.
- No hay IDs de Sheets o Drive configurados directamente dentro del código público.
- `.clasp.json`, `.clasprc.json`, `.env` y credenciales locales están excluidos por `.gitignore`.
- El repositorio de la página pública de Maderarte no forma parte de este sistema.

## Próxima etapa

### Etapa 2 — Instalación controlada del Cerebro

1. Crear un proyecto nuevo de Google Apps Script llamado `Maderarte App — Cerebro`.
2. Vincularlo localmente mediante `clasp`, sin versionar el ID del proyecto ni las credenciales.
3. Subir los archivos de `apps-script/`.
4. Configurar propiedades privadas desde la interfaz de Apps Script.
5. Ejecutar `verificarBaseCero()` y autorizar los permisos de Google.
6. Desplegar el Web App únicamente después de que la comprobación sea exitosa.
7. Mantener las escrituras comerciales bloqueadas.

## Criterio de salida de la Etapa 2

La etapa se considerará terminada únicamente cuando:

- el proyecto de Apps Script exista;
- el código de GitHub y Apps Script coincida;
- `verificarBaseCero()` termine sin errores;
- la URL `/exec` responda al diagnóstico del Cerebro;
- el secreto del proxy no esté en GitHub;
- no se haya creado ningún registro comercial.
