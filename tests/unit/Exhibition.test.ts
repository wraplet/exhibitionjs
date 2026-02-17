import { Exhibition } from "../../src";
import {
  Constructable,
  DefaultCore,
  WrapletApi,
  WrapletDependencyMap,
  WrapletSymbol,
} from "wraplet";
import { ExhibitionPreview } from "../../src";
import { DocumentAltererProviderWraplet } from "../../src";
import { DocumentAlterer } from "../../src";
import { MonacoInstance } from "../../src";

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
        Class: class {} as any,
        args: [],
      },
      preview: {
        selector: "iframe[data-js-exhibition-preview]",
        multiple: false,
        required: true,
        Class: ExhibitionPreview,
        args: [],
      },
    } as const satisfies WrapletDependencyMap;

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

  it("should override 'Class' based on the provided options when producing customized map", async () => {
    const editorsClassMock = jest.fn();
    const previewClassMock = jest.fn();
    const map = Exhibition.getCustomizedMap({
      editors: { Class: editorsClassMock },
      preview: { Class: previewClassMock },
    });
    expect(map.editors.Class).toBe(editorsClassMock);
    expect(map.preview.Class).toBe(previewClassMock);
  });

  it("should allow to provide custom options to the children when producing map", async () => {
    const funcGetMap = () => {
      // @ts-expect-error Default editors options require "monaco" property.
      Exhibition.getMap({});
    };

    expect(funcGetMap).toThrow(
      "If editors are enabled, editors configuration must be provided.",
    );

    // If "monaco" is provided, there should be no error.
    Exhibition.getMap({
      configuration: {
        editors: {
          options: {
            monaco: {} as unknown as MonacoInstance,
          },
        },
      },
    });

    // If editors are disabled, there should be no error.
    Exhibition.getMap({ deferEditors: true });

    /*
     * Customized map.
     */

    const funcGetCustomizedMap = () => {
      // @ts-expect-error Default classes have to be provided.
      Exhibition.getCustomizedMap();
    };

    expect(funcGetCustomizedMap).toThrow("Configuration must be provided.");

    // If classes are provided, there should be no error.
    Exhibition.getCustomizedMap({
      editors: {
        Class: null as unknown as Constructable<DocumentAltererProviderWraplet>,
      },
      preview: {
        Class: null as unknown as Constructable<ExhibitionPreview>,
      },
    });
  });

  it("should not allow invalid arguments configurations", async () => {
    const funcDisabledEditorsEnabledSelector = () => {
      Exhibition.getMap({
        deferEditors: true,
        configuration: {
          editors: {
            selector: ".test",
          },
        } as any,
      });
    };

    expect(funcDisabledEditorsEnabledSelector).toThrow(
      "If editors are disabled, editors selector cannot be used.",
    );

    const funcEnabledEditorsDisabledSelector = () => {
      Exhibition.getMap({
        configuration: {
          editors: {
            selector: undefined,
          },
        } as any,
      });
    };

    expect(funcEnabledEditorsDisabledSelector).toThrow(
      "If editors are enabled, editors selector cannot be manually set to non-string.",
    );

    const funcEnabledEditorsNoConfiguration = () => {
      Exhibition.getMap({} as any);
    };

    expect(funcEnabledEditorsNoConfiguration).toThrow(
      "If editors are enabled, editors configuration must be provided.",
    );

    const funcEnabledEditorsNoMonaco = () => {
      Exhibition.getMap({
        configuration: { editors: { options: {} as any } },
      });
    };

    expect(funcEnabledEditorsNoMonaco).toThrow(
      "If 'editors' dependency autoloading is not disabled, you must provide the 'monaco' option in its options.",
    );
  });

  it("should not mutate the global ExhibitionMap across multiple getMap calls", () => {
    const monacoOptionsStorageMock1 = jest.fn();
    const monacoOptionsStorageMock2 = jest.fn();
    const map1 = Exhibition.getMap({
      configuration: {
        editors: {
          optionsStorage: monacoOptionsStorageMock1 as any,
          options: {
            monaco: {} as any,
          },
        },
      },
    });

    expect(map1.editors.args[1]).toEqual(monacoOptionsStorageMock1);

    Exhibition.getMap({
      configuration: {
        editors: {
          optionsStorage: monacoOptionsStorageMock2 as any,
          options: {
            monaco: {} as any,
          },
        },
      },
    });

    // map1 didn't mutate.
    expect(map1.editors.args[1]).toEqual(monacoOptionsStorageMock1);
  });
});
