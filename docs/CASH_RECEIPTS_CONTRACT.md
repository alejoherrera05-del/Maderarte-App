# Recibos de caja · #31

Base: main `3e9106a7a44b1bfc2a3787f176bd739f2b2ccee5`.
Referencia vigente inspeccionada: HomeEasy `aa21decbe809a91362a2cddfd272c7c5744dfddd`,
`abono.html`: documento centrado, búsqueda por OP/cliente, historial, importe,
medio, concepto, saldo resultante y confirmación seguida del documento.

Se conserva ese recorrido con marca Maderarte, tipografía del sistema, controles
accesibles y retorno contextual desde la OP. La búsqueda consulta exclusivamente
Maderarte. Los pagos iniciales ya presentes en Abonos no se suman nuevamente.

Cada recibo pertenece a una OP activa y a su sede. El servidor comprueba permisos,
conciliación de pagos y saldo esperado bajo el bloqueo compartido. Abono, saldo,
consecutivo, auditoría y resultado idempotente se confirman juntos. Una respuesta
incierta conserva el mismo identificador; nunca autoriza repetir un cobro.

El concepto es público. La nota interna no entra al PDF. El archivo se reserva
con identidad estable en la carpeta de recibos de la OP; recuperar el documento
no registra otro abono ni vuelve a calcular sus cifras históricas.

Publicación en GitHub y app.maderartepopayan.com. Validación automática en GitHub,
sin QA local ni nuevo ensayo real. Se mantienen PREPARACION y escrituras
comerciales deshabilitadas hasta habilitación expresa del propietario.
