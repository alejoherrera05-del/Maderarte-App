# Comprobación previa al estreno

Este documento define un procedimiento técnico. Los resultados del entorno operativo, capturas y reportes internos se conservan fuera del repositorio.

1. Ejecutar `npm ci` y `npm test` sobre el commit que se pretende verificar.
2. Distinguir pruebas simuladas de verificaciones reales del servicio publicado.
3. Revisar recuperación de errores, permisos, navegación y presentación en escritorio y móvil.
4. Ensayar los documentos y el circuito comercial en el entorno aislado previsto por el proyecto, sin usar registros comerciales reales.
5. Verificar una copia recuperable de datos y documentos y su restauración aislada antes del uso empresarial.
6. Comprobar Safari en un dispositivo real: una vista estrecha de escritorio no sustituye esa prueba.

La agenda debe diferenciar carga en curso, fallo de consulta y día sin compromisos. Si falla la primera consulta, debe ofrecer reintento sin afirmar que la agenda está vacía. Si falla una actualización, debe conservar los resultados anteriores e indicar que no se pudieron actualizar.
