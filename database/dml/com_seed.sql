-- ============================================================================
-- Seed de catalogos base del modulo de Compras (COM_).
-- Idempotente: las columnas UNIQUE (CODIGO / NOMBRE) evitan duplicados; el
-- script de despliegue ignora ORA-00001.
-- Capa 1 - database/dml/
-- ============================================================================

-- Monedas (CODIGO es UNIQUE)
INSERT INTO COM_MONEDA (CODIGO, NOMBRE, SIMBOLO, ACTIVA) VALUES ('GTQ', 'Quetzal', 'Q', 'S');
INSERT INTO COM_MONEDA (CODIGO, NOMBRE, SIMBOLO, ACTIVA) VALUES ('USD', 'Dólar estadounidense', '$', 'S');
INSERT INTO COM_MONEDA (CODIGO, NOMBRE, SIMBOLO, ACTIVA) VALUES ('EUR', 'Euro', 'EUR', 'S');

-- Condiciones de pago (NOMBRE es UNIQUE)
INSERT INTO COM_CONDICION_PAGO (NOMBRE, DIAS) VALUES ('Contado', 0);
INSERT INTO COM_CONDICION_PAGO (NOMBRE, DIAS) VALUES ('Crédito 15 días', 15);
INSERT INTO COM_CONDICION_PAGO (NOMBRE, DIAS) VALUES ('Crédito 30 días', 30);
INSERT INTO COM_CONDICION_PAGO (NOMBRE, DIAS) VALUES ('Crédito 60 días', 60);

-- Terminos de entrega (NOMBRE es UNIQUE)
INSERT INTO COM_TERMINO_ENTREGA (NOMBRE, DIAS_ESTIMADOS) VALUES ('Inmediata', 1);
INSERT INTO COM_TERMINO_ENTREGA (NOMBRE, DIAS_ESTIMADOS) VALUES ('Estándar 5 días', 5);
INSERT INTO COM_TERMINO_ENTREGA (NOMBRE, DIAS_ESTIMADOS) VALUES ('Importación 30 días', 30);

-- Categorias y grupos de compra (NOMBRE UNIQUE en ambas)
INSERT INTO COM_CATEGORIA_COMPRA (NOMBRE, DESCRIPCION, ESTADO) VALUES ('Mercadería', 'Bienes para reventa', 'A');
INSERT INTO COM_CATEGORIA_COMPRA (NOMBRE, DESCRIPCION, ESTADO) VALUES ('Servicios', 'Servicios contratados', 'A');
INSERT INTO COM_CATEGORIA_COMPRA (NOMBRE, DESCRIPCION, ESTADO) VALUES ('Activos fijos', 'Bienes de capital', 'A');

INSERT INTO COM_GRUPO_COMPRA (ID_CATEGORIA_COMPRA, NOMBRE, DESCRIPCION)
  SELECT ID_CATEGORIA_COMPRA, 'Insumos generales', 'Grupo por defecto de mercadería'
  FROM COM_CATEGORIA_COMPRA WHERE NOMBRE = 'Mercadería';
INSERT INTO COM_GRUPO_COMPRA (ID_CATEGORIA_COMPRA, NOMBRE, DESCRIPCION)
  SELECT ID_CATEGORIA_COMPRA, 'Mantenimiento', 'Servicios de mantenimiento'
  FROM COM_CATEGORIA_COMPRA WHERE NOMBRE = 'Servicios';

-- Centros de costo (CODIGO es UNIQUE)
INSERT INTO COM_CENTRO_COSTO (CODIGO, NOMBRE, ESTADO) VALUES ('CC-ADM', 'Administración', 'A');
INSERT INTO COM_CENTRO_COSTO (CODIGO, NOMBRE, ESTADO) VALUES ('CC-OPS', 'Operaciones', 'A');
INSERT INTO COM_CENTRO_COSTO (CODIGO, NOMBRE, ESTADO) VALUES ('CC-VEN', 'Ventas', 'A');

COMMIT;
