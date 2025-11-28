'use server';

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db";
import { normalizeDomain } from "@/server/services/site-service";
import { isValidTimeZone } from "@/lib/timezones";

const siteSettingsSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(1),
  description: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null),
  timezone: z
    .string()
    .refine((value) => isValidTimeZone(value), { message: "Invalid timezone." }),
});

const booleanField = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => value === "true");

const createDomainSchema = z.object({
  siteId: z.string().cuid(),
  domain: z
    .string()
    .min(1, "Enter a domain.")
    .transform((value) => sanitizeDomainInput(value))
    .refine((value) => Boolean(value), { message: "Enter a valid domain." }),
  isPrimary: booleanField,
  redirectToPrimary: booleanField,
});

const domainTargetSchema = z.object({
  domainId: z.string().cuid(),
  siteId: z.string().cuid(),
});

const updateRedirectSchema = domainTargetSchema.extend({
  redirectToPrimary: booleanField,
});

type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function updateSiteSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = siteSettingsSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
    };
  }

  const { siteId, name, description, timezone } = parsed.data;

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name,
      description,
      timezone,
    },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function createSiteDomainAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = createDomainSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.at(0)?.message ?? "Validation failed",
    };
  }

  const { siteId, domain, redirectToPrimary } = parsed.data;
  const hasPrimary = await prisma.siteDomain.findFirst({
    where: { siteId, isPrimary: true },
  });
  const makePrimary = parsed.data.isPrimary || !hasPrimary;

  try {
    await prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.siteDomain.updateMany({
          where: { siteId },
          data: { isPrimary: false },
        });
      }

      await tx.siteDomain.create({
        data: {
          siteId,
          domain,
          isPrimary: makePrimary,
          redirectToPrimary: makePrimary ? false : redirectToPrimary,
        },
      });

      if (makePrimary) {
        await tx.site.update({
          where: { id: siteId },
          data: { domain },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "That domain is already in use.",
      };
    }
    throw error;
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function setPrimarySiteDomainAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = domainTargetSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }

  const { domainId, siteId } = parsed.data;
  const domain = await prisma.siteDomain.findFirst({
    where: { id: domainId, siteId },
  });

  if (!domain) {
    return { success: false, error: "Domain not found for this site." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteDomain.updateMany({
      where: { siteId },
      data: { isPrimary: false },
    });

    await tx.siteDomain.update({
      where: { id: domainId },
      data: { isPrimary: true, redirectToPrimary: false },
    });

    await tx.site.update({
      where: { id: siteId },
      data: { domain: domain.domain },
    });
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateSiteDomainRedirectAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = updateRedirectSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }

  const { domainId, siteId, redirectToPrimary } = parsed.data;

  const domain = await prisma.siteDomain.findFirst({
    where: { id: domainId, siteId },
  });

  if (!domain) {
    return { success: false, error: "Domain not found." };
  }

  if (domain.isPrimary) {
    return {
      success: false,
      error: "Primary domains always serve traffic and cannot redirect.",
    };
  }

  await prisma.siteDomain.update({
    where: { id: domainId },
    data: {
      redirectToPrimary,
    },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function deleteSiteDomainAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = domainTargetSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }

  const { domainId, siteId } = parsed.data;

  const domain = await prisma.siteDomain.findFirst({
    where: { id: domainId, siteId },
  });

  if (!domain) {
    return { success: false, error: "Domain not found for this site." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteDomain.delete({
      where: { id: domainId },
    });

    if (domain.isPrimary) {
      const nextPrimary = await tx.siteDomain.findFirst({
        where: { siteId },
        orderBy: [
          { isPrimary: "desc" },
          { createdAt: "asc" },
        ],
      });

      if (nextPrimary) {
        await tx.siteDomain.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true, redirectToPrimary: false },
        });
        await tx.site.update({
          where: { id: siteId },
          data: { domain: nextPrimary.domain },
        });
      } else {
        await tx.site.update({
          where: { id: siteId },
          data: { domain: null },
        });
      }
    }
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

function sanitizeDomainInput(value: string) {
  const normalized = normalizeDomain(value);
  return normalized ?? "";
}
