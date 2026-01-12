import {
  Exhibition,
  ExhibitionMapOptions,
  EditorsOptionsWrapper,
  PreviewOptionsWrapper,
} from "../../src/Exhibition";
import {
  DefaultCore,
  WrapletApi,
  WrapletChildrenMap,
  WrapletSymbol,
} from "wraplet";
import { ExhibitionPreview } from "../../src/ExhibitionPreview";
import { DocumentAltererProviderWraplet } from "../../src/types/DocumentAltererProviderWraplet";
import { DocumentAlterer } from "../../src/types/DocumentAlterer";
import { ExhibitionMonacoEditor } from "../../src";

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
        args: [],
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

  it("should not require 'Class' option when getting map", async () => {
    const map = Exhibition.getMap({
      selectEditors: false,
      editorsOptions: { monaco: {} as any },
    });
    // Default Class is set.
    expect(map.editors.Class).toBe(ExhibitionMonacoEditor);
  });

  it("should override 'Class' based on the provided option when producing map", async () => {
    const mock = {};
    const map = Exhibition.getMap<any>({
      Class: mock as any,
    });
    expect(map.editors.Class).toBe(mock);
  });

  it("should allow to provide custom options to the children when producing map", async () => {
    type CustomPreviewOptions = {
      option1: string;
    };
    type CustomEditorOptions = {
      option2: string;
    };

    type CustomOptions = ExhibitionMapOptions<
      EditorsOptionsWrapper<CustomEditorOptions>,
      PreviewOptionsWrapper<CustomPreviewOptions>
    >;

    const editorsOptions: CustomEditorOptions = {
      option2: "options2value",
    };

    const previewOptions: CustomPreviewOptions = {
      option1: "options1value",
    };

    const map = Exhibition.getMap<CustomOptions>({
      Class: {} as any,
      editorsOptions: editorsOptions,
      previewOptions: previewOptions,
    });
    expect(map.preview.args).toContain(previewOptions);
    expect(map.editors.args).toContain(editorsOptions);
  });
});
