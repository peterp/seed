import { EOL } from "node:os";
import { getDatabaseClient } from "#adapters/getDatabaseClient.js";
import { type SelectConfig } from "#config/seedConfig/selectConfig.js";
import {
  type GetSeedClient,
  SeedClientBase,
  setupClient,
} from "#core/client/client.js";
import { type SeedClientOptions } from "#core/client/types.js";
import { filterModelsBySelectConfig } from "#core/client/utils.js";
import { type DataModel } from "#core/dataModel/types.js";
import { type DatabaseClient } from "#core/databaseClient.js";
import { patchUserModelsSequences } from "#core/sequences/sequences.js";
import { fetchSequences } from "./introspect/queries/fetchSequences.js";
import { PgStore } from "./store.js";
import { escapeIdentifier } from "./utils.js";

export const getSeedClient: GetSeedClient = (props) => {
  class PgSeedClient extends SeedClientBase {
    readonly db: DatabaseClient;
    readonly dryRun: boolean;
    readonly options?: SeedClientOptions;

    constructor(databaseClient: DatabaseClient, options?: SeedClientOptions) {
      super({
        ...props,
        adapterPatchUserModels:
          databaseClient.adapterPatchUserModels.bind(databaseClient),
        createStore: (dataModel: DataModel) => new PgStore(dataModel),
        runStatements: async (statements: Array<string>) => {
          if (!this.dryRun) {
            for (const statement of statements) {
              await this.db.execute(statement);
            }
          } else {
            console.log(statements.join(`;${EOL}`) + ";");
          }
        },
        options,
      });

      this.dryRun = options?.dryRun ?? false;

      this.db = databaseClient;
      this.options = options;
    }

    async $resetDatabase(selectConfig?: SelectConfig) {
      const models = Object.values(this.dataModel.models);
      const filteredModels = filterModelsBySelectConfig(models, selectConfig);
      if (!this.dryRun) {
        const tablesToTruncate = filteredModels
          .map(
            (model) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              `${escapeIdentifier(model.schemaName!)}.${escapeIdentifier(model.tableName)}`,
          )
          .join(", ");
        if (tablesToTruncate.length > 0) {
          await this.db.execute(`TRUNCATE ${tablesToTruncate} CASCADE`);
        }
        for (const model of filteredModels) {
          // reset sequences
          const sequences = model.fields.map((f) => f.sequence);
          for (const sequence of sequences) {
            if (sequence !== false) {
              await this.db.execute(
                `ALTER SEQUENCE ${sequence.identifier} RESTART WITH ${sequence.start ?? 1}`,
              );
            }
          }
        }
        await this.$syncDatabase();
        this.state = this.getInitialState();
      }
    }

    async $syncDatabase(): Promise<void> {
      const sequences = await fetchSequences(this.db);
      const sequencesCurrent = sequences.reduce<Record<string, number>>(
        (acc, sequence) => {
          acc[
            `${escapeIdentifier(
              sequence.schema,
            )}.${escapeIdentifier(sequence.name)}`
          ] = sequence.current;
          return acc;
        },
        {},
      );
      patchUserModelsSequences({
        dataModel: this.dataModel,
        initialUserModels: this.initialUserModels,
        sequencesCurrent,
        userModels: this.userModels,
      });
    }
  }

  const createSeedClient = async (options?: SeedClientOptions) => {
    return setupClient({
      dialect: "postgres",
      async createClient() {
        const databaseClient =
          options?.adapter ?? (await getDatabaseClient(props.seedConfigPath));
        return new PgSeedClient(databaseClient, options);
      },
    });
  };

  return createSeedClient;
};