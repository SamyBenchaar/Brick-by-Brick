export type DialogType = 'success' | 'error' | 'info';

export interface AppDialogData {
  title: string;
  message: string;
  type: DialogType;
}
