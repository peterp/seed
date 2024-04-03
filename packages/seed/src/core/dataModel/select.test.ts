import { readFileSync } from "fs-extra";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { type SelectConfig } from "#config/seedConfig/selectConfig.js";
import { computeIncludedTables, getSelectFilteredDataModel } from "./select.js";
import { type DataModel } from "./types.js";

describe.only("computeIncludedTables", () => {
  test("basic test 1", () => {
    const tableIds = [
      "public.table1",
      "public.table2",
      "public.table3",
      "public._table4",
      "public._table5",
    ];
    const selectConfig = ["!public*", "public.table1", "!public._*"];
    const result = computeIncludedTables(tableIds, selectConfig);
    expect(result).toEqual(["public.table1"]);
  });
  test("basic test 2", () => {
    const tableIds = [
      "public.table1",
      "public.table2",
      "public.table3",
      "public._table4",
      "public._table5",
    ];
    const selectConfig = ["public.table1", "!public._*"];
    const result = computeIncludedTables(tableIds, selectConfig);
    expect(result).toEqual(["public.table1", "public.table2", "public.table3"]);
  });
  test("basic test 3", () => {
    const tableIds = [
      "public.table1",
      "public.table2",
      "public.table3",
      "public._table4",
      "public._table5",
    ];
    const selectConfig = ["!public.table1", "!public._*"];
    const result = computeIncludedTables(tableIds, selectConfig);
    expect(result).toEqual(["public.table2", "public.table3"]);
  });
  test("match with the most specific matcher", () => {
    const tableIds = [
      "public.table1",
      "public.table2",
      "public.table3",
      "public._table4",
      "public._prisma_migrations",
    ];
    const selectConfig = ["!public.table1", "!public._*", "public._prisma*"];
    const result = computeIncludedTables(tableIds, selectConfig);
    expect(result).toEqual([
      "public.table2",
      "public.table3",
      "public._prisma_migrations",
    ]);
  });
  test("emptySelect config", () => {
    const tableIds = [
      "public.table1",
      "public.table2",
      "public.table3",
      "public._table4",
      "public._prisma_migrations",
    ];
    const selectConfig: Array<string> = [];
    const result = computeIncludedTables(tableIds, selectConfig);
    expect(result).toEqual([
      "public.table1",
      "public.table2",
      "public.table3",
      "public._table4",
      "public._prisma_migrations",
    ]);
  });
});

describe("getSelectFilteredDataModel", () => {
  const sqliteDataModel = JSON.parse(
    readFileSync(
      path.resolve(
        path.join(__dirname, "__fixtures__/basicSqliteDataModel.json"),
      ),
      "utf-8",
    ),
  ) as DataModel;
  test("should remove children relationship when the target table is excluded", () => {
    const selectConfig: SelectConfig = ["!test_order"];
    expect(getSelectFilteredDataModel(sqliteDataModel, selectConfig)).toEqual(
      expect.objectContaining({
        models: {
          test_customer: {
            id: "test_customer",
            tableName: "test_customer",
            fields: [
              {
                id: "test_customer.id",
                name: "id",
                columnName: "id",
                type: "integer",
                isRequired: true,
                kind: "scalar",
                isList: false,
                isGenerated: false,
                sequence: {
                  identifier: "test_customer_id_seq",
                  increment: 1,
                  current: 1,
                },
                hasDefaultValue: false,
                isId: true,
              },
              {
                id: "test_customer.name",
                name: "name",
                columnName: "name",
                type: "text",
                isRequired: true,
                kind: "scalar",
                isList: false,
                isGenerated: false,
                sequence: false,
                hasDefaultValue: false,
                isId: false,
              },
              {
                id: "test_customer.email",
                name: "email",
                columnName: "email",
                type: "text",
                isRequired: true,
                kind: "scalar",
                isList: false,
                isGenerated: false,
                sequence: false,
                hasDefaultValue: false,
                isId: false,
              },
            ],
            uniqueConstraints: [
              { name: "test_customer_email_key", fields: ["email"] },
              { name: "test_customer_pkey", fields: ["id"] },
            ],
          },
        },
        enums: {},
      }),
    );
  });
  test("should throw error if we exclude a table with parent relations to other tables", () => {
    const selectConfig: SelectConfig = ["!test_customer"];
    expect(() =>
      getSelectFilteredDataModel(sqliteDataModel, selectConfig),
    ).toThrowErrorMatchingInlineSnapshot("[SnapletError]");
  });
  test("should untouch with empty select", () => {
    const selectConfig: SelectConfig = [];
    expect(getSelectFilteredDataModel(sqliteDataModel, selectConfig)).toEqual(
      expect.objectContaining(sqliteDataModel),
    );
  });
});
