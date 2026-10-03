-- ============================================================================
-- Alcance por departamento / equipo (Fase 6.2).
-- Liga a los empleados de los usuarios demo con un departamento y su jefe
-- inmediato, para que el filtrado de visibilidad de solicitudes sea demostrable:
--   jefe (EMP-102)   ve las solicitudes de sus reportes (EMP-101) + las suyas
--   gerente (EMP-103) ve las de todo el departamento "Compras y Abastecimiento"
--   solicitante (EMP-101) ve solo las suyas
--   bodega (EMP-104) queda en otro departamento -> sus solicitudes no las ven
--                    el jefe ni el gerente de Compras
-- Idempotente (UPDATE). Capa 1 - database/dml/  ·  `pnpm db:deploy`.
-- ============================================================================

UPDATE NOM_EMPLEADO
   SET ID_DEPARTAMENTO = (SELECT ID_DEPARTAMENTO FROM NOM_DEPARTAMENTO WHERE NOMBRE = 'Compras y Abastecimiento')
 WHERE CODIGO_EMPLEADO IN ('EMP-101', 'EMP-102', 'EMP-103');

UPDATE NOM_EMPLEADO
   SET ID_DEPARTAMENTO = (SELECT ID_DEPARTAMENTO FROM NOM_DEPARTAMENTO WHERE NOMBRE = 'Operaciones y Logistica')
 WHERE CODIGO_EMPLEADO = 'EMP-104';

UPDATE NOM_EMPLEADO
   SET ID_JEFE_INMEDIATO = (SELECT ID_EMPLEADO FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO = 'EMP-102')
 WHERE CODIGO_EMPLEADO = 'EMP-101';

UPDATE NOM_EMPLEADO
   SET ID_JEFE_INMEDIATO = (SELECT ID_EMPLEADO FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO = 'EMP-103')
 WHERE CODIGO_EMPLEADO = 'EMP-102';

UPDATE NOM_DEPARTAMENTO
   SET ID_GERENTE = (SELECT ID_EMPLEADO FROM NOM_EMPLEADO WHERE CODIGO_EMPLEADO = 'EMP-103')
 WHERE NOMBRE = 'Compras y Abastecimiento';

COMMIT;
