import { PrismaClient, type Prisma } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

function hashApiToken(token: string, salt: string) {
  return createHash("sha256").update(`${token}.${salt}`).digest("hex");
}

function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
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

  const rootFolder = await prisma.assetFolder.upsert({
    where: {
      siteId_path: {
        siteId: site.id,
        path: "/",
      },
    },
    update: {},
    create: {
      siteId: site.id,
      name: "Media Library",
      slug: "media-library",
      path: "/",
    },
  });

  const heroFolder = await prisma.assetFolder.upsert({
    where: {
      siteId_path: {
        siteId: site.id,
        path: "/hero",
      },
    },
    update: {},
    create: {
      siteId: site.id,
      name: "Hero Shots",
      slug: "hero-shots",
      parentId: rootFolder.id,
      path: "/hero",
    },
  });

  const tagData = [
    { name: "Lifestyle", color: "#f97316" },
    { name: "Product", color: "#10b981" },
    { name: "Team", color: "#3b82f6" },
  ];

  const tags = await Promise.all(
    tagData.map((tag) =>
      prisma.assetTag.upsert({
        where: { siteId_slug: { siteId: site.id, slug: slugify(tag.name) } },
        update: {
          color: tag.color,
        },
        create: {
          siteId: site.id,
          name: tag.name,
          slug: slugify(tag.name),
          color: tag.color,
          description: `${tag.name} imagery`,
        },
      }),
    ),
  );

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

  const editorRole = await prisma.role.findUnique({
    where: { siteId_name: { siteId: site.id, name: "Editor" } },
  });

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

  const reviewerPasswordHash = await hashPassword("reviewer-demo-password");
  const reviewerUser = await prisma.user.upsert({
    where: { email: "reviewer@example.com" },
    update: {
      passwordHash: reviewerPasswordHash,
    },
    create: {
      email: "reviewer@example.com",
      name: "Content Reviewer",
      passwordHash: reviewerPasswordHash,
    },
  });

  await prisma.siteMembership.upsert({
    where: {
      siteId_userId: {
        siteId: site.id,
        userId: reviewerUser.id,
      },
    },
    update: {
      roleId: editorRole?.id ?? ownerRole.id,
    },
    create: {
      siteId: site.id,
      userId: reviewerUser.id,
      roleId: editorRole?.id ?? ownerRole.id,
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

    const heroReferenceKey = randomUUID();
    const gridReferenceKey = randomUUID();

    // Create blocks linked to both page and revision
    await prisma.contentBlock.createMany({
      data: [
        {
          pageId: homePage.id,
          revisionId: revision.id,
          kind: "hero",
          sortOrder: 0,
          referenceKey: heroReferenceKey,
          data: {
            eyebrow: "New Project",
            heading: "Build once, power many sites.",
            body: "Manage content, navigation, metadata, and previews from a single control center.",
            mediaUrl: "",
            mediaAlt: "",
            ctas: [
              {
                label: "Go to Admin",
                href: "/admin",
                variant: "primary",
              },
            ],
          },
          settings: {
            background: "default",
            alignment: "center",
            fullWidth: false,
          },
        },
        {
          pageId: homePage.id,
          revisionId: revision.id,
          kind: "grid",
          sortOrder: 1,
          referenceKey: gridReferenceKey,
          data: {
            title: "Why teams choose Sweeney CMS",
            columns: [
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
          settings: {
            background: "default",
            alignment: "left",
            fullWidth: false,
          },
        },
      ],
    });

    const reviewSubmissionAt = new Date();
    const reviewSubmissionNote = "Initial content is ready for a quick review.";

    await prisma.reviewEvent.create({
      data: {
        siteId: site.id,
        pageId: homePage.id,
        revisionId: revision.id,
        actorId: adminUser.id,
        type: "SUBMITTED",
        note: reviewSubmissionNote,
        createdAt: reviewSubmissionAt,
      },
    });

    const reviewApprovedEvent = reviewerUser
      ? await prisma.reviewEvent.create({
          data: {
            siteId: site.id,
            pageId: homePage.id,
            revisionId: revision.id,
            actorId: reviewerUser.id,
            type: "APPROVED",
            note: "Looks solid—pushing it live.",
          },
        })
      : null;

    const commentThread = reviewerUser
      ? await prisma.blockCommentThread.create({
          data: {
            siteId: site.id,
            pageId: homePage.id,
            revisionId: revision.id,
            blockReferenceKey: heroReferenceKey,
            status: "RESOLVED",
            createdById: reviewerUser.id,
            resolvedById: adminUser.id,
            resolvedAt: new Date(),
            comments: {
              create: [
                {
                  authorId: reviewerUser.id,
                  body: "Can we call out preview links here?",
                },
                {
                  authorId: adminUser.id,
                  body: "Added a sentence beneath the hero copy.",
                },
              ],
            },
          },
          include: { comments: true },
        })
      : null;

    const activitySeed: Prisma.ActivityEventCreateManyInput[] = [
      {
        siteId: site.id,
        pageId: homePage.id,
        revisionId: revision.id,
        actorId: adminUser.id,
          kind: "REVISION_SUBMITTED",
        metadata: { note: reviewSubmissionNote },
        occurredAt: reviewSubmissionAt,
      },
    ];

    if (reviewApprovedEvent && reviewerUser) {
      activitySeed.push({
        siteId: site.id,
        pageId: homePage.id,
        revisionId: revision.id,
        actorId: reviewerUser.id,
        kind: "REVISION_APPROVED",
        metadata: { note: reviewApprovedEvent.note },
        occurredAt: reviewApprovedEvent.createdAt,
      });
    }

    if (commentThread) {
      const [firstComment, secondComment] = commentThread.comments;
      if (firstComment) {
        activitySeed.push({
          siteId: site.id,
          pageId: homePage.id,
          revisionId: revision.id,
          actorId: firstComment.authorId,
          kind: "COMMENT_ADDED",
          commentThreadId: commentThread.id,
          commentId: firstComment.id,
          metadata: { blockReferenceKey: heroReferenceKey },
          occurredAt: firstComment.createdAt,
        });
      }
      if (secondComment) {
        activitySeed.push({
          siteId: site.id,
          pageId: homePage.id,
          revisionId: revision.id,
          actorId: secondComment.authorId,
          kind: "COMMENT_ADDED",
          commentThreadId: commentThread.id,
          commentId: secondComment.id,
          metadata: { blockReferenceKey: heroReferenceKey },
          occurredAt: secondComment.createdAt,
        });
      }
      activitySeed.push({
        siteId: site.id,
        pageId: homePage.id,
        revisionId: revision.id,
        actorId: adminUser.id,
        kind: "COMMENT_RESOLVED",
        commentThreadId: commentThread.id,
        metadata: { resolution: "Marked resolved in seed data." },
      });
    }

    await prisma.activityEvent.createMany({
      data: activitySeed,
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

  const sampleAsset = await prisma.asset.upsert({
    where: { storageKey: "seed/sample-hero.jpg" },
    update: {},
    create: {
      siteId: site.id,
      folderId: heroFolder.id,
      label: "Sample Hero Image",
      fileName: "hero.jpg",
      mimeType: "image/jpeg",
      fileSize: 102400,
      url: "/uploads/seed/sample-hero.jpg",
      storageKey: "seed/sample-hero.jpg",
      type: "IMAGE",
      checksum: "seed-sample-hero.jpg",
      width: 1600,
      height: 900,
      altText: "Team collaborating at a large table with laptops.",
      altTextSource: "seed",
      metadata: {
        source: "seed",
      },
    },
  });

  await prisma.assetTagOnAsset.deleteMany({
    where: { assetId: sampleAsset.id },
  });

  await prisma.assetTagOnAsset.createMany({
    data: tags.slice(0, 2).map((tag) => ({
      assetId: sampleAsset.id,
      tagId: tag.id,
    })),
  });

  const tokenSalt = process.env.HEADLESS_API_TOKEN_SALT ?? "dev-headless-token-salt";
  const headlessTokenValue = generateSecret(24);
  const tokenHash = hashApiToken(headlessTokenValue, tokenSalt);

  const apiToken = await prisma.apiToken.upsert({
    where: { tokenHash },
    update: {},
    create: {
      siteId: site.id,
      name: "Local Dev Token",
      description: "Seeded token for testing the headless APIs.",
      tokenHash,
      tokenPrefix: headlessTokenValue.slice(0, 8),
      scopes: ["content:read", "content:drafts", "search:manage"],
    },
  });

  console.log(
    `Seeded API token "${apiToken.name}". Store it somewhere safe: ${headlessTokenValue}`,
  );

  await prisma.integrationWebhook.upsert({
    where: { siteId_name: { siteId: site.id, name: "Local Delivery Logger" } },
    update: {},
    create: {
      siteId: site.id,
      name: "Local Delivery Logger",
      url: "http://localhost:3030/webhooks/cms",
      secret: generateSecret(16),
      events: ["page.published", "page.unpublished", "page.updated"],
      isEnabled: false,
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

