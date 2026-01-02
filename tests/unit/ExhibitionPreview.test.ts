import { ExhibitionPreview } from "../../src/ExhibitionPreview";
import { DefaultCore } from "wraplet";
import { DocumentAlterer } from "../../src/types/DocumentAlterer";

it("ExhibitionPreview should be able to add document alterers", () => {
  const alterer: DocumentAlterer = async () => {};

  const iframe = document.createElement("iframe");
  const core = new DefaultCore(iframe, {});
  const preview = new ExhibitionPreview(core);
  preview.addDocumentAlterer(alterer, 0);
  expect((preview as any).alterers).toHaveLength(1);

  // The same alterer cannot be added twice.
  preview.addDocumentAlterer(alterer, 0);
  expect((preview as any).alterers).toHaveLength(1);
});
