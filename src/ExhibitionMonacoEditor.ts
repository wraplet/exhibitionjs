import {
  AbstractWraplet,
  Core,
  DefaultCore,
  RichWrapletApi,
  WrapletApiFactoryArgs,
} from "wraplet";
import {
  ElementAttributeStorage,
  KeyValueStorage,
  StorageValidators,
  StorageWrapper,
} from "wraplet/storage";

import type * as monaco from "monaco-editor";
import { DocumentAltererProviderWraplet } from "./types/DocumentAltererProviderWraplet";
import {
  getTagFromType,
  getTypeFromLanguage,
  isSingleTagType,
  MonacoEditorLanguages,
} from "./TypeMap";
import { DocumentAlterer } from "./types/DocumentAlterer";

export type EditorCreator = (
  options: monaco.editor.IStandaloneEditorConstructionOptions,
  node: HTMLElement,
  monaco: MonacoInstance,
) => Promise<monaco.editor.IStandaloneCodeEditor>;

export type ExhibitionMonacoEditorOptions = {
  /**
   * Monaco instance.
   */
  monaco: MonacoInstance;
  /**
   * Instead of depending on this class for editor instantiation, you can provide your own editor instance here.
   */
  monacoEditorCreator?: EditorCreator;

  /**
   * Monaco options for the editor.
   */
  monacoEditorOptions?: monaco.editor.IStandaloneEditorConstructionOptions;

  /**
   * Location where the editor should be inserted.
   */
  location?: "head" | "body";

  /**
   * Priority of the editor's document alterer. Higher priority means it will be executed first.
   */
  priority?: number;

  /**
   * Trim the default value of the editor.
   */
  trimDefaultValue?: boolean;

  /**
   * This option applies to single tag languages only (typescript, javascript and css). It
   * determines the attributes that will be added to the generated tag.
   */
  tagAttributes?: Record<string, string>;
};

type RequiredMonacoEditorOptions = Required<
  Omit<ExhibitionMonacoEditorOptions, "tagAttributes" | "monacoEditorCreator">
> & {
  tagAttributes?: ExhibitionMonacoEditorOptions["tagAttributes"];
  monacoEditorCreator?: EditorCreator;
};

export type MonacoInstance = typeof monaco;

export class ExhibitionMonacoEditor
  extends AbstractWraplet<HTMLElement>
  implements DocumentAltererProviderWraplet
{
  private monaco: MonacoInstance | null = null;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private options: KeyValueStorage<RequiredMonacoEditorOptions>;

  private priority: number = 0;
  private monacoEditorOptions:
    | RequiredMonacoEditorOptions["monacoEditorOptions"]
    | null = null;

  constructor(
    core: Core<HTMLElement>,
    options: ExhibitionMonacoEditorOptions,
    optionsStorage?: KeyValueStorage<Partial<ExhibitionMonacoEditorOptions>>,
  ) {
    super(core);

    const defaultOptions: Omit<
      RequiredMonacoEditorOptions,
      "monacoEditorCreator" | "monaco"
    > = {
      location: "body",
      priority: 0,
      trimDefaultValue: true,
      monacoEditorOptions: {},
    };

    const validators: StorageValidators<ExhibitionMonacoEditorOptions> = {
      // We generally don't validate monacoOptions, leaving it to the monaco editor.
      location: (data: unknown) =>
        typeof data === "string" && ["head", "body"].includes(data),
      priority: (data: unknown) => Number.isInteger(data),
      tagAttributes: (data: unknown) => typeof data === "object",
      trimDefaultValue: (data: unknown) => typeof data === "boolean",
      monacoEditorCreator: (data: unknown) => typeof data === "function",
      monaco: (data: unknown) => typeof data === "object",
      monacoEditorOptions: () => true,
    };

    options.monacoEditorOptions = {
      ...defaultOptions.monacoEditorOptions,
      ...options.monacoEditorOptions,
    };

    const optsStorage: KeyValueStorage<Partial<ExhibitionMonacoEditorOptions>> =
      optionsStorage ||
      new ElementAttributeStorage<Partial<ExhibitionMonacoEditorOptions>, true>(
        true,
        core.node,
        "data-js-options",
        {},
        {},
        {
          elementOptionsMerger: (defaults, options) => {
            options.monacoEditorOptions = {
              ...defaults.monacoEditorOptions,
              ...options.monacoEditorOptions,
            };
            return { ...defaults, ...options };
          },
        },
      );

    this.options = new StorageWrapper<RequiredMonacoEditorOptions>(
      optsStorage,
      { ...defaultOptions, ...options },
      validators,
    );
  }

  protected createWrapletApi(
    args: WrapletApiFactoryArgs<HTMLElement, {}>,
  ): RichWrapletApi<HTMLElement> {
    args.initializeCallback = this.initialize.bind(this);
    args.destroyCallback = async () => {
      this.destroy();
    };
    return super.createWrapletApi(args);
  }

  public async initialize() {
    if (this.wraplet.status.isInitialized) {
      throw new Error("ExhibitionMonacoEditor is already initialized");
    }
    this.priority = await this.options.get("priority");
    this.monacoEditorOptions = await this.options.get("monacoEditorOptions");

    if (await this.options.get("trimDefaultValue")) {
      const monacoOptions = await this.options.get("monacoEditorOptions");
      if (monacoOptions.value) {
        monacoOptions.value = ExhibitionMonacoEditor.trimDefaultValue(
          monacoOptions.value,
        );
        await this.options.set("monacoEditorOptions", monacoOptions);
      }
    }

    await this.validateOptions();

    this.monaco = await this.options.get("monaco");

    const editorCreator: EditorCreator =
      (await this.options.get("monacoEditorCreator")) ||
      (async (options, element, monaco) =>
        ExhibitionMonacoEditor.createMonacoEditor(options, element, monaco));

    this.editor = await editorCreator(
      await this.options.get("monacoEditorOptions"),
      this.node,
      this.monaco,
    );
  }

  public getPriority(): number {
    return this.priority;
  }

  /**
   * Returns the current value of the editor.
   */
  private getValue(): string {
    return this.getEditor().getValue();
  }

  private async alterDocument(document: Document): Promise<void> {
    const monaco = this.monaco;
    if (!monaco) {
      throw new Error(
        "Monaco instance is not available. Is wraplet initialized?",
      );
    }

    const language = this.getLanguage();
    const content =
      language === "typescript"
        ? await this.getTSValueAsJS(monaco)
        : this.getValue();

    const location = await this.options.get("location");
    const type = getTypeFromLanguage(language);

    if (isSingleTagType(type)) {
      const tag = getTagFromType(type);
      const tagAttributes = (await this.options.get("tagAttributes")) ?? {};
      const tagElement = document.createElement(tag);
      for (const [key, value] of Object.entries(tagAttributes)) {
        tagElement.setAttribute(key, value);
      }
      tagElement.innerHTML = content;
      document[location].appendChild(tagElement);
      return;
    }
    document[location].innerHTML += content;
  }

  public getDocumentAlterer(): DocumentAlterer {
    return this.alterDocument.bind(this);
  }

  /**
   * Additional validation.
   */
  private async validateOptions() {
    if (!(await this.options.get("monacoEditorOptions")).language) {
      throw new Error("Missing language in monacoOptions");
    }

    const type = getTypeFromLanguage(this.getLanguage());
    if (!isSingleTagType(type)) {
      if (await this.options.get("tagAttributes")) {
        throw new Error(
          "'tagAttributes' option is only allowed for single tag types",
        );
      }
    }
  }

  private getEditor(): monaco.editor.IStandaloneCodeEditor {
    if (!this.editor) throw new Error("Editor is not initialized");
    return this.editor;
  }

  private async getTSValueAsJS(monaco: MonacoInstance) {
    const model = this.getEditor().getModel();
    if (!model) throw new Error("Model is not available");

    // Make sure TypeScript eager sync is enabled
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

    // Ensure we're using file:/// URI
    const uri = model.uri;
    if (uri.scheme !== "file") {
      throw new Error(`Model must use file:// URI, got: ${uri.toString()}`);
    }

    // Get worker getter
    const getWorker = async (
      attempts: number = 10,
    ): Promise<
      | ((
          ...uris: monaco.Uri[]
        ) => Promise<monaco.languages.typescript.TypeScriptWorker>)
      | null
    > => {
      try {
        return await monaco.languages.typescript.getTypeScriptWorker();
      } catch (error) {
        if (error !== "TypeScript not registered!") throw error;
        if (attempts <= 0) return null;
        await new Promise((r) => setTimeout(r, 200));
        return getWorker(attempts - 1);
      }
    };

    const workerGetter = await getWorker();
    if (!workerGetter)
      throw new Error("Timeout: Could not get TypeScript worker");

    const worker = await workerGetter(uri);

    // 🔸 Wait until the worker actually knows this file
    // Call something lightweight to force registration
    for (let i = 0; i < 20; i++) {
      try {
        await worker.getSemanticDiagnostics(uri.toString());
        break; // success — worker now recognizes the file
      } catch (err) {
        if (/Could not find source file/.test(String(err))) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        throw err;
      }
    }

    // Now it's safe to call getEmitOutput
    const { outputFiles } = await worker.getEmitOutput(uri.toString());
    if (!outputFiles.length) throw new Error("No JS output produced");
    return outputFiles[0].text;
  }

  private getLanguage(): MonacoEditorLanguages {
    const monacoOptions = this.monacoEditorOptions;
    if (!monacoOptions) {
      throw new Error(
        "Monaco options are not available. Is wraplet initialized?",
      );
    }

    if (!monacoOptions["language"]) {
      throw new Error("Missing language in monacoOptions");
    }

    return monacoOptions["language"] as MonacoEditorLanguages;
  }

  public static trimDefaultValue(content: string): string {
    const lines = content.split("\n");

    // Find the first non-empty line to determine base indentation
    const firstNonEmptyLine = lines.find((line) => line.trim().length > 0);

    if (!firstNonEmptyLine) {
      return content.trim();
    }

    // Count leading spaces on the first non-empty line
    const leadingSpaces = firstNonEmptyLine.search(/\S|$/);

    // Trim the same number of spaces from each line
    const trimmedLines = lines.map((line) => {
      // Only trim if the line has at least that many leading spaces
      if (
        line.length >= leadingSpaces &&
        line.substring(0, leadingSpaces).trim() === ""
      ) {
        return line.substring(leadingSpaces);
      }
      return line;
    });

    // Join back and trim any leading/trailing empty lines
    return trimmedLines.join("\n").trim();
  }

  public destroy() {
    this.editor?.dispose();
  }

  /**
   * Helper method creating a new monaco editor instance.
   */
  public static createMonacoEditor(
    editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {},
    node: HTMLElement,
    monaco: MonacoInstance,
  ): monaco.editor.IStandaloneCodeEditor {
    const language = editorOptions.language;
    if (!language) {
      throw new Error("Missing language in editorOptions");
    }

    const model = this.createMonacoModel(
      monaco,
      language,
      editorOptions.value || "",
    );

    return monaco.editor.create(node, {
      ...editorOptions,
      ...{ model: model },
    });
  }

  /**
   * Helper method creating a new monaco model instance.
   */
  public static createMonacoModel(
    monaco: MonacoInstance,
    language: string,
    value: string,
  ): monaco.editor.ITextModel {
    // Generate a unique URI for each model instance
    const uniqueId = Math.random().toString(36).substring(2, 15);
    return monaco.editor.createModel(
      value,
      language,
      monaco.Uri.parse(`file:///${language}-${uniqueId}.ts`),
    );
  }

  /**
   * Create a single ExhibitionMonacoEditor instance wrapping a given element.
   */
  public static create(
    element: HTMLElement,
    options: ExhibitionMonacoEditorOptions,
  ): ExhibitionMonacoEditor {
    const core = new DefaultCore(element, {});
    return new ExhibitionMonacoEditor(core, options);
  }
}
