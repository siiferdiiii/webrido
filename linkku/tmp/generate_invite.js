const { neon } = require("@neondatabase/serverless");
const crypto = require("crypto");

const sql = neon(
  "postgresql://neondb_owner:npg_F7n5oMaNiLKU@ep-lucky-star-a19vjr2s.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
);

async function run() {
  const affiliateId = "b5e8491a-be9e-4f29-9dd6-d87c8cf62b45"; // rido
  const token = crypto.randomBytes(32).toString("hex");

  await sql`UPDATE affiliates SET invite_token = ${token} WHERE id = ${affiliateId}`;

  console.log("✅ Invite token generated for: rido (ridoazimi@gmail.com)");
  console.log("");
  console.log("🔗 Invite Link (localhost):");
  console.log(`   http://localhost:3000/affiliate/setup?token=${token}`);
  console.log("");
  console.log("🔗 Invite Link (production - ganti domain sesuai Vercel):");
  console.log(`   https://YOUR-DOMAIN.vercel.app/affiliate/setup?token=${token}`);
  console.log("");
  console.log("📋 Token:", token);
}

run().catch((e) => console.error("❌ Error:", e));
