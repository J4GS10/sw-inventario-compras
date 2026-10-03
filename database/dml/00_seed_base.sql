-- ============================================================================
-- Seed de datos maestros MINIMOS de otros modulos, necesarios para operar el
-- modulo de Compras sin depender de la carga completa del sistema.
-- Idempotente (guardas NOT EXISTS / columnas UNIQUE). Capa 1 - database/dml/
-- Fase 6 del plan reemplaza el usuario de sistema por el login real (SEG_USUARIO).
-- ============================================================================

-- Usuario de sistema (ID_USUARIO = 1) ligado al primer empleado activo.
-- Se usa como contexto de auditoria (CREADO_POR / MODIFICADO_POR / ELIMINADO_POR).
INSERT INTO SEG_USUARIO (ID_USUARIO, ID_EMPLEADO, USERNAME, PASSWORD_HASH, ESTADO)
SELECT 1, e.ID_EMPLEADO, 'sistema', 'no-login', 'A'
FROM (SELECT MIN(ID_EMPLEADO) ID_EMPLEADO FROM NOM_EMPLEADO WHERE ELIMINADO = 'N') e
WHERE e.ID_EMPLEADO IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM SEG_USUARIO WHERE ID_USUARIO = 1)
  AND NOT EXISTS (
    SELECT 1 FROM SEG_USUARIO s
    WHERE s.ID_EMPLEADO = (SELECT MIN(ID_EMPLEADO) FROM NOM_EMPLEADO WHERE ELIMINADO = 'N')
  );

-- Bodega central por defecto (para recepciones).
INSERT INTO INV_BODEGA (ID_SUCURSAL, NOMBRE, TIPO, ESTADO)
SELECT s.ID_SUCURSAL, 'Bodega Central', 'CENTRAL', 'A'
FROM (SELECT MIN(ID_SUCURSAL) ID_SUCURSAL FROM NOM_SUCURSAL WHERE ELIMINADO = 'N') s
WHERE s.ID_SUCURSAL IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM INV_BODEGA WHERE ELIMINADO = 'N');

COMMIT;
