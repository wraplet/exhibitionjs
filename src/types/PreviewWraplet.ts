import { DocumentAlterer } from "./DocumentAlterer";
import { Wraplet } from "wraplet";

export interface PreviewWraplet extends Wraplet {
  addDocumentAlterer(alterer: DocumentAlterer, priority?: number): void;
  hasDocumentAlterer(alterer: DocumentAlterer): boolean;
  removeDocumentAlterer(alterer: DocumentAlterer): void;
  removeIFrame(): void;
  update(): Promise<void>;
}
