const { neon } = require("@neondatabase/serverless");

const sql = neon(
  "postgresql://neondb_owner:npg_F7n5oMaNiLKU@ep-lucky-star-a19vjr2s.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
);

async function run() {
  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS password VARCHAR(255)`;
  console.log("✅ password column added");

  await sql`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255) UNIQUE`;
  console.log("✅ invite_token column added");

  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position`;
  console.log("📋 Columns:", cols.map((c) => c.column_name).join(", "));
}

run().catch((e) => console.error("❌ Error:", e));
