/** JSON stored in Lesson.content when type === "document" */
export interface SharePointDocumentRef {
  driveId: string;
  itemId: string;
  fileName: string;
  mimeType: string;
}

export interface SharePointFile {
  type: "file";
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  driveId: string;
  eTag?: string;
}

export interface SharePointFolder {
  type: "folder";
  id: string;
  name: string;
  childCount: number;
  driveId: string;
}

export type SharePointBrowseItem = SharePointFile | SharePointFolder;

export interface SharePointBreadcrumb {
  id: string;
  name: string;
}

export interface SharePointBrowseResponse {
  items: SharePointBrowseItem[];
  breadcrumbs: SharePointBreadcrumb[];
}
