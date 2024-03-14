import { type DatabaseClient } from "#core/adapters.js";
import { buildSchemaExclusionClause } from "./utils.js";

interface FetchEnumsResult {
  id: string;
  name: string;
  schema: string;
  values: Array<string>;
}

const FETCH_ENUMS = `
  WITH
  accessible_schemas AS (
    SELECT
      schema_name
    FROM information_schema.schemata
    WHERE
      ${buildSchemaExclusionClause("schema_name")}
  )
  SELECT
    pg_namespace.nspname AS schema,
    pg_type.typname AS name,
    concat(pg_namespace.nspname, '.', pg_type.typname) AS id,
    json_agg(pg_enum.enumlabel ORDER BY pg_enum.enumlabel) AS values
  FROM pg_type
  INNER JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
  INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
  INNER JOIN accessible_schemas s ON s.schema_name = pg_namespace.nspname
  WHERE ${buildSchemaExclusionClause("pg_namespace.nspname")}
  GROUP BY pg_namespace.nspname, pg_type.typname
  ORDER BY concat(pg_namespace.nspname, '.', pg_type.typname)
`;

export async function fetchEnums(client: DatabaseClient) {
  const response = await client.query<FetchEnumsResult>(FETCH_ENUMS);

  return response;
}
