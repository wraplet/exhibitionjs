import { AbstractWraplet, Constructable, Core } from "wraplet";
import { DocumentAlterer } from "./types/DocumentAlterer";
import {
  ElementAttributeStorage,
  KeyValueStorage,
  StorageValidators,
  StorageWrapper,
} from "wraplet/storage";
import { PreviewWraplet } from "./types/PreviewWraplet";

type AltererData = {
  callback: DocumentAlterer;
  priority: number;
};

export type ExhibitionPreviewOptions = {
  updateHeight?: boolean;
  updateHeightCallback?: (preview: ExhibitionPreview) => Promise<void>;
};

export class ExhibitionPreview
  extends AbstractWraplet<HTMLIFrameElement>
  implements PreviewWraplet
{
  private alterers: AltererData[] = [];
  private currentBlobUrl: string | null = null;

  private options: KeyValueStorage<Required<ExhibitionPreviewOptions>>;

  constructor(
    core: Core<HTMLIFrameElement>,
    options: ExhibitionPreviewOptions = {},
    optionsStorage?: KeyValueStorage<Partial<ExhibitionPreviewOptions>>,
  ) {
    super(core);

    const validators: StorageValidators<ExhibitionPreviewOptions> = {
      updateHeight: (data: unknown) => typeof data === "boolean",
      updateHeightCallback: (data: unknown) => typeof data === "function",
    };

    const defaultOptions: Required<ExhibitionPreviewOptions> = {
      updateHeight: true,
      updateHeightCallback: async (preview) => {
        setTimeout(() => {
          preview.updateHeight();
        }, 100);
      },
    };

    const optsStorage: KeyValueStorage<Partial<ExhibitionPreviewOptions>> =
      optionsStorage ||
      new ElementAttributeStorage<Partial<ExhibitionPreviewOptions>, true>(
        true,
        core.node,
        "data-js-options",
        {},
        {},
      );

    this.options = new StorageWrapper<Required<ExhibitionPreviewOptions>>(
      optsStorage,
      { ...defaultOptions, ...options },
      validators,
    );
  }

  protected supportedNodeTypes(): readonly Constructable<HTMLIFrameElement>[] {
    return super.supportedNodeTypesGuard([HTMLIFrameElement]);
  }

  /**
   * Adds a DocumentAlterer to the preview.
   * @param alterer
   * @param priority
   *   Priority of the alterer. Higher priority alterers are executed first.
   */
  public addDocumentAlterer(
    alterer: DocumentAlterer,
    priority: number = 0,
  ): void {
    if (this.hasDocumentAlterer(alterer)) {
      return;
    }

    this.alterers.push({
      callback: alterer,
      priority: priority,
    });
  }

  /**
   * Checks if alterer is already registered.
   * @param alterer
   */
  public hasDocumentAlterer(alterer: DocumentAlterer): boolean {
    return this.alterers.some(
      (altererData) => altererData.callback === alterer,
    );
  }

  public removeDocumentAlterer(alterer: DocumentAlterer): void {
    this.alterers = this.alterers.filter(
      (altererData) => altererData.callback !== alterer,
    );
  }

  public async update(): Promise<void> {
    const doc = document.implementation.createHTMLDocument();
    this.alterers.sort((a, b) => b.priority - a.priority);
    for (const alterer of this.alterers) {
      await alterer.callback(doc);
    }

    // Revoke previous blob URL
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
    }

    const htmlContent = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    this.currentBlobUrl = URL.createObjectURL(blob);
    this.node.src = this.currentBlobUrl;

    this.node.onload = async () => {
      if (!(await this.options.get("updateHeight"))) {
        await (
          await this.options.get("updateHeightCallback")
        )(this);
      }
      this.node.onload = null;
    };
  }

  /**
   * Updates preview's height to match its content.
   */
  public updateHeight(): void {
    const iframeWindow = this.getIFrameWindow();
    const iframeDocument = this.getIFrameDocument();
    const el = iframeDocument.querySelector("html");
    if (!el) {
      return;
    }

    const styles = iframeWindow.getComputedStyle(el);
    const margin =
      parseFloat(styles["marginTop"]) + parseFloat(styles["marginBottom"]);

    const height = Math.ceil(el.offsetHeight + margin);
    this.node.height = height + "px";
  }

  private getIFrameDocument(): Document {
    const iframeDocument = this.node.contentDocument;
    if (!iframeDocument) {
      throw new Error("IFrame document is not available.");
    }

    return iframeDocument;
  }

  private getIFrameWindow(): Window {
    const window = this.node.contentWindow;
    if (!window) {
      throw new Error("IFrame window is not available.");
    }
    return window;
  }
}
