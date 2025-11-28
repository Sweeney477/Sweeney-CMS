'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db";

const navItemSchema = z.object({
  menuId: z.string().cuid(),
  label: z.string().min(1),
  url: z.string().min(1),
  openInNew: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
});

export async function createNavigationItemAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = navItemSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
    };
  }

  const { menuId, label, url, openInNew } = parsed.data;

  const sortOrder =
    ((await prisma.navigationItem.count({
      where: { menuId },
    })) ?? 0) + 1;

  await prisma.navigationItem.create({
    data: {
      menuId,
      label,
      url,
      openInNew,
      sortOrder,
    },
  });

  revalidatePath("/admin/navigation");
  return { success: true };
}


