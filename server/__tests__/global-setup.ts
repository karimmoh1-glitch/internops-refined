import "dotenv/config";

// Integration tests run against a dedicated local database so they can
// never touch development or production data. TEST_DATABASE_URL wins; the
// fallback rewrites the dev DATABASE_URL's database name to internops_test.
export default function setup() {
  const explicit = process.env.TEST_DATABASE_URL;
  const dev = process.env.DATABASE_URL;
  const url = explicit || (dev ? dev.replace(/\/[^/?]+(\?.*)?$/, "/internops_test$1") : undefined);
  if (!url) throw new Error("TEST_DATABASE_URL (or DATABASE_URL) must be set to run integration tests");
  if (!/internops_test|_test\b/.test(url)) {
    throw new Error(`Refusing to run integration tests against a database that isn't named like a test database: ${url.replace(/\/\/[^@]*@/, "//<creds>@")}`);
  }
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "vitest-secret";
  delete process.env.OPENAI_API_KEY;
  delete process.env.RESEND_API_KEY;
}
