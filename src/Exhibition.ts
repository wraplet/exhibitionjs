import {
  AbstractWraplet,
  Constructable,
  Core,
  createDefaultInitializeCallback,
  customizeDefaultWrapletApi,
  DefaultCore,
  Status,
  WrapletChildrenMap,
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

export type PreviewOptionsWrapper<
  O,
  IS_REQUIRED extends boolean = false,
> = IS_REQUIRED extends true
  ? {
      previewOptions: O;
    }
  : { previewOptions?: O };

export type EditorsOptionsWrapper<
  O,
  IS_REQUIRED extends boolean = false,
> = IS_REQUIRED extends true
  ? {
      editorsOptions: O;
    }
  : { editorsOptions?: O };

export type ExhibitionMapOptions<
  EO extends EditorsOptionsWrapper<unknown, boolean> | undefined =
    EditorsOptionsWrapper<ExhibitionMonacoEditorOptions, true>,
  PO extends PreviewOptionsWrapper<unknown, boolean> | undefined =
    PreviewOptionsWrapper<ExhibitionPreviewOptions>,
> = {
  Class?: Constructable<DocumentAltererProviderWraplet>;
  selectEditors?: boolean;
} & (EO extends undefined
  ? EditorsOptionsWrapper<ExhibitionMonacoEditorOptions, true>
  : EO) &
  (PO extends undefined ? PreviewOptionsWrapper<ExhibitionPreviewOptions> : PO);

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
    Class: ExhibitionPreview as Constructable<PreviewWraplet>,
    args: [] as unknown[],
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
        destroyCallback: this.wraplet.destroy,
      },
      async () => {
        if (this.status.isInitialized) {
          throw new Error("Exhibition is already initialized");
        }

        for (const editor of this.children.editors) {
          if (
            !editor.wraplet.status.isInitialized &&
            !editor.wraplet.status.isGettingInitialized
          ) {
            await editor.wraplet.initialize();
          }

          if (
            !this.children.preview.hasDocumentAlterer(
              editor.getDocumentAlterer(),
            )
          ) {
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
    this.children.editors.add(editor);
    this.children.preview.addDocumentAlterer(editor.getDocumentAlterer());
  }

  /**
   * Removes DocumentAltererProviderWraplet instance from the list of editors.
   */
  public removeEditor(editor: DocumentAltererProviderWraplet): void {
    this.children.editors.delete(editor);
    this.children.preview.removeDocumentAlterer(editor.getDocumentAlterer());
  }

  /**
   * Checks if the given editor is present in the list of editors.
   */
  public hasEditor(editor: DocumentAltererProviderWraplet): boolean {
    return this.children.editors.has(editor);
  }

  /**
   * Adds a simple DocumentAlterer to the preview.
   */
  private addPreviewAlterer(
    alterer: DocumentAlterer,
    priority: number = 0,
  ): void {
    this.children.preview.addDocumentAlterer(alterer, priority);
  }

  public getPreview(): PreviewWraplet {
    return this.children.preview;
  }

  public async updatePreview(): Promise<void> {
    await this.children.preview.update();
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
    M extends typeof ExhibitionMap = typeof ExhibitionMap,
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
    M extends typeof ExhibitionMap = typeof ExhibitionMap,
  >(
    element: HTMLElement,
    map: M,
    options: ExhibitionOptions = {},
    initOptions: ExhibitionInitOptions = {},
  ): Promise<Exhibition> {
    initOptions = this.fillCreateOptionsWithDefaults(initOptions);
    this.validateInitOptions(initOptions, map);
    const core = new DefaultCore<HTMLElement, typeof ExhibitionMap>(
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
    map: typeof ExhibitionMap,
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
   * Returns a generic dependecy map with an undefined editor class that has to be provided through
   * the options.
   *
   * @param mapOptions
   *   Map options.
   */
  public static getMap<
    O extends ExhibitionMapOptions<
      EditorsOptionsWrapper<unknown, boolean>,
      PreviewOptionsWrapper<unknown, boolean>
    > = ExhibitionMapOptions,
  >(mapOptions?: NoInfer<O>): typeof ExhibitionMap {
    const map: typeof ExhibitionMap = ExhibitionMap;
    const allOptions: Required<
      ExhibitionMapOptions<
        EditorsOptionsWrapper<unknown, boolean>,
        PreviewOptionsWrapper<unknown, boolean>
      >
    > = {
      ...{
        selectEditors: true,
        Class: undefined as any,
        editorsOptions: {},
        previewOptions: {},
      },
      ...mapOptions,
    };

    if (allOptions.Class) {
      map["editors"]["Class"] = allOptions.Class;
    }

    if (
      allOptions.selectEditors &&
      map["editors"]["Class"] instanceof ExhibitionMonacoEditor &&
      (!allOptions.editorsOptions ||
        !(allOptions.editorsOptions as { monaco?: unknown })["monaco"])
    ) {
      throw new Error(
        "When selecting ExhibitionMonacoEditor instances, you must provide the 'monaco' option in the editors options. To avoid this error, disable 'selectEditors' or provide the 'monaco' option.",
      );
    }

    if (!allOptions.selectEditors) {
      map["editors"]["selector"] = undefined;
    }

    if (allOptions.previewOptions) {
      map["preview"]["args"].push(allOptions.previewOptions);
    }

    if (allOptions.editorsOptions) {
      map["editors"]["args"].push(allOptions.editorsOptions);
    }

    return map;
  }
}
