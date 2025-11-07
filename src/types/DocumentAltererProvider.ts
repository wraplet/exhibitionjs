import { DocumentAlterer } from "./DocumentAlterer";

export interface DocumentAltererProvider {
  /**
   * Returns a function that can be used to alter the document.
   */
  getDocumentAlterer(): DocumentAlterer;

  /**
   * Returns the priority of the alterer, determining the order in which it is executed.
   */
  getPriority(): number;
}
