'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db";

const siteSettingsSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(1),
  domain: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null),
  description: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null),
});

export async function updateSiteSettingsAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = siteSettingsSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
    };
  }

  const { siteId, name, domain, description } = parsed.data;

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name,
      domain,
      description,
    },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}


