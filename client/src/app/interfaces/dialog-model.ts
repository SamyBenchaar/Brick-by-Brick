import { DialogType } from '@app/constants/dialog-type.enum';

export interface AppDialogData {
  title: string;
  message: string;
  type: DialogType;
  confirmText?: string;
  cancelText?: string;
  image?: string;
  thirdOptionText?: string;

}
