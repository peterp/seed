import { type DatabaseClient } from "#core/adapters.js";
import { type Constraints } from "../plan/types.js";
import { type Store } from "../store/store.js";
import { type UserModels } from "../userModels/types.js";

export interface SeedClientOptions {
  databaseClient?: DatabaseClient;
  dryRun?: boolean;
  models?: UserModels;
}

export interface ClientState {
  constraints: Constraints;
  seeds: Record<string, number>;
  sequences: Record<string, Generator<number, never>>;
  store: Store;
}
