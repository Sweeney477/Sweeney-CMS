import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

const tmpUploadRoot = path.join(os.tmpdir(), "sweeney-cms-uploads-test");

process.env.ASSET_STORAGE_ROOT = tmpUploadRoot;
process.env.ASSET_BASE_URL = "http://localhost:3000/uploads";
process.env.NEXT_PUBLIC_ASSET_BASE_URL = "http://localhost:3000/uploads";

await fs.rm(tmpUploadRoot, { recursive: true, force: true });
await fs.mkdir(tmpUploadRoot, { recursive: true });

vi.mock("server-only", () => ({}));

