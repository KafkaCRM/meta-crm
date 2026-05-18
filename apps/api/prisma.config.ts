import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/meta-crm",
  },
});
