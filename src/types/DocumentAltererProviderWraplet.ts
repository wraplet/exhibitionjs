import { Wraplet } from "wraplet";
import { DocumentAltererProvider } from "./DocumentAltererProvider";

export interface DocumentAltererProviderWraplet
  extends DocumentAltererProvider,
    Wraplet<HTMLElement> {}
