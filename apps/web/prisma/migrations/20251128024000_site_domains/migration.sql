CREATE TABLE "SiteDomain" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "redirectToPrimary" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteDomain_domain_key" ON "SiteDomain"("domain");

ALTER TABLE "SiteDomain"
  ADD CONSTRAINT "SiteDomain_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SiteDomain" ("id", "siteId", "domain", "isPrimary", "redirectToPrimary")
SELECT
  'dom_' || md5(random()::text || clock_timestamp()::text),
  "id",
  "domain",
  true,
  false
FROM "Site"
WHERE "domain" IS NOT NULL;



