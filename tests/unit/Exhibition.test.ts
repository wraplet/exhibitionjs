import { Exhibition } from "../../src/Exhibition";
import {
  DefaultCore,
  WrapletApi,
  WrapletChildrenMap,
  WrapletSymbol,
} from "wraplet";
import { ExhibitionPreview } from "../../src/ExhibitionPreview";
import { DocumentAltererProviderWraplet } from "../../src/types/DocumentAltererProviderWraplet";
import { DocumentAlterer } from "../../src/types/DocumentAlterer";

describe("Exhibition", () => {
  it("should be able to add and remove editors", () => {
    const container = document.createElement("div");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-js-exhibition-preview", "");
    container.appendChild(iframe);

    const ExhibitionMap = {
      editors: {
        selector: "[data-js-exhibition-editor]",
        multiple: true,
        required: false,
        Class: {} as any,
        args: [],
      },
      preview: {
        selector: "iframe[data-js-exhibition-preview]",
        multiple: false,
        required: true,
        Class: ExhibitionPreview,
      },
    } as const satisfies WrapletChildrenMap;

    const core = new DefaultCore(container, ExhibitionMap);
    const exhibition = new Exhibition(core);

    const mockAlterer: DocumentAlterer = async () => {};
    const mockEditor: DocumentAltererProviderWraplet = {
      [WrapletSymbol]: true,
      getDocumentAlterer: () => mockAlterer,
      getPriority: () => 0,
      wraplet: {
        status: {
          isInitialized: false,
        },
      } as WrapletApi<HTMLElement>,
    };

    // Initially no editor
    expect(exhibition.hasEditor(mockEditor)).toBe(false);

    const preview = exhibition.getPreview();

    // Add editor
    exhibition.addEditor(mockEditor);
    expect(exhibition.hasEditor(mockEditor)).toBe(true);
    expect(preview.hasDocumentAlterer(mockAlterer)).toBe(true);

    // Remove editor
    exhibition.removeEditor(mockEditor);
    expect(exhibition.hasEditor(mockEditor)).toBe(false);
    expect(preview.hasDocumentAlterer(mockAlterer)).toBe(false);
  });
});
