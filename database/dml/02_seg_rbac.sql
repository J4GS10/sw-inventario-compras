-- ============================================================================
-- RBAC del modulo de Compras: permisos, roles, usuarios de demostracion y
-- sus asignaciones. Idempotente (UNIQUE / NOT EXISTS).
-- Capa 1 - database/dml/  ·  se aplica con `pnpm db:deploy`.
--
-- El catalogo de permisos y el mapa rol->permiso son el espejo de
-- backend/src/common/auth/permissions.ts (fuente de verdad en codigo).
-- ============================================================================

-- ---- Permisos (SEG_PERMISO) — 14 permisos del modulo COMPRAS ----------------
-- Principio de acceso: quien no gestiona/acciona un recurso, no lo ve. Se
-- probaron permisos "*_VER" de solo lectura por recurso (para que gerencias/
-- auditoria tuvieran trazabilidad sin poder editar) y se revirtieron a
-- pedido explicito del usuario — ver migracion de revocacion mas abajo.
-- SOLICITUD_VER es la unica excepcion: todo el mundo necesita ver el estado
-- de una solicitud para saber si le toca actuar.
INSERT INTO SEG_PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION)
SELECT v.c, v.n, 'COMPRAS', v.d FROM (
  SELECT 'COMPRAS_SOLICITUD_CREAR'            c, 'Crear solicitud de compra'      n, 'Ingresar solicitudes de compra'                              d FROM dual UNION ALL
  SELECT 'COMPRAS_SOLICITUD_VER',                 'Ver solicitudes',                   'Consultar solicitudes de compra'                                 FROM dual UNION ALL
  SELECT 'COMPRAS_SOLICITUD_APROBAR_JEFE',        'Aprobar (jefe inmediato)',          'Aprobar, rechazar o ajustar cantidades en PENDIENTE_JEFE'         FROM dual UNION ALL
  SELECT 'COMPRAS_SOLICITUD_APROBAR_GERENTE',     'Aprobar (gerente de área)',         'Aprobar o rechazar en PENDIENTE_GERENTE'                          FROM dual UNION ALL
  SELECT 'COMPRAS_RFQ_GESTIONAR',                 'Gestionar RFQ',                     'Crear, ver y cerrar RFQ, invitar proveedores'                    FROM dual UNION ALL
  SELECT 'COMPRAS_COTIZACION_GESTIONAR',          'Gestionar cotizaciones',            'Registrar y ver cotizaciones de proveedor'                       FROM dual UNION ALL
  SELECT 'COMPRAS_COTIZACION_ADJUDICAR',          'Adjudicar cotización',              'Ver, adjudicar y registrar criterios'                            FROM dual UNION ALL
  SELECT 'COMPRAS_OC_GESTIONAR',                  'Gestionar órdenes de compra',       'Generar OC, verla y cambiar su estado'                           FROM dual UNION ALL
  SELECT 'COMPRAS_RECEPCION_GESTIONAR',           'Gestionar recepciones',             'Registrar y ver recepciones de mercadería'                       FROM dual UNION ALL
  SELECT 'COMPRAS_DEVOLUCION_GESTIONAR',          'Gestionar devoluciones',            'Registrar y ver devoluciones a proveedor'                        FROM dual UNION ALL
  SELECT 'COMPRAS_CATALOGO_VER',                  'Ver catálogos',                     'Consultar catálogos del módulo'                                 FROM dual UNION ALL
  SELECT 'COMPRAS_CATALOGO_EDITAR',               'Editar catálogos operativos',       'Proveedores, acuerdos, condiciones, grupos, centros de costo'    FROM dual UNION ALL
  SELECT 'COMPRAS_CATALOGO_ADMIN',                'Administrar monedas',               'Editar el catálogo de monedas'                                  FROM dual UNION ALL
  SELECT 'COMPRAS_ANALISIS_VER',                  'Ver análisis',                      'Dashboard, comparativo, historial de precios y reportes'        FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM SEG_PERMISO p WHERE p.CODIGO = v.c);

-- ---- Roles (SEG_ROL) — 8 roles del flujo de compras ------------------------
INSERT INTO SEG_ROL (CODIGO, NOMBRE, DESCRIPCION, ESTADO)
SELECT v.c, v.n, v.d, 'A' FROM (
  SELECT 'SOLICITANTE'        c, 'Solicitante'                  n, 'Empleado que ingresa solicitudes de compra'                         d FROM dual UNION ALL
  SELECT 'JEFE_INMEDIATO',        'Jefe inmediato',                 'Primer nivel de aprobación; puede ajustar cantidades'                  FROM dual UNION ALL
  SELECT 'GERENTE_AREA',          'Gerente de área',                'Segundo nivel de aprobación'                                          FROM dual UNION ALL
  SELECT 'COMPRADOR',             'Comprador (Depto. Compras)',     'Gestiona RFQ, cotizaciones y órdenes de compra'                       FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO',    'Gerente financiero',             'Selecciona la mejor cotización (adjudicación)'                        FROM dual UNION ALL
  SELECT 'BODEGA',                'Bodega',                         'Registra recepciones y devoluciones a proveedor'                      FROM dual UNION ALL
  SELECT 'AUDITOR',               'Auditor',                        'Consulta de solo lectura del ciclo de compras'                        FROM dual UNION ALL
  SELECT 'ADMIN_COMPRAS',         'Administrador de Compras',       'Acceso total al módulo de compras'                                   FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM SEG_ROL r WHERE r.CODIGO = v.c);

-- ---- Empleados adicionales para los usuarios de demostracion --------------
INSERT INTO NOM_EMPLEADO (CODIGO_EMPLEADO, NOMBRES, APELLIDOS, FECHA_INGRESO, ID_PUESTO, ID_SUCURSAL, TIPO_EMPLEADO, SALARIO_BASE, ESTADO)
SELECT v.cod, v.nom, v.ape, DATE '2024-02-01',
       (SELECT MIN(ID_PUESTO) FROM NOM_PUESTO WHERE ELIMINADO = 'N'),
       (SELECT MIN(ID_SUCURSAL) FROM NOM_SUCURSAL WHERE ELIMINADO = 'N'),
       v.tip, v.sal, 'A'
FROM (
  SELECT 'EMP-105' cod, 'Sofía'    nom, 'Herrera'  ape, 'OFICINA_CENTRAL' tip, 8000 sal FROM dual UNION ALL
  SELECT 'EMP-106',     'Ricardo',      'Morales',      'OFICINA_CENTRAL',     14000     FROM dual UNION ALL
  SELECT 'EMP-107',     'Patricia',     'Núñez',        'ADMINISTRATIVO',      7800      FROM dual UNION ALL
  SELECT 'EMP-108',     'Diego',        'Vargas',       'OFICINA_CENTRAL',     15000     FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM NOM_EMPLEADO e WHERE e.CODIGO_EMPLEADO = v.cod);

-- ---- Usuarios de demostracion (SEG_USUARIO) ------------------------------
-- El login valida contrasena con hash scrypt (backend/src/common/auth/password.ts)
-- + bloqueo por intentos fallidos + bitacora SEG_BITACORA_ACCESO.
-- Contrasena de TODOS los usuarios de demostracion:  compras.demo
-- (cada fila lleva su propio salt; regenerable con scripts + hashPassword()).
INSERT INTO SEG_USUARIO (ID_EMPLEADO, USERNAME, PASSWORD_HASH, ESTADO)
SELECT (SELECT ID_EMPLEADO FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO = v.emp),
       v.usr, v.h, 'A'
FROM (
  SELECT 'EMP-101' emp, 'solicitante' usr, 'scrypt$16384$8$1$w9L40g9Bstim/ouvkPuTGg==$jd4mBrhFiRQ9E3YsLx97ijYiQPSMfRxWndGKxaO+wic=' h FROM dual UNION ALL
  SELECT 'EMP-102',     'jefe',             'scrypt$16384$8$1$cpbV+VjcLGgsoO7ZB1AxTA==$PrlbBMsTchp7iMEsXlcToCAfyc1HrI612BKhj06muNo='   FROM dual UNION ALL
  SELECT 'EMP-103',     'gerente',          'scrypt$16384$8$1$afjtZm4NTNbAIso32gxlAQ==$aW9ZCkCmHPL057XoN75o1nhvi/E6JnAptSlJ+iRbD7s='   FROM dual UNION ALL
  SELECT 'EMP-104',     'bodega',           'scrypt$16384$8$1$sPjukH9qsTqxNZYbkramLw==$EG9cW8CzcPg3qqMgs47SRiv6eWfIbY6+NBAUEnrRtDA='   FROM dual UNION ALL
  SELECT 'EMP-105',     'comprador',        'scrypt$16384$8$1$PfC1QNVDxrPQUctKD0Q3nw==$aG28X9Va1XYKWTWq7C6BcXdxrO8lI9MyrLhIajyd8Bo='   FROM dual UNION ALL
  SELECT 'EMP-106',     'financiero',       'scrypt$16384$8$1$dNwHgn/TQJQS5B6vOcJVjw==$IlGLjcPhpBWVBaqVOR7mWgGwUR99zoqzZDbgebFEZEQ='   FROM dual UNION ALL
  SELECT 'EMP-107',     'auditor',          'scrypt$16384$8$1$FVWd9o9Eg7hwJ2ydsbKpAw==$KrV0TRJMH4v/GEixlhALhX+hdquhxPH+JUKtMFuCZWM='   FROM dual UNION ALL
  SELECT 'EMP-108',     'admin',            'scrypt$16384$8$1$7HQn9nBnzFPeBlrUcu2HIQ==$DEEXq7krQv/R8rrjhTojDCHYDe0YY9Gr4+j9/3+63wA='   FROM dual
) v
WHERE NOT EXISTS (SELECT 1 FROM SEG_USUARIO u WHERE u.USERNAME = v.usr);

-- Idempotente: si los usuarios ya estaban sembrados con el marcador de dev
-- anterior ('$dev$...'), se les asigna el hash real (contrasena: compras.demo).
UPDATE SEG_USUARIO SET PASSWORD_HASH = CASE USERNAME
    WHEN 'solicitante' THEN 'scrypt$16384$8$1$w9L40g9Bstim/ouvkPuTGg==$jd4mBrhFiRQ9E3YsLx97ijYiQPSMfRxWndGKxaO+wic='
    WHEN 'jefe'        THEN 'scrypt$16384$8$1$cpbV+VjcLGgsoO7ZB1AxTA==$PrlbBMsTchp7iMEsXlcToCAfyc1HrI612BKhj06muNo='
    WHEN 'gerente'     THEN 'scrypt$16384$8$1$afjtZm4NTNbAIso32gxlAQ==$aW9ZCkCmHPL057XoN75o1nhvi/E6JnAptSlJ+iRbD7s='
    WHEN 'bodega'      THEN 'scrypt$16384$8$1$sPjukH9qsTqxNZYbkramLw==$EG9cW8CzcPg3qqMgs47SRiv6eWfIbY6+NBAUEnrRtDA='
    WHEN 'comprador'   THEN 'scrypt$16384$8$1$PfC1QNVDxrPQUctKD0Q3nw==$aG28X9Va1XYKWTWq7C6BcXdxrO8lI9MyrLhIajyd8Bo='
    WHEN 'financiero'  THEN 'scrypt$16384$8$1$dNwHgn/TQJQS5B6vOcJVjw==$IlGLjcPhpBWVBaqVOR7mWgGwUR99zoqzZDbgebFEZEQ='
    WHEN 'auditor'     THEN 'scrypt$16384$8$1$FVWd9o9Eg7hwJ2ydsbKpAw==$KrV0TRJMH4v/GEixlhALhX+hdquhxPH+JUKtMFuCZWM='
    WHEN 'admin'       THEN 'scrypt$16384$8$1$7HQn9nBnzFPeBlrUcu2HIQ==$DEEXq7krQv/R8rrjhTojDCHYDe0YY9Gr4+j9/3+63wA='
    ELSE PASSWORD_HASH END
WHERE USERNAME IN ('solicitante','jefe','gerente','bodega','comprador','financiero','auditor','admin')
  AND (PASSWORD_HASH IS NULL OR PASSWORD_HASH NOT LIKE 'scrypt$%');

-- ---- Mapa rol -> permiso (SEG_ROL_PERMISO) ----------------------------
-- 7 roles con permisos explicitos; ADMIN_COMPRAS se llena por CROSS JOIN abajo.
INSERT INTO SEG_ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM (
  SELECT 'SOLICITANTE' rol, 'COMPRAS_SOLICITUD_CREAR'        perm FROM dual UNION ALL
  SELECT 'SOLICITANTE',     'COMPRAS_SOLICITUD_VER'               FROM dual UNION ALL
  SELECT 'SOLICITANTE',     'COMPRAS_CATALOGO_VER'                FROM dual UNION ALL
  SELECT 'SOLICITANTE',     'COMPRAS_ANALISIS_VER'                FROM dual UNION ALL
  SELECT 'JEFE_INMEDIATO',  'COMPRAS_SOLICITUD_CREAR'             FROM dual UNION ALL
  SELECT 'JEFE_INMEDIATO',  'COMPRAS_SOLICITUD_VER'               FROM dual UNION ALL
  SELECT 'JEFE_INMEDIATO',  'COMPRAS_SOLICITUD_APROBAR_JEFE'      FROM dual UNION ALL
  SELECT 'JEFE_INMEDIATO',  'COMPRAS_CATALOGO_VER'                FROM dual UNION ALL
  SELECT 'JEFE_INMEDIATO',  'COMPRAS_ANALISIS_VER'                FROM dual UNION ALL
  -- Gerente de area: solo lo que aprueba. No gestiona RFQ/Cotizacion/OC/
  -- Recepcion/Devolucion -> no las ve.
  SELECT 'GERENTE_AREA',    'COMPRAS_SOLICITUD_VER'               FROM dual UNION ALL
  SELECT 'GERENTE_AREA',    'COMPRAS_SOLICITUD_APROBAR_GERENTE'   FROM dual UNION ALL
  SELECT 'GERENTE_AREA',    'COMPRAS_CATALOGO_VER'                FROM dual UNION ALL
  SELECT 'GERENTE_AREA',    'COMPRAS_ANALISIS_VER'                FROM dual UNION ALL
  SELECT 'COMPRADOR',       'COMPRAS_SOLICITUD_VER'               FROM dual UNION ALL
  SELECT 'COMPRADOR',       'COMPRAS_RFQ_GESTIONAR'               FROM dual UNION ALL
  SELECT 'COMPRADOR',       'COMPRAS_COTIZACION_GESTIONAR'        FROM dual UNION ALL
  SELECT 'COMPRADOR',       'COMPRAS_OC_GESTIONAR'                FROM dual UNION ALL
  SELECT 'COMPRADOR',       'COMPRAS_CATALOGO_VER'                FROM dual UNION ALL
  -- Compras mantiene los catalogos operativos del modulo. Monedas es de
  -- Finanzas (ver GERENTE_FINANCIERO) — ya no CATALOGO_ADMIN aqui.
  SELECT 'COMPRADOR',       'COMPRAS_CATALOGO_EDITAR'             FROM dual UNION ALL
  SELECT 'COMPRADOR',       'COMPRAS_ANALISIS_VER'                FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_SOLICITUD_VER'            FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_COTIZACION_ADJUDICAR'     FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_OC_GESTIONAR'             FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_CATALOGO_VER'             FROM dual UNION ALL
  -- Finanzas mantiene catalogos operativos (condiciones de pago, terminos,
  -- centros de costo) Y el catalogo sensible de monedas (moneda es funcion
  -- de Finanzas, no de Compras).
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_CATALOGO_EDITAR'          FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_CATALOGO_ADMIN'           FROM dual UNION ALL
  SELECT 'GERENTE_FINANCIERO', 'COMPRAS_ANALISIS_VER'             FROM dual UNION ALL
  SELECT 'BODEGA',          'COMPRAS_RECEPCION_GESTIONAR'         FROM dual UNION ALL
  SELECT 'BODEGA',          'COMPRAS_DEVOLUCION_GESTIONAR'        FROM dual UNION ALL
  SELECT 'BODEGA',          'COMPRAS_CATALOGO_VER'                FROM dual UNION ALL
  -- Auditoria: mismo alcance que cualquier otro rol de solo consulta — no
  -- gestiona RFQ/Cotizacion/OC/Recepcion/Devolucion -> no las ve.
  SELECT 'AUDITOR',         'COMPRAS_SOLICITUD_VER'               FROM dual UNION ALL
  SELECT 'AUDITOR',         'COMPRAS_CATALOGO_VER'                FROM dual UNION ALL
  SELECT 'AUDITOR',         'COMPRAS_ANALISIS_VER'                FROM dual
) v
JOIN SEG_ROL r     ON r.CODIGO = v.rol  AND r.ELIMINADO = 'N'
JOIN SEG_PERMISO p ON p.CODIGO = v.perm AND p.ELIMINADO = 'N'
WHERE NOT EXISTS (
  SELECT 1 FROM SEG_ROL_PERMISO rp WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
);

-- ADMIN_COMPRAS: todos los permisos del modulo.
INSERT INTO SEG_ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT r.ID_ROL, p.ID_PERMISO
FROM SEG_ROL r
CROSS JOIN SEG_PERMISO p
WHERE r.CODIGO = 'ADMIN_COMPRAS' AND r.ELIMINADO = 'N'
  AND p.MODULO = 'COMPRAS' AND p.ELIMINADO = 'N'
  AND NOT EXISTS (
    SELECT 1 FROM SEG_ROL_PERMISO rp WHERE rp.ID_ROL = r.ID_ROL AND rp.ID_PERMISO = p.ID_PERMISO
  );

-- ---- Asignacion usuario -> rol (SEG_USUARIO_ROL) ---------------------
INSERT INTO SEG_USUARIO_ROL (ID_USUARIO, ID_ROL, FECHA_ASIGNACION)
SELECT u.ID_USUARIO, r.ID_ROL, SYSDATE
FROM (
  SELECT 'solicitante' usr, 'SOLICITANTE'       rol FROM dual UNION ALL
  SELECT 'jefe',            'JEFE_INMEDIATO'         FROM dual UNION ALL
  SELECT 'gerente',         'GERENTE_AREA'           FROM dual UNION ALL
  SELECT 'comprador',       'COMPRADOR'              FROM dual UNION ALL
  SELECT 'financiero',      'GERENTE_FINANCIERO'     FROM dual UNION ALL
  SELECT 'bodega',          'BODEGA'                 FROM dual UNION ALL
  SELECT 'auditor',         'AUDITOR'                FROM dual UNION ALL
  SELECT 'admin',           'ADMIN_COMPRAS'          FROM dual
) v
JOIN SEG_USUARIO u ON LOWER(u.USERNAME) = v.usr AND u.ELIMINADO = 'N'
JOIN SEG_ROL r     ON r.CODIGO = v.rol           AND r.ELIMINADO = 'N'
WHERE NOT EXISTS (
  SELECT 1 FROM SEG_USUARIO_ROL ur WHERE ur.ID_USUARIO = u.ID_USUARIO AND ur.ID_ROL = r.ID_ROL
);

COMMIT;
