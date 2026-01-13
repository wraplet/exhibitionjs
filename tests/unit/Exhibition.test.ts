import {
  Exhibition,
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

  it("should override 'editorsClass' based on the provided option when producing map", async () => {
    const mock = {};
    const map = Exhibition.getMap<any>({
      editorsClass: mock as any,
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

    const editorsOptions: CustomEditorOptions = {
      option2: "options2value",
    };

    const previewOptions: CustomPreviewOptions = {
      option1: "options1value",
    };

    // @ts-expect-error When "undefined" is provided, the default types are used. Default editors
    // options require "monaco" property.
    Exhibition.getMap();

    // editors options are deferred, so the requirement of the "monaco" property should
    // not be enforced.
    Exhibition.getMap<"deferred">();

    // Custom editors options are provided.
    Exhibition.getMap<EditorsOptionsWrapper<CustomEditorOptions>>({
      editorsOptions: editorsOptions,
    });

    // @ts-expect-error When "undefined" is provided, the default types are used.
    // This should cause an error as default editors options require "monaco" property.
    Exhibition.getMap<undefined>();

    // Testing if default options are applied correctly.
    const map = Exhibition.getMap<
      EditorsOptionsWrapper<CustomEditorOptions>,
      PreviewOptionsWrapper<CustomPreviewOptions>
    >({
      previewOptions: previewOptions,
      editorsOptions: editorsOptions,
    });

    expect(map.preview.args).toContain(previewOptions);
    expect(map.editors.args).toContain(editorsOptions);
  });
});
