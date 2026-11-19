import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must contain at least 32 characters"),
  APP_ORIGIN: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().min(1),
}).superRefine((values, context) => {
  const placeholders: Array<{
    key: "DATABASE_URL" | "COOKIE_SECRET" | "SMTP_HOST" | "SMTP_USER" | "SMTP_PASS" | "MAIL_FROM";
    value: string;
  }> = [
    { key: "DATABASE_URL", value: "change-me" },
    { key: "COOKIE_SECRET", value: "replace-this" },
    { key: "SMTP_HOST", value: "example.com" },
    { key: "SMTP_USER", value: "your-smtp-username" },
    { key: "SMTP_PASS", value: "your-smtp-password" },
    { key: "MAIL_FROM", value: "example.com" },
  ];

  for (const { key, value: placeholder } of placeholders) {
    if (values[key].toLowerCase().includes(placeholder)) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: "Replace the placeholder with your actual configuration",
      });
    }
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(
    `Invalid environment configuration: ${details}. ` +
      "Copy .env.example to .env and replace its placeholder values.",
  );
}

export const env = result.data;