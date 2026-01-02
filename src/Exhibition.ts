import {
  AbstractWraplet,
  Constructable,
  Core,
  createDefaultInitializeWrapper,
  DefaultCore,
  RichWrapletApi,
  Status,
  WrapletApiFactoryArgs,
  WrapletChildrenMap,
} from "wraplet";
import { ExhibitionPreview } from "./ExhibitionPreview";
import {
  ExhibitionMonacoEditor,
  ExhibitionMonacoEditorOptions,
} from "./ExhibitionMonacoEditor";
import { exhibitionDefaultAttribute } from "./selectors";
import { DocumentAltererProviderWraplet } from "./types/DocumentAltererProviderWraplet";
import {
  ElementAttributeStorage,
  KeyValueStorage,
  StorageWrapper,
} from "wraplet/storage";
import { DocumentAlterer } from "./types/DocumentAlterer";

export type ExhibitionOptions = {
  /**
   * Selector for the element that triggers the update of the preview.
   */
  updaterSelector?: string;
};

export type ExhibitionCreateOptions = {
  init?: boolean;
  updatePreview?: boolean;
};

export type ExhibitionMapOptions = {
  Class?: Constructable<DocumentAltererProviderWraplet>;
  selectEditors?: boolean;
};

const ExhibitionMap = {
  editors: {
    selector: "[data-js-exhibition-editor]" as string | undefined,
    multiple: true,
    required: false,
    Class:
      ExhibitionMonacoEditor as Constructable<DocumentAltererProviderWraplet>,
    args: [] as unknown[],
  },
  preview: {
    selector: "iframe[data-js-exhibition-preview]",
    multiple: false,
    required: true,
    Class: ExhibitionPreview,
  },
} satisfies WrapletChildrenMap;

export class Exhibition extends AbstractWraplet<
  HTMLElement,
  typeof ExhibitionMap
> {
  private status: Status = {
    isInitialized: false,
    isDestroyed: false,
    isGettingInitialized: false,
    isGettingDestroyed: false,
  };

  private options: KeyValueStorage<Required<ExhibitionOptions>>;
  constructor(
    core: Core<HTMLElement, typeof ExhibitionMap>,
    options: ExhibitionOptions = {},
    optionsStorage?: KeyValueStorage<Partial<ExhibitionOptions>>,
  ) {
    super(core);
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

    const originalInitialize = this.initialize.bind(this);

    // We are wrapping the our initializer logic into a wraplet-compatible wrapper, ensuring
    // that it will be fit to use in wraplet API.
    this.initialize = createDefaultInitializeWrapper(
      this.status,
      this.core,
      this.wraplet.destroy,
      originalInitialize,
    ).bind(this);
  }

  protected createWrapletApi(
    args: WrapletApiFactoryArgs<HTMLElement, typeof ExhibitionMap>,
  ): RichWrapletApi<HTMLElement> {
    // We will use our own status.
    // This will be passed to the default destroy wrapper, making it use it.
    args.status = this.status;
    const api = super.createWrapletApi(args);
    api.initialize = this.initialize;

    return api;
  }

  public async initialize() {
    if (this.status.isInitialized) {
      throw new Error("Exhibition is already initialized");
    }

    for (const editor of this.children.editors) {
      this.addPreviewAlterer(editor.getDocumentAlterer(), editor.getPriority());
      if (
        editor.wraplet.status.isInitialized ||
        editor.wraplet.status.isGettingInitialized
      ) {
        continue;
      }

      await editor.wraplet.initialize();
    }

    const updaterElements = this.node.querySelectorAll(
      await this.options.get("updaterSelector"),
    );

    for (const element of updaterElements) {
      this.core.addEventListener(element, "click", () => {
        this.updatePreview();
      });
    }
  }

  /**
   * Adds DocumentAltererProviderWraplet instance to the list of editors.
   */
  public addEditor(editor: DocumentAltererProviderWraplet): void {
    this.children.editors.add(editor);
  }

  /**
   * Adds a simple DocumentAlterer to the preview.
   */
  public addPreviewAlterer(
    alterer: DocumentAlterer,
    priority: number = 0,
  ): void {
    this.children.preview.addDocumentAlterer(alterer, priority);
  }

  public getPreview(): ExhibitionPreview {
    return this.children.preview;
  }

  public async updatePreview(): Promise<void> {
    await this.children.preview.update();
  }

  /**
   * Create multiple Exhibitions.
   *
   * @param node Node to create Exhibitions on.
   * @param attribute Attribute to use for Exhibition instances.
   * @param map Map of dependencies for each Exhibition instance.
   * @param options Options for Exhibition instances.
   * @param createOptions Options related to the creation process of the Exhibitions.
   *
   * @returns Array of Exhibition instances.
   */
  public static async createMultiple(
    node: ParentNode,
    attribute: string = exhibitionDefaultAttribute,
    map: typeof ExhibitionMap,
    options: ExhibitionOptions = {},
    createOptions: ExhibitionCreateOptions = {},
  ): Promise<Exhibition[]> {
    createOptions = this.fillCreateOptionsWithDefaults(createOptions);
    this.validateCreateOptions(createOptions);

    const exhibitions = this.createWraplets<HTMLElement, Exhibition>(
      node,
      map,
      attribute,
      [options],
    );

    for (const exhibition of exhibitions) {
      await this.applyCreateOptions(exhibition, createOptions);
    }

    return exhibitions;
  }

  /**
   * Create a single Exhibition instance wrapping a given element.
   *
   * @param element Element to wrap.
   * @param map Map of dependencies for the Exhibition instance.
   * @param options Options for the Exhibition instance.
   * @param createOptions Options related to the creation process of the Exhibitions.
   */
  public static async create(
    element: HTMLElement,
    map: typeof ExhibitionMap,
    options: ExhibitionOptions = {},
    createOptions: ExhibitionCreateOptions = {},
  ): Promise<Exhibition> {
    createOptions = this.fillCreateOptionsWithDefaults(createOptions);
    this.validateCreateOptions(createOptions);
    const core = new DefaultCore(element, map);
    const exhibition = new Exhibition(core, options);
    await this.applyCreateOptions(exhibition, createOptions);
    return exhibition;
  }

  private static fillCreateOptionsWithDefaults(
    createOptions: ExhibitionCreateOptions,
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
  private static validateCreateOptions(createOptions: ExhibitionCreateOptions) {
    if (!createOptions.init && createOptions.updatePreview) {
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
    options: ExhibitionCreateOptions = {},
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
   * Returns a dependency map with editors being instances of ExhibitionMonacoEditor.
   *
   * @param exhibitionMonacoEditorOptions
   *   MonacoEditorOptions to pass to the ExhibitionMonacoEditor.
   * @param options
   *   Map options.
   */
  public static getMapWithMonacoEditor(
    exhibitionMonacoEditorOptions: ExhibitionMonacoEditorOptions,
    options: Omit<ExhibitionMapOptions, "Class"> = {},
  ): typeof ExhibitionMap {
    const opts: ExhibitionMapOptions = {
      ...options,
      Class: ExhibitionMonacoEditor,
    };
    const map = this.getMap(opts);

    map["editors"]["args"] = [exhibitionMonacoEditorOptions];

    return map;
  }

  /**
   * Returns a generic dependecy map with an undefined editor class that has to be provided through
   * the options.
   *
   * @param options
   *   Map options.
   */
  public static getMap(options: ExhibitionMapOptions): typeof ExhibitionMap {
    const map: typeof ExhibitionMap = ExhibitionMap;
    const allOptions: Required<ExhibitionMapOptions> = {
      ...{
        selectEditors: true,
        Class: ExhibitionMonacoEditor,
      },
      ...options,
    };

    map["editors"]["Class"] = allOptions.Class;

    if (!allOptions.selectEditors) {
      map["editors"]["selector"] = undefined;
    }

    return map;
  }
}
