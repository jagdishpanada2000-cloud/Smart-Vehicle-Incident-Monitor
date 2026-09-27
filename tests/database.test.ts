import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let pg: PGlite;
const operator = "11111111-1111-4111-8111-111111111111",
  outsider = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to authenticated;`,
  );
  // PGlite includes gen_random_uuid but not the optional pgcrypto extension.
  const sql = readFileSync(
    "supabase/migrations/202609210001_sentinel.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await pg.exec(sql);
  await pg.exec(
    `insert into auth.users values('${operator}','operator@example.test'),('${outsider}','outsider@example.test');insert into public.operators(user_id) values('${operator}');`,
  );
  await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await pg?.close();
});
async function asUser<T>(id: string, query: string) {
  await pg.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await pg.query<T>(query);
  } finally {
    await pg.exec("reset role;");
  }
}
describe("actual SQL migration and row-level security in local PostgreSQL", () => {
  it("loads ten vehicles and twenty-four explicitly labeled sample incidents", async () => {
    expect(
      (
        await pg.query<{ n: number }>(
          "select count(*)::integer n from registered_vehicles",
        )
      ).rows[0].n,
    ).toBe(10);
    expect(
      (
        await pg.query<{ n: number }>(
          "select count(*)::integer n from incident_log where is_sample",
        )
      ).rows[0].n,
    ).toBe(24);
  });
  it("seed can be rerun without duplicates", async () => {
    await pg.exec(readFileSync("supabase/seed.sql", "utf8"));
    expect(
      (
        await pg.query<{ n: number }>(
          "select count(*)::integer n from incident_log",
        )
      ).rows[0].n,
    ).toBe(24);
  });
  it("allows an operator to read the registry", async () => {
    expect(
      (
        await asUser<{ n: number }>(
          operator,
          "select count(*)::integer n from registered_vehicles",
        )
      ).rows[0].n,
    ).toBe(10);
  });
  it("hides registry and incidents from unapproved authenticated users", async () => {
    expect(
      (
        await asUser<{ n: number }>(
          outsider,
          "select count(*)::integer n from registered_vehicles",
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await asUser<{ n: number }>(
          outsider,
          "select count(*)::integer n from incident_log",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("denies self-enrollment as an operator", async () => {
    await expect(
      asUser(outsider, `insert into operators(user_id) values('${outsider}')`),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies direct client incident inserts even for operators", async () => {
    await expect(
      asUser(
        operator,
        `insert into incident_log(request_id) values(gen_random_uuid())`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("permits operator vehicle CRUD", async () => {
    await asUser(
      operator,
      `insert into registered_vehicles(plate_number,owner_name,vehicle_type) values('MH12ZZ9876','Test Owner','Car')`,
    );
    await asUser(
      operator,
      `update registered_vehicles set status='BLOCKED' where plate_number='MH12ZZ9876'`,
    );
    expect(
      (
        await asUser<{ status: string }>(
          operator,
          `select status from registered_vehicles where plate_number='MH12ZZ9876'`,
        )
      ).rows[0].status,
    ).toBe("BLOCKED");
    await asUser(
      operator,
      `delete from registered_vehicles where plate_number='MH12ZZ9876'`,
    );
  });
  it("denies unapproved registry changes", async () => {
    await expect(
      asUser(
        outsider,
        `insert into registered_vehicles(plate_number,owner_name,vehicle_type) values('MH12ZZ9876','Test Owner','Car')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects duplicate plates and invalid thresholds", async () => {
    await expect(
      asUser(
        operator,
        `insert into registered_vehicles(plate_number,owner_name,vehicle_type) values('MH12AB1234','Duplicate Owner','Car')`,
      ),
    ).rejects.toThrow(/unique constraint/);
    await expect(
      asUser(operator, "update system_settings set similarity_threshold=101"),
    ).rejects.toThrow(/check constraint/);
  });
  it("aggregates all database records and seven daily buckets", async () => {
    const stats = await asUser<{ stats: { scans: number; samples: number } }>(
      operator,
      "select sentinel_dashboard_stats() stats",
    );
    expect(stats.rows[0].stats.scans).toBe(24);
    expect(stats.rows[0].stats.samples).toBe(24);
    expect(
      (await asUser(operator, "select * from sentinel_daily_scans()")).rows,
    ).toHaveLength(7);
  });
  it("does not leak statistics to an unapproved user", async () => {
    const r = await asUser<{ s: { scans: number; vehicles: number } }>(
      outsider,
      "select sentinel_dashboard_stats() s",
    );
    expect(r.rows[0].s.scans).toBe(0);
    expect(r.rows[0].s.vehicles).toBe(0);
  });
  it("rate limits atomically and denies client invocation", async () => {
    await pg.exec("set role service_role");
    try {
      for (let i = 0; i < 3; i++)
        expect(
          (
            await pg.query<{ ok: boolean }>(
              `select sentinel_consume_request('${operator}','test',2) ok`,
            )
          ).rows[0].ok,
        ).toBe(i < 2);
    } finally {
      await pg.exec("reset role");
    }
    await expect(
      asUser(operator, `select sentinel_consume_request('${operator}','scan',1000)`),
    ).rejects.toThrow(/permission denied/);
  });
  it("does not permit anonymous registry access", async () => {
    await pg.exec("set role anon");
    try {
      await expect(
        pg.query("select * from registered_vehicles"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await pg.exec("reset role");
    }
  });
});
