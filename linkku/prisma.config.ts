// Prisma 7 config — connection URLs live here, NOT in schema.prisma
import "dotenv/config";
import { defineConfig } from "prisma/config";

// Note: The password contains '@' which must be URL-encoded as '%40'
// in the DATABASE_URL env var. If prisma still can't connect, the
// explicit override below handles it.
const rawUrl = process.env["DATABASE_URL"] || "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: rawUrl,
  },
});
