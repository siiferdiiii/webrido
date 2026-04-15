const { neon } = require("@neondatabase/serverless");

const sql = neon(
  "postgresql://neondb_owner:npg_F7n5oMaNiLKU@ep-lucky-star-a19vjr2s.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
);

async function run() {
  const affiliates = await sql`SELECT id, name, email, status, password, invite_token FROM affiliates ORDER BY created_at DESC LIMIT 10`;
  
  if (affiliates.length === 0) {
    console.log("❌ Belum ada affiliate di database");
    return;
  }

  console.log("📋 Daftar Affiliate:\n");
  affiliates.forEach((a, i) => {
    const hasPassword = a.password ? "✅ Sudah set password" : "❌ Belum set password";
    const hasToken = a.invite_token ? `🔗 Token: ${a.invite_token.slice(0, 8)}...` : "— Belum ada invite token";
    console.log(`${i + 1}. ${a.name} (${a.email || "no email"}) — ${a.status}`);
    console.log(`   ${hasPassword} | ${hasToken}`);
    console.log(`   ID: ${a.id}\n`);
  });
}

run().catch((e) => console.error("❌ Error:", e));
