import {
  AbstractWraplet,
  Constructable,
  Core,
  DefaultCore,
  WrapletChildrenMap,
} from "wraplet";
import { ExhibitionPreview } from "./ExhibitionPreview";
import {
  ExhibitionMonacoEditor,
  MonacoEditorOptions,
} from "./ExhibitionMonacoEditor";
import { exhibitionDefaultAttribute } from "./selectors";
import { DocumentAltererProviderWraplet } from "./types/DocumentAltererProviderWraplet";
import { ElementStorage, Storage } from "wraplet/storage";
import { DocumentAlterer } from "./types/DocumentAlterer";

export type ExhibitionOptions = {
  updatePreviewOnInit?: boolean;
  updaterSelector?: string;
};

export type ExhibitionMapOptions = {
  Class: Constructable<DocumentAltererProviderWraplet>;
  initEditors?: boolean;
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
  private options: Storage<Required<ExhibitionOptions>>;
  constructor(
    core: Core<HTMLElement, typeof ExhibitionMap>,
    options: ExhibitionOptions = {},
  ) {
    super(core);
    const defaultOptions: Required<ExhibitionOptions> = {
      updatePreviewOnInit: true,
      updaterSelector: "[data-js-exhibition-updater]",
    };
    this.options = new ElementStorage<Required<ExhibitionOptions>>(
      this.node,
      exhibitionDefaultAttribute,
      { ...defaultOptions, ...options },
      {
        updatePreviewOnInit: (data: unknown) => typeof data === "boolean",
        updaterSelector: (data: unknown) => typeof data === "string",
      },
    );
    for (const editor of this.children.editors) {
      this.children.preview.addDocumentAlterer(
        editor.getDocumentAlterer(),
        editor.getPriority(),
      );
    }

    const updaterElements = this.node.querySelectorAll(
      this.options.get("updaterSelector"),
    );

    for (const element of updaterElements) {
      this.core.addEventListener(element, "click", () => {
        this.updatePreview();
      });
    }

    if (this.options.get("updatePreviewOnInit")) {
      this.updatePreview();
    }
  }

  /**
   * Adds DocumentAltererProviderWraplet instance to the list of editors.
   */
  public addEditor(editor: DocumentAltererProviderWraplet): void {
    this.children.editors.add(editor);
    this.addPreviewAlterer(editor.getDocumentAlterer(), editor.getPriority());
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
   * @param map Map of dependencies for each Exhibition instance..
   * @param options Options for Exhibition instances.
   *
   * @returns Array of Exhibition instances.
   */
  public static createMultiple(
    node: ParentNode,
    attribute: string = exhibitionDefaultAttribute,
    map: typeof ExhibitionMap,
    options: ExhibitionOptions = {},
  ): Exhibition[] {
    return this.createWraplets(node, map, attribute, [options]);
  }

  /**
   * Create a single Exhibition instance wrapping a given element.
   *
   * @param element Element to wrap.
   * @param map Map of dependencies for the Exhibition instance.
   * @param options Options for the Exhibition instance.
   */
  public static create(
    element: HTMLElement,
    map: typeof ExhibitionMap,
    options: ExhibitionOptions = {},
  ): Exhibition {
    const core = new DefaultCore(element, map);
    return new Exhibition(core, options);
  }

  /**
   * Returns a dependency map with editors being instances of ExhibitionMonacoEditor.
   *
   * @param editorOptions
   *   MonacoEditorOptions to pass to the editor.
   * @param options
   *   Map options.
   */
  public static getMapWithMonacoEditor(
    editorOptions: Partial<MonacoEditorOptions>,
    options: Omit<ExhibitionMapOptions, "Class"> = {},
  ): typeof ExhibitionMap {
    const opts: ExhibitionMapOptions = {
      ...options,
      Class: ExhibitionMonacoEditor,
    };
    const map = this.getMap(opts);

    map["editors"]["args"] = [editorOptions];

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
        initEditors: true,
      },
      ...options,
    };

    map["editors"]["Class"] = allOptions.Class;

    if (!allOptions.initEditors) {
      map["editors"]["selector"] = undefined;
    }

    return map;
  }
}
