import { type DatabaseClient } from "#core/databaseClient.js";
import { buildSchemaInclusionClause } from "./utils.js";

interface ColumnResult {
  default: null | string;
  id: string;
  maxLength: null | number;
  name: string;
  nullable: boolean;
  schema: string;
  table: string;
  type: string;
}

interface TableResult {
  id: string;
  name: string;
  rows: null | number; // Estimated row count if possible
  schema: string;
}

const FETCH_COLUMNS = (schemas: Array<string>) => `
  SELECT 
    CONCAT(TABLE_SCHEMA, '.', TABLE_NAME, '.', COLUMN_NAME) AS id,
    TABLE_SCHEMA AS schema,
    TABLE_NAME AS table,
    COLUMN_NAME AS name,
    DATA_TYPE AS type,
    IS_NULLABLE = 'YES' AS nullable,
    COLUMN_DEFAULT AS default,
    CHARACTER_MAXIMUM_LENGTH AS maxLength
  FROM information_schema.COLUMNS
  WHERE ${buildSchemaInclusionClause(schemas, "TABLE_SCHEMA")}
  ORDER BY ORDINAL_POSITION;
`;

const FETCH_TABLES = (schemas: Array<string>) => `
  SELECT 
    TABLE_SCHEMA AS schema,
    TABLE_NAME AS name,
    CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) AS id
  FROM information_schema.TABLES
  WHERE ${buildSchemaInclusionClause(schemas, "TABLE_SCHEMA")}
`;

export async function fetchTablesAndColumns(
  client: DatabaseClient,
  schemas: Array<string>,
) {
  const tablesPromise = client.query<TableResult>(FETCH_TABLES(schemas));
  const columnsPromise = client.query<ColumnResult>(FETCH_COLUMNS(schemas));
  const [tables, columns] = await Promise.all([tablesPromise, columnsPromise]);

  const tablesWithColumns = tables.map((table) => ({
    ...table,
    columns: columns.filter(
      (column) => column.table === table.name && column.schema === table.schema,
    ),
  }));

  return tablesWithColumns;
}
