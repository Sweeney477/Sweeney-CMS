export const PREVIEW_REVISION_COOKIE = "sweeney_preview_revision";

export function encodePreviewCookie(revisionId: string, siteId: string) {
  return `${revisionId}:${siteId}`;
}

export function decodePreviewCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  const [revisionId, siteId] = value.split(":");

  if (!revisionId || !siteId) {
    return null;
  }

  return {
    revisionId,
    siteId,
  };
}



