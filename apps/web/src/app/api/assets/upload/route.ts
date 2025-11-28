import type { IncomingMessage } from "node:http";
import os from "node:os";
import { Readable } from "node:stream";
import fs from "node:fs/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { NextRequest, NextResponse } from "next/server";
import formidable, {
  type Fields,
  type Files,
  type File as FormidableFile,
} from "formidable";

import { env } from "@/env";
import { auth } from "@/server/auth";
import { createAssetFromUpload } from "@/server/services/asset-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uploadedFile: FormidableFile | undefined;

  try {
    const { fields, files } = await parseMultipartFormData(request);
    const siteId = getFieldValue(fields.siteId) ?? getFieldValue(fields.site);
    if (!siteId) {
      return NextResponse.json(
        { error: "siteId is required" },
        { status: 400 },
      );
    }

    const uploadFile = findFirstFile(files);
    if (!uploadFile) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    uploadedFile = uploadFile;

    const folderId = getFieldValue(fields.folderId ?? fields.folder);
    const tagIds = extractArray(fields.tagIds);
    const label = getFieldValue(fields.label) ?? uploadFile.originalFilename;
    const altTextPrompt = getFieldValue(fields.altTextPrompt);

    const asset = await createAssetFromUpload({
      siteId,
      folderId,
      originalName: uploadFile.originalFilename ?? uploadFile.newFilename,
      mimeType: uploadFile.mimetype ?? undefined,
      tempFilePath: uploadFile.filepath,
      label: label ?? "Untitled asset",
      tagIds,
      altTextPrompt,
      requestedByUserId: session.user.id,
    });
    return NextResponse.json({ asset });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload failed. Please try again.",
      },
      { status: 500 },
    );
  } finally {
    if (uploadedFile) {
      await safeRemove(uploadedFile);
    }
  }
}

async function parseMultipartFormData(request: NextRequest) {
  const form = formidable({
    multiples: false,
    maxFileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    uploadDir: os.tmpdir(),
    keepExtensions: true,
  });

  const nodeStream =
    request.body !== null
      ? Readable.fromWeb(request.body as unknown as NodeReadableStream<Uint8Array>)
      : Readable.from([]);

  const headers = Object.fromEntries(request.headers.entries());
  const incoming = Object.assign(nodeStream, {
    headers,
    method: request.method,
    url: request.url,
  }) as IncomingMessage;

  return new Promise<{ fields: Fields; files: Files }>(
    (resolve, reject) => {
      form.parse(incoming, (err, fields, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ fields, files });
      });
    },
  );
}

function getFieldValue(
  value?: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function extractArray(
  value?: string | string[] | undefined,
): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value : [value];
}

function findFirstFile(files: Files) {
  for (const entry of Object.values(files)) {
    if (!entry) continue;
    if (Array.isArray(entry)) {
      if (entry.length > 0) {
        return entry[0] as FormidableFile;
      }
    } else {
      return entry as FormidableFile;
    }
  }
  return undefined;
}

async function safeRemove(file: FormidableFile) {
  try {
    await fs.rm(file.filepath);
  } catch {
    // ignore cleanup errors
  }
}
