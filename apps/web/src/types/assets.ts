export type AssetFolderDTO = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  path: string;
  parentId: string | null;
};

export type AssetTagDTO = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  color?: string | null;
  description?: string | null;
};

export type AssetTransformDTO = {
  id: string;
  assetId: string;
  kind: string;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  quality?: number | null;
  status: string;
  storageKey: string;
  url: string;
  checksum?: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type AssetTagOnAssetDTO = {
  tag: AssetTagDTO;
  tagId: string;
};

export type AssetDTO = {
  id: string;
  siteId: string;
  folderId?: string | null;
  label: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  cdnUrl?: string | null;
  type: string;
  width?: number | null;
  height?: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  altText?: string | null;
  altTextSource?: string | null;
  transforms: AssetTransformDTO[];
  tags: AssetTagOnAssetDTO[];
  folder?: AssetFolderDTO | null;
};



