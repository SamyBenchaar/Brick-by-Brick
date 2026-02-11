export type DialogType = 'success' | 'error' | 'info' | 'warning';

export interface AppDialogData {
  title: string;
  message: string;
  type: DialogType;
}
