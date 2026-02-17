import {
  AbstractWraplet,
  Constructable,
  Core,
  createDefaultInitializeCallback,
  customizeDefaultWrapletApi,
  DefaultCore,
  Status,
  WrapletDependencyMap,
} from "wraplet";
import {
  ExhibitionPreview,
  ExhibitionPreviewOptions,
} from "./ExhibitionPreview";
import {
  ExhibitionMonacoEditor,
  ExhibitionMonacoEditorOptions,
} from "./ExhibitionMonacoEditor";
import { exhibitionDefaultAttribute } from "./selectors";
import { DocumentAltererProviderWraplet } from "./types/DocumentAltererProviderWraplet";
import {
  ElementAttributeStorage,
  isKeyValueStorage,
  KeyValueStorage,
  StorageWrapper,
} from "wraplet/storage";
import { DocumentAlterer } from "./types/DocumentAlterer";
import { PreviewWraplet } from "./types/PreviewWraplet";

export type ExhibitionOptions = {
  /**
   * Selector for the element that triggers the update of the preview.
   */
  updaterSelector?: string;
};

export type ExhibitionInitOptions = {
  init?: boolean;
  updatePreview?: boolean;
};

export type MapConfiguration = {
  editors: {
    selector?: string;
    Class: Constructable<DocumentAltererProviderWraplet>;
    args?: unknown[];
  };
  preview: {
    selector?: string;
    Class: Constructable<PreviewWraplet>;
    args?: unknown[];
  };
};

export type DefaultMapConfiguration = {
  editors: {
    selector?: string;
    options: ExhibitionMonacoEditorOptions;
    optionsStorage?: KeyValueStorage<Partial<ExhibitionMonacoEditorOptions>>;
  };
  preview?: {
    selector?: string;
    options?: ExhibitionPreviewOptions;
    optionsStorage?: KeyValueStorage<ExhibitionPreviewOptions>;
  };
};

export type DisabledEditorsDefaultMapConfiguration = Omit<
  Partial<DefaultMapConfiguration>,
  "editors"
>;

type GetMapArgs =
  | { configuration: DefaultMapConfiguration; deferEditors?: false }
  | {
      configuration?: DisabledEditorsDefaultMapConfiguration;
      deferEditors: true;
    };

/**
 * This is a factory function that creates a new map each time it's run.
 */
function createMap(configuration: MapConfiguration) {
  const Class = configuration.editors.Class || ExhibitionMonacoEditor;
  return {
    editors: {
      selector: configuration.editors.selector,
      multiple: true,
      required: false,
      Class: Class,
      args: configuration.editors.args || [],
    },
    preview: {
      selector: configuration.preview.selector,
      multiple: false,
      required: true,
      Class: configuration.preview.Class,
      args: configuration.preview.args || [],
    },
  } satisfies WrapletDependencyMap;
}

export class Exhibition extends AbstractWraplet<
  HTMLElement,
  ReturnType<typeof createMap>
> {
  private status: Status = {
    isInitialized: false,
    isDestroyed: false,
    isGettingInitialized: false,
    isGettingDestroyed: false,
  };

  private options: KeyValueStorage<Required<ExhibitionOptions>>;
  constructor(
    core: Core<HTMLElement, ReturnType<typeof createMap>>,
    options: ExhibitionOptions = {},
    optionsStorage?: KeyValueStorage<Partial<ExhibitionOptions>>,
  ) {
    super(core);

    if (
      typeof optionsStorage !== "undefined" &&
      !isKeyValueStorage(optionsStorage)
    ) {
      throw new Error("Provided optionsStorage must be a KeyValueStorage");
    }

    const defaultOptions: Required<ExhibitionOptions> = {
      updaterSelector: "[data-js-exhibition-updater]",
    };

    const optsStorage =
      optionsStorage ??
      new ElementAttributeStorage<Partial<ExhibitionOptions>, true>(
        true,
        this.node,
        "data-js-options",
        {},
        {
          updaterSelector: (data: unknown) => typeof data === "string",
        },
      );
    this.options = new StorageWrapper<Required<ExhibitionOptions>>(
      optsStorage,
      { ...defaultOptions, ...options },
      {
        updaterSelector: (data: unknown) => typeof data === "string",
      },
    );

    this.wraplet = customizeDefaultWrapletApi(
      {
        status: this.status,
        initialize: this.initialize.bind(this),
      },
      this.wraplet,
    );
  }

  protected supportedNodeTypes(): readonly Constructable<HTMLElement>[] {
    return super.supportedNodeTypesGuard([HTMLElement]);
  }

  public async initialize() {
    return createDefaultInitializeCallback(
      {
        core: this.core,
        status: this.status,
        wraplet: this,
        destroyCallback: this.wraplet.destroy,
      },
      async () => {
        if (this.status.isInitialized) {
          throw new Error("Exhibition is already initialized");
        }

        if (!this.d.editors) {
          throw new Error("Exhibition has no editors");
        }

        for (const editor of this.d.editors) {
          if (
            !editor.wraplet.status.isInitialized &&
            !editor.wraplet.status.isGettingInitialized
          ) {
            await editor.wraplet.initialize();
          }

          if (!this.d.preview.hasDocumentAlterer(editor.getDocumentAlterer())) {
            this.addPreviewAlterer(
              editor.getDocumentAlterer(),
              editor.getPriority(),
            );
          }
        }

        const updaterElements = this.node.querySelectorAll(
          await this.options.get("updaterSelector"),
        );

        for (const element of updaterElements) {
          this.core.addEventListener(element, "click", () => {
            this.updatePreview();
          });
        }
      },
    )();
  }

  /**
   * Adds DocumentAltererProviderWraplet instance to the list of editors.
   */
  public addEditor(editor: DocumentAltererProviderWraplet): void {
    this.d.editors.add(editor);
    this.d.preview.addDocumentAlterer(editor.getDocumentAlterer());
  }

  /**
   * Removes DocumentAltererProviderWraplet instance from the list of editors.
   */
  public removeEditor(editor: DocumentAltererProviderWraplet): void {
    this.d.editors.delete(editor);
    this.d.preview.removeDocumentAlterer(editor.getDocumentAlterer());
  }

  /**
   * Checks if the given editor is present in the list of editors.
   */
  public hasEditor(editor: DocumentAltererProviderWraplet): boolean {
    return this.d.editors.has(editor);
  }

  /**
   * Adds a simple DocumentAlterer to the preview.
   */
  private addPreviewAlterer(
    alterer: DocumentAlterer,
    priority: number = 0,
  ): void {
    this.d.preview.addDocumentAlterer(alterer, priority);
  }

  public getPreview(): PreviewWraplet {
    return this.d.preview;
  }

  public async updatePreview(): Promise<void> {
    await this.d.preview.update();
  }

  /**
   * Create multiple Exhibitions.
   *
   * @param node Node to create Exhibitions on.
   * @param map Map of dependencies for each Exhibition instance.
   * @param options Options for Exhibition instances.
   * @param initOptions Options related to the creation process of the Exhibitions.
   * @param attribute Attribute to use for Exhibition instances.
   *
   * @returns Array of Exhibition instances.
   */
  public static async createMultiple<
    M extends ReturnType<typeof createMap> = ReturnType<typeof createMap>,
  >(
    node: ParentNode,
    map: M,
    options: ExhibitionOptions = {},
    initOptions: ExhibitionInitOptions = {},
    attribute: string = exhibitionDefaultAttribute,
  ): Promise<Exhibition[]> {
    initOptions = this.fillCreateOptionsWithDefaults(initOptions);
    this.validateInitOptions(initOptions, map);

    const exhibitions = this.createWraplets<HTMLElement, Exhibition>(
      node,
      map,
      attribute,
      [options],
    );

    for (const exhibition of exhibitions) {
      await this.applyCreateOptions(exhibition, initOptions);
    }

    return exhibitions;
  }

  /**
   * Create a single Exhibition instance wrapping a given element.
   *
   * @param element Element to wrap.
   * @param map Map of dependencies for the Exhibition instance.
   * @param options Options for the Exhibition instance.
   * @param initOptions Options related to the creation process of the Exhibitions.
   */
  public static async create<
    M extends ReturnType<typeof createMap> = ReturnType<typeof createMap>,
  >(
    element: HTMLElement,
    map: M,
    options: ExhibitionOptions = {},
    initOptions: ExhibitionInitOptions = {},
  ): Promise<Exhibition> {
    initOptions = this.fillCreateOptionsWithDefaults(initOptions);
    this.validateInitOptions(initOptions, map);
    const core = new DefaultCore<HTMLElement, ReturnType<typeof createMap>>(
      element,
      map,
    );
    const exhibition = new Exhibition(core, options);
    await this.applyCreateOptions(exhibition, initOptions);
    return exhibition;
  }

  private static fillCreateOptionsWithDefaults(
    createOptions: ExhibitionInitOptions,
  ) {
    return {
      init: true,
      updatePreview: false,
      ...createOptions,
    };
  }

  /**
   * Validate create options.
   */
  private static validateInitOptions(
    initOptions: ExhibitionInitOptions,
    map: ReturnType<typeof createMap>,
  ) {
    if (initOptions.init && map.editors.selector === undefined) {
      throw new Error(
        "Cannot initialize exhibition with undefined editors.selector",
      );
    }

    if (!initOptions.init && initOptions.updatePreview) {
      throw new Error(
        "Cannot update preview without initializing exhibitions first",
      );
    }
  }

  /**
   * Create options.
   */
  private static async applyCreateOptions(
    exhibition: Exhibition,
    options: ExhibitionInitOptions = {},
  ): Promise<void> {
    if (!options.init && options.updatePreview) {
      throw new Error(
        "'updatePreview' option cannot be enabled without the 'init' one because updating preview requires initialization.",
      );
    }

    if (options.init) {
      await exhibition.initialize();
    }

    if (options.updatePreview) {
      await exhibition.updatePreview();
    }
  }

  /**
   * Creates a default, preconfigured, map for Exhibition.
   */
  public static getMap(args: GetMapArgs): ReturnType<typeof createMap> {
    const deferEditors = args.deferEditors || false;

    /*
     * Args integrity checks.
     */

    if (
      deferEditors &&
      (args.configuration as DefaultMapConfiguration)?.editors?.selector
    ) {
      throw new Error(
        "If editors are disabled, editors selector cannot be used.",
      );
    }

    if (
      !deferEditors &&
      (args.configuration as DefaultMapConfiguration)?.editors &&
      "selector" in (args.configuration as DefaultMapConfiguration).editors &&
      !(args.configuration as DefaultMapConfiguration).editors.selector
    ) {
      throw new Error(
        "If editors are enabled, editors selector cannot be manually set to non-string.",
      );
    }

    if (!deferEditors) {
      if (!(args.configuration as DefaultMapConfiguration)?.editors) {
        throw new Error(
          "If editors are enabled, editors configuration must be provided.",
        );
      }
    }

    if (
      !deferEditors &&
      (!(args.configuration as DefaultMapConfiguration)?.editors?.options ||
        !(
          (args.configuration as DefaultMapConfiguration)?.editors?.options as {
            monaco?: unknown;
          }
        )["monaco"])
    ) {
      throw new Error(
        "If 'editors' dependency autoloading is not disabled, you must provide the 'monaco' option in its options.",
      );
    }

    /*
     * / Args integrity checks.
     */

    let editorsSelector: string | undefined = "[data-js-exhibition-editor]";
    if (deferEditors) {
      editorsSelector = undefined;
    }

    const editorsArgs: unknown[] = [];

    if (!deferEditors) {
      if (args.configuration.editors.options) {
        editorsArgs.push(args.configuration.editors.options);
      }
      if (args.configuration.editors.optionsStorage) {
        editorsArgs.push(args.configuration.editors.optionsStorage);
      }
    }

    let previewSelector: string = "iframe[data-js-exhibition-preview]";
    const previewArgs: unknown[] = [];
    if (args.configuration?.preview) {
      if (args.configuration.preview?.selector) {
        previewSelector = args.configuration.preview.selector;
      }
      if (args.configuration.preview.options) {
        previewArgs.push(args.configuration.preview.options);
      }
      if (args.configuration.preview.optionsStorage) {
        previewArgs.push(args.configuration.preview.optionsStorage);
      }
    }

    return createMap({
      editors: {
        selector: editorsSelector,
        Class: ExhibitionMonacoEditor,
        args: editorsArgs,
      },
      preview: {
        selector: previewSelector,
        Class: ExhibitionPreview,
        args: previewArgs,
      },
    });
  }

  public static getCustomizedMap(
    configuration: MapConfiguration,
  ): ReturnType<typeof createMap> {
    if (!configuration) {
      throw new Error("Configuration must be provided.");
    }
    return createMap(configuration);
  }
}
