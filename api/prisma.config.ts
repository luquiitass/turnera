import { defineConfig } from "prisma/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrate: {
    async adapter(env) {
      const connectionString = env.DATABASE_URL as string;
      const ssl = connectionString.includes(".railway.internal")
        ? false
        : { rejectUnauthorized: false };
      const pool = new pg.Pool({ connectionString, ssl });
      return new PrismaPg(pool);
    },
  },
});
