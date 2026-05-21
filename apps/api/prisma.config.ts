import { defineConfig } from "prisma/config";
import * as fs from "fs";
import * as path from "path";

const loadEnv = (envPath: string) => {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    }
  }
};

loadEnv(path.resolve(__dirname, "../../.env"));
loadEnv(path.resolve(__dirname, ".env"));

export default defineConfig({
  schema: "prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/meta-crm",
  },
});
