import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Every test run gets its own throwaway database; data/ is never touched.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "halolesson-test-"));
