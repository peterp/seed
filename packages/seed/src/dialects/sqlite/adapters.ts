/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql } from "drizzle-orm";
import { type BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { DrizzleDbClient } from "#core/adapters.js";

export class DrizzleORMBetterSQLiteClient extends DrizzleDbClient<
  BaseSQLiteDatabase<"async" | "sync", unknown, any>
> {
  async query<K>(
    query: string,
    _values?: Array<any> | undefined,
  ): Promise<Array<K>> {
    const res = await this.db.all(sql.raw(query));
    return res as Array<K>;
  }
  async run(query: string): Promise<void> {
    await this.db.run(sql.raw(query));
  }
}

export class DrizzleORMSqliteBunClient extends DrizzleDbClient<
  BaseSQLiteDatabase<"async" | "sync", unknown, any>
> {
  async query<K>(
    query: string,
    _values?: Array<any> | undefined,
  ): Promise<Array<K>> {
    const res = await this.db.all(sql.raw(query));
    return res as Array<K>;
  }
  async run(query: string): Promise<void> {
    await this.db.run(sql.raw(query));
  }
}

type PgAdapterName = "BetterSQLiteSession" | "SQLiteBunSession";

export function createDrizzleORMSqliteClient(
  db: BaseSQLiteDatabase<"async" | "sync", unknown, any>,
): DrizzleORMBetterSQLiteClient {
  // @ts-expect-error - we need to use the drizzle internal adapter session name to determine the adapter
  const sessionName = db.session.constructor.name as PgAdapterName;
  switch (sessionName) {
    case "BetterSQLiteSession":
      return new DrizzleORMBetterSQLiteClient(db);
    case "SQLiteBunSession":
      return new DrizzleORMSqliteBunClient(db);
    default:
      return new DrizzleORMBetterSQLiteClient(db);
  }
}
