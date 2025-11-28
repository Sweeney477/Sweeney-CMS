declare module "formidable" {
  import type { IncomingMessage } from "http";

  export type Fields = Record<string, string | string[] | undefined>;
  export type Files = Record<string, File | File[]>;

  export interface File {
    filepath: string;
    originalFilename?: string | null;
    newFilename: string;
    mimetype?: string | null;
    size: number;
  }

  export class IncomingForm {
    constructor(options?: Record<string, unknown>);
    parse(
      req: IncomingMessage,
      callback: (err: any, fields: Fields, files: Files) => void,
    ): void;
  }

  export default function formidable(options?: Record<string, unknown>): IncomingForm;
}
