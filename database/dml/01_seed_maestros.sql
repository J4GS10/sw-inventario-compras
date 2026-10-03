-- ============================================================================
-- Seed de datos maestros para que los catalogos y selects del modulo de
-- Compras tengan contenido util. Idempotente (UNIQUE / NOT EXISTS).
-- Capa 1 - database/dml/  ·  se aplica con `pnpm db:deploy`.
-- ============================================================================

-- ---- Departamentos (NOM_DEPARTAMENTO) — usados por Centros de costo ----------
INSERT INTO NOM_DEPARTAMENTO (NOMBRE)
SELECT v.n FROM (
  SELECT 'Direccion General' n FROM dual UNION ALL
  SELECT 'Administracion y Finanzas' FROM dual UNION ALL
  SELECT 'Compras y Abastecimiento' FROM dual UNION ALL
  SELECT 'Operaciones y Logistica' FROM dual UNION ALL
  SELECT 'Comercial y Ventas' FROM dual UNION ALL
  SELECT 'Tecnologia' FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM NOM_DEPARTAMENTO d WHERE d.NOMBRE = v.n);

-- ---- Unidades de medida (INV_UNIDAD_MEDIDA) --------------------------------
INSERT INTO INV_UNIDAD_MEDIDA (CODIGO, NOMBRE, ABREVIATURA)
SELECT v.c, v.n, v.a FROM (
  SELECT 'DOC' c, 'Docena' n, 'doc' a FROM dual UNION ALL
  SELECT 'PAR', 'Par', 'par' FROM dual UNION ALL
  SELECT 'JGO', 'Juego', 'jgo' FROM dual UNION ALL
  SELECT 'KG', 'Kilogramo', 'kg' FROM dual UNION ALL
  SELECT 'LB', 'Libra', 'lb' FROM dual UNION ALL
  SELECT 'LT', 'Litro', 'lt' FROM dual UNION ALL
  SELECT 'GAL', 'Galon', 'gal' FROM dual UNION ALL
  SELECT 'MT', 'Metro', 'm' FROM dual UNION ALL
  SELECT 'ROLLO', 'Rollo', 'rll' FROM dual UNION ALL
  SELECT 'SACO', 'Saco', 'sc' FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM INV_UNIDAD_MEDIDA u WHERE u.CODIGO = v.c);

-- ---- Articulos (INV_ARTICULO) -------------------------------------------
INSERT INTO INV_ARTICULO (CODIGO, NOMBRE, DESCRIPCION, ID_CATEGORIA, ID_UNIDAD_MEDIDA, TIPO_ARTICULO)
SELECT v.c, v.n, v.d,
       (SELECT MIN(ID_CATEGORIA) FROM INV_CATEGORIA WHERE ELIMINADO = 'N'),
       (SELECT ID_UNIDAD_MEDIDA FROM INV_UNIDAD_MEDIDA WHERE CODIGO = v.um),
       v.t
FROM (
  SELECT 'TOR-M6'   c, 'Tornillo hexagonal M6 x 40mm'        n, 'Acero galvanizado, caja x 100'  d, 'UND'   um, 'MERCADERIA_VENTA'      t FROM dual UNION ALL
  SELECT 'TUB-PVC1', 'Tubo PVC 1 pulgada x 6m',              'Presion, cedula 40',                 'UND',  'MERCADERIA_VENTA'       FROM dual UNION ALL
  SELECT 'PIN-BLA',  'Pintura latex blanca',                 'Cubeta 5 galones, interior/exterior','GAL',  'MERCADERIA_VENTA'       FROM dual UNION ALL
  SELECT 'CEM-GRIS', 'Cemento gris tipo I',                  'Saco 42.5 kg',                       'SACO', 'MERCADERIA_VENTA'       FROM dual UNION ALL
  SELECT 'CBL-THHN', 'Cable electrico THHN #12',             'Rollo 100 m, cobre',                 'ROLLO','MERCADERIA_VENTA'       FROM dual UNION ALL
  SELECT 'GUA-NIT',  'Guantes de nitrilo (par)',             'Talla estandar, resistente quimicos','PAR',  'MATERIAL_USO_INTERNO'   FROM dual UNION ALL
  SELECT 'PAP-BOND', 'Papel bond carta 75g',                 'Resma 500 hojas',                    'UND',  'MATERIAL_USO_INTERNO'   FROM dual UNION ALL
  SELECT 'LAP-COMP', 'Laptop de oficina',                    'Equipo de computo estandar',         'UND',  'ACTIVO_FIJO'            FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM INV_ARTICULO a WHERE a.CODIGO = v.c);

-- ---- Sucursales (NOM_SUCURSAL) ---------------------------------------
INSERT INTO NOM_SUCURSAL (CODIGO, NOMBRE, TIPO, DIRECCION, TELEFONO, ESTADO)
SELECT v.c, v.n, v.t, v.dir, v.tel, 'A' FROM (
  SELECT 'SUC-02' c, 'Bodega Central Zona 12' n, 'BODEGA_CENTRAL' t, 'Calzada Aguilar Batres', '2222-0002' tel, NULL dir FROM dual UNION ALL
  SELECT 'SUC-03', 'Tienda Roosevelt',           'TIENDA',         'Calzada Roosevelt 24-00', '2222-0003',      NULL      FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM NOM_SUCURSAL s WHERE s.CODIGO = v.c);

-- ---- Empleados (NOM_EMPLEADO) --------------------------------------
INSERT INTO NOM_EMPLEADO (CODIGO_EMPLEADO, NOMBRES, APELLIDOS, FECHA_INGRESO, ID_PUESTO, ID_SUCURSAL, TIPO_EMPLEADO, SALARIO_BASE, ESTADO)
SELECT v.cod, v.nom, v.ape, DATE '2024-01-15',
       (SELECT MIN(ID_PUESTO) FROM NOM_PUESTO WHERE ELIMINADO = 'N'),
       (SELECT MIN(ID_SUCURSAL) FROM NOM_SUCURSAL WHERE ELIMINADO = 'N'),
       v.tip, v.sal, 'A'
FROM (
  SELECT 'EMP-101' cod, 'Maria'   nom, 'Lopez'     ape, 'ADMINISTRATIVO' tip, 6500 sal FROM dual UNION ALL
  SELECT 'EMP-102',     'Jorge',       'Ramirez',       'OFICINA_CENTRAL',     9500      FROM dual UNION ALL
  SELECT 'EMP-103',     'Ana',         'Castillo',      'ADMINISTRATIVO',      7200      FROM dual UNION ALL
  SELECT 'EMP-104',     'Luis',        'Gonzalez',      'BODEGA',              5000      FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM NOM_EMPLEADO e WHERE e.CODIGO_EMPLEADO = v.cod);

-- ---- Proveedores (COM_PROVEEDOR) con calificacion --------------
INSERT INTO COM_PROVEEDOR (NIT, RAZON_SOCIAL, NOMBRE_COMERCIAL, DIRECCION, TELEFONO, EMAIL, DIAS_CREDITO, CALIFICACION, ESTADO)
SELECT v.nit, v.rs, v.nc, v.dir, v.tel, v.mail, v.dc, v.cal, 'A' FROM (
  SELECT '5551122-3' nit, 'Ferreteria La Fortaleza, S.A.'        rs, 'La Fortaleza'      nc, 'Zona 4, Ciudad'   dir, '2333-1000' tel, 'ventas@lafortaleza.gt' mail, 30 dc, 'A'  cal FROM dual UNION ALL
  SELECT '6669988-1',     'Suministros Electricos del Norte',        'SumElec',            'Zona 9, Ciudad',        '2333-2000',      'compras@sumelec.gt',        45,     'B'      FROM dual UNION ALL
  SELECT '7778844-5',     'Pinturas y Acabados Profesionales',       'PintuPro',           'Zona 11, Ciudad',       '2333-3000',      'info@pintupro.gt',          15,     'A+'     FROM dual UNION ALL
  SELECT '8882233-7',     'Distribuidora de Cemento Guatemala',      'DisCeGua',           'Km 15 CA-9',            '2333-4000',      'pedidos@discegua.gt',       0,      'C'      FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM COM_PROVEEDOR p WHERE p.NIT = v.nit);

-- ---- Grupos de compra adicionales (COM_GRUPO_COMPRA) -------
INSERT INTO COM_GRUPO_COMPRA (ID_CATEGORIA_COMPRA, NOMBRE, DESCRIPCION)
SELECT (SELECT MIN(ID_CATEGORIA_COMPRA) FROM COM_CATEGORIA_COMPRA WHERE ELIMINADO = 'N'), v.n, v.d
FROM (
  SELECT 'Material electrico'      n, 'Cables, canaletas, tableros'        d FROM dual UNION ALL
  SELECT 'Pinturas y solventes',       'Latex, aceite, thinner'               FROM dual UNION ALL
  SELECT 'Equipo de computo',          'Laptops, monitores, perifericos'      FROM dual UNION ALL
  SELECT 'Papeleria y limpieza',       'Consumibles de oficina'               FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM COM_GRUPO_COMPRA g WHERE g.NOMBRE = v.n);

-- ---- Centros de costo ligados a departamento (COM_CENTRO_COSTO) --
INSERT INTO COM_CENTRO_COSTO (CODIGO, NOMBRE, ID_DEPARTAMENTO, ESTADO)
SELECT v.c, v.n, (SELECT ID_DEPARTAMENTO FROM NOM_DEPARTAMENTO WHERE NOMBRE = v.dep), 'A'
FROM (
  SELECT 'CC-COMPRAS' c, 'Gastos de Compras'      n, 'Compras y Abastecimiento' dep FROM dual UNION ALL
  SELECT 'CC-LOG',        'Logistica y Bodega',        'Operaciones y Logistica'      FROM dual UNION ALL
  SELECT 'CC-TI',         'Tecnologia',                'Tecnologia'                   FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM COM_CENTRO_COSTO cc WHERE cc.CODIGO = v.c);

COMMIT;
