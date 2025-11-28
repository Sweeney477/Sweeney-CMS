import { NextResponse } from "next/server";

import { listSites } from "@/server/services/site-service";

export async function GET() {
  const sites = await listSites();
  return NextResponse.json(sites);
}


