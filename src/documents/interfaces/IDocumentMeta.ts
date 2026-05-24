export interface IDocumentMeta {
  templateBase64: string;
  values: Record<string, any>;
  name: string;
  rawValues?: Record<string, any>;
}
