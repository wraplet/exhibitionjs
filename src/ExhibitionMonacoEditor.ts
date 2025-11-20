import { AbstractWraplet, Core, DefaultCore } from "wraplet";
import { Storage, StorageValidators } from "wraplet/storage";

import type * as monaco from "monaco-editor";
import { DocumentAltererProviderWraplet } from "./types/DocumentAltererProviderWraplet";
import { ElementStorage } from "wraplet/storage";
import { defaultOptionsAttribute } from "./selectors";
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
   * Attribute storing the options in the form of JSON string.
   */
  optionsAttribute?: string;

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
  private monaco: MonacoInstance;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private options: Storage<RequiredMonacoEditorOptions>;

  constructor(core: Core<HTMLElement>, options: ExhibitionMonacoEditorOptions) {
    super(core);

    const defaultOptions: Omit<
      RequiredMonacoEditorOptions,
      "monacoEditorCreator" | "monaco"
    > = {
      optionsAttribute: "data-js-options",
      location: "body",
      priority: 0,
      trimDefaultValue: true,
      monacoEditorOptions: {},
    };

    const validators: StorageValidators<ExhibitionMonacoEditorOptions> = {
      optionsAttribute: (data: unknown) => typeof data === "string",
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

    this.options = new ElementStorage<RequiredMonacoEditorOptions>(
      this.node,
      defaultOptionsAttribute,
      { ...defaultOptions, ...options },
      validators,
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

    this.monaco = this.options.get("monaco");

    if (this.options.get("trimDefaultValue")) {
      const monacoOptions = this.options.get("monacoEditorOptions");
      if (monacoOptions.value) {
        monacoOptions.value = ExhibitionMonacoEditor.trimDefaultValue(
          monacoOptions.value,
        );
        this.options.set("monacoEditorOptions", monacoOptions);
      }
    }

    this.validateOptions();
  }

  public isEditorInitialized(): boolean {
    return this.editor !== null;
  }

  public async init() {
    const editorCreator: EditorCreator =
      this.options.get("monacoEditorCreator") ||
      (async (options, element, monaco) =>
        ExhibitionMonacoEditor.createMonacoEditor(options, element, monaco));

    this.editor = await editorCreator(
      this.options.get("monacoEditorOptions"),
      this.node,
      this.monaco,
    );
  }

  public getPriority(): number {
    return this.options.get("priority");
  }

  /**
   * Returns the current value of the editor.
   */
  private getValue(): string {
    return this.getEditor().getValue();
  }

  private async alterDocument(document: Document): Promise<void> {
    const language = this.getLanguage();
    const content =
      language === "typescript" ? await this.getTSValueAsJS() : this.getValue();

    const location = this.options.get("location");
    const type = getTypeFromLanguage(language);

    if (isSingleTagType(type)) {
      const tag = getTagFromType(type);
      const tagAttributes = this.options.get("tagAttributes") ?? {};
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
  private validateOptions() {
    if (!this.options.get("monacoEditorOptions").language) {
      throw new Error("Missing language in monacoOptions");
    }

    const type = getTypeFromLanguage(this.getLanguage());
    if (!isSingleTagType(type)) {
      if (this.options.get("tagAttributes")) {
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

  private async getTSValueAsJS() {
    const model = this.getEditor().getModel();
    if (!model) throw new Error("Model is not available");

    // Make sure TypeScript eager sync is enabled
    this.monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

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
        return await this.monaco.languages.typescript.getTypeScriptWorker();
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
    const monacoOptions = this.options.get("monacoEditorOptions");

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
    super.destroy();
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
