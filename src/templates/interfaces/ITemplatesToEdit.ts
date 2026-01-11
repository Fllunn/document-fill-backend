export interface ITemplateToEdit {
  name?: string;
  filePath?: string;
  variables?: string[];
  storageType?: 'system' | 'user';
  userId?: string | null;
  mimeType?: string;
}
