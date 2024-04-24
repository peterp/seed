import dedent from "dedent";
import { test as _test, type TestFunction, expect } from "vitest";
import { adapterEntries } from "#test/adapters.js";
import { setupProject } from "#test/setupProject.js";
import { type DialectRecordWithDefault } from "../../test/types.js";

for (const [dialect, adapter] of adapterEntries) {
  const computeName = (name: string) =>
    `e2e > constraints > ${dialect} > ${name}`;
  const test = (name: string, fn: TestFunction) => {
    // eslint-disable-next-line vitest/expect-expect, vitest/valid-title
    _test.concurrent(computeName(name), fn);
  };

  test("unique constraints for parent fields", async () => {
    const schema: DialectRecordWithDefault = {
      default: `
        create table organization (
          id serial not null primary key
        );
        create table "user" (
          id serial not null primary key
        );
        create table member (
          id serial not null primary key,
          organization_id int not null references organization(id),
          user_id int not null references "user"(id) unique,
          unique (organization_id, user_id)
        );
        `,
      sqlite: `
        -- Organization table
        CREATE TABLE organization (
          id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
        );
        -- User table
        CREATE TABLE "user" (
          id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
        );
        -- Member table with unique constraints
        CREATE TABLE member (
          id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          organization_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organization(id),
          FOREIGN KEY (user_id) REFERENCES "user"(id),
          UNIQUE (user_id),
          UNIQUE (organization_id, user_id)
        );
        `,
    };
    // The test is actually to ensure that this script can run withtout throwing an error.
    // if the constraints are handled correctly, the script should run without any error.
    const { db } = await setupProject({
      adapter,
      databaseSchema: schema[dialect] ?? schema.default,
      seedScript: `
        import { createSeedClient } from '#snaplet/seed'
          const seed = await createSeedClient({ dryRun: false })
          await seed.organizations((x) => x(2))
          await seed.users((x) => x(20))
          // Attempt to seed members, ensuring unique constraints are respected
          await seed.members((x) => x(20), { connect: true })
        `,
    });
    const members = await db.query('SELECT * FROM "member"');
    expect(members).toHaveLength(20);
  });
  test("error is thrown when unique constraints are violated", async () => {
    const schema: DialectRecordWithDefault = {
      default: `
          CREATE TABLE "user" (
            id SERIAL NOT NULL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE
          );
        `,
      sqlite: `
          CREATE TABLE "user" (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE
          );
        `,
    };
    const { runSeedScript } = await setupProject({
      adapter,
      databaseSchema: schema[dialect] ?? schema.default,
    });
    await expect(() =>
      runSeedScript(`
        import { createSeedClient } from '#snaplet/seed'
        import { copycat } from "@snaplet/copycat"
        const seed = await createSeedClient()
        await seed.users((x) => x(5, {
          email: (ctx) => copycat.oneOf(ctx.seed, ['a', 'b']) + '@acme.com'
        }))`),
    ).rejects.toThrow(dedent`
        Unique constraint "user_email_key" violated for model "users" on fields (email) with values (b@acme.com)
        Seed: 0/users/2
        Model data: {
          "id": 3,
          "email": "b@acme.com"
        }`);
  });
  test("nullable relationship", async () => {
    const schema: DialectRecordWithDefault = {
      default: `
        create table team (
          id serial primary key
        );
        create table player (
          id bigserial primary key,
          team_id integer references team(id),
          name text not null
        );
        `,
      sqlite: `
        -- Team table
        CREATE TABLE team (
          id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
        );
        -- Player table with a nullable reference to Team
        CREATE TABLE player (
          id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          team_id INTEGER,
          name TEXT NOT NULL,
          FOREIGN KEY (team_id) REFERENCES team(id)
        );
        `,
    };

    // Ensure the adapter and dialect are correctly initialized or passed
    const { db } = await setupProject({
      adapter,
      databaseSchema: schema[dialect] ?? schema.default,
      seedScript: `
        import { createSeedClient } from '#snaplet/seed'
          const seed = await createSeedClient({ dryRun: false })
          // Explicitly setting team_id to null
          await seed.players((x) => x(2, {
            teamId: null // Ensure this matches your seed client's API
          }));
          // Omitting team_id
          await seed.players((x) => x(2));
        `,
    });

    // Check if the players table has been populated correctly
    const players = await db.query("SELECT * FROM player");
    expect(players).toHaveLength(4);

    // Check if the teams table remains empty
    const teams = await db.query("SELECT * FROM team");
    expect(teams).toHaveLength(0);
  });
}