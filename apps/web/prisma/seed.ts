import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-this-password";

  const site = await prisma.site.upsert({
    where: { slug: "primary" },
    update: {},
    create: {
      name: "Primary Site",
      slug: "primary",
      description: "Default site created by the seeder.",
      domain: null,
    },
  });

  const ownerRole = await prisma.role.upsert({
    where: { siteId_name: { siteId: site.id, name: "Owner" } },
    update: {},
    create: {
      siteId: site.id,
      name: "Owner",
      description: "Full access to site configuration and publishing.",
      permissions: {
        canPublish: true,
        canEditNavigation: true,
        canManageSettings: true,
      },
    },
  });

  await Promise.all([
    prisma.role.upsert({
      where: { siteId_name: { siteId: site.id, name: "Editor" } },
      update: {},
      create: {
        siteId: site.id,
        name: "Editor",
        description:
          "Can create and edit content, but cannot change site settings.",
        permissions: {
          canPublish: false,
          canEditNavigation: true,
          canManageSettings: false,
        },
      },
    }),
    prisma.role.upsert({
      where: { siteId_name: { siteId: site.id, name: "Viewer" } },
      update: {},
      create: {
        siteId: site.id,
        name: "Viewer",
        description: "Read-only access to the admin UI.",
        permissions: {
          canPublish: false,
          canEditNavigation: false,
          canManageSettings: false,
        },
      },
    }),
  ]);

  const passwordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      passwordHash,
    },
    create: {
      email: adminEmail.toLowerCase(),
      name: "Site Owner",
      passwordHash,
    },
  });

  await prisma.siteMembership.upsert({
    where: {
      siteId_userId: {
        siteId: site.id,
        userId: adminUser.id,
      },
    },
    update: {
      roleId: ownerRole.id,
    },
    create: {
      siteId: site.id,
      userId: adminUser.id,
      roleId: ownerRole.id,
    },
  });

  // First, create or find the page
  const homePage = await prisma.page.upsert({
    where: {
      siteId_path: {
        siteId: site.id,
        path: "/",
      },
    },
    update: {},
    create: {
      siteId: site.id,
      title: "Home",
      slug: "home",
      path: "/",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // Then create the revision with blocks
  const existingRevision = await prisma.revision.findFirst({
    where: {
      pageId: homePage.id,
      status: "PUBLISHED",
    },
  });

  if (!existingRevision) {
    const revision = await prisma.revision.create({
      data: {
        pageId: homePage.id,
        status: "PUBLISHED",
        summary: "Initial publish",
        meta: {
          seoTitle: "Welcome to Sweeney CMS",
          seoDescription: "Kick the tires on your new multi-site CMS.",
        },
      },
    });

    // Create blocks linked to both page and revision
    await prisma.contentBlock.createMany({
      data: [
        {
          pageId: homePage.id,
          revisionId: revision.id,
          kind: "hero",
          sortOrder: 0,
          data: {
            eyebrow: "New Project",
            heading: "Build once, power many sites.",
            body: "Manage content, navigation, metadata, and previews from a single control center.",
            ctaLabel: "Go to Admin",
            ctaHref: "/admin",
          },
        },
        {
          pageId: homePage.id,
          revisionId: revision.id,
          kind: "feature-grid",
          sortOrder: 1,
          data: {
            items: [
              {
                title: "Draft & Preview",
                body: "Work safely in draft, share previews, then publish with confidence.",
              },
              {
                title: "Multi-site aware",
                body: "Switch sites without leaving the admin interface.",
              },
              {
                title: "Composable sections",
                body: "Mix and match reusable sections for lightning-fast builds.",
              },
            ],
          },
        },
      ],
    });
  }

  await prisma.navigationMenu.upsert({
    where: {
      siteId_name: {
        siteId: site.id,
        name: "Primary Navigation",
      },
    },
    update: {},
    create: {
      siteId: site.id,
      name: "Primary Navigation",
      placement: "PRIMARY",
      items: {
        create: [
          {
            label: "Home",
            url: "/",
            sortOrder: 0,
          },
          {
            label: "Admin",
            url: "/admin",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  console.log("Database seed completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

