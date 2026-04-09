import { AbstractWraplet } from "wraplet";

export class ExhibitionUpdater extends AbstractWraplet<HTMLElement> {
  public addClickListener(callback: () => void): void {
    this.nodeManager.addListener("click", callback);
  }
}
