## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- INSTRUCCIONES DEL PROYECTO -->
Antes de generar o modificar cualquier archivo, consulta estrictamente los siguientes documentos de especificación:
1. `skills/stack-tecnologico.md`: Reglas del runtime, Docker, pnpm, React 19, Tailwind v4 y Oracle 21c.
2. `skills/patron-arquitectura.md`: Estructura estricta de 6 capas, POO y patrones GoF.
3. `skills/patron-diseno.md`: Guías visuales (Material 3/Fluent/Apple), tokens de color y componentes ERP.
4. `database/ddl/SCRIPT_DDL.sql`: Esquema canónico de 102 tablas para nombres de campos, llaves foráneas y tipos de datos.