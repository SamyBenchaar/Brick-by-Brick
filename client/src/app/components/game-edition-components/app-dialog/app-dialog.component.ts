import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DialogIcon } from '@app/constants/dialog-icon.enum';
import { DialogType } from '@app/constants/dialog-type.enum';
import { AppDialogData } from '@app/interfaces/dialog-model';

const DIALOG_ICONS: Record<DialogType, DialogIcon> = {
  [DialogType.SUCCESS]: DialogIcon.Success,
  [DialogType.ERROR]: DialogIcon.Error,
  [DialogType.INFO]: DialogIcon.Info,
  [DialogType.WARNING]: DialogIcon.Warning,
};

@Component({
  selector: 'app-dialog',
  imports: [NgClass, MatDialogModule, MatButtonModule],
  templateUrl: './app-dialog.component.html',
  styleUrl: './app-dialog.component.scss',
})
export class AppDialogComponent {
  private dialogRef = inject(MatDialogRef<AppDialogComponent>);
  readonly data = inject<AppDialogData>(MAT_DIALOG_DATA);

  get isArray(): boolean {
    return Array.isArray(this.data.message);
  }

  getIcon(): string {
    return DIALOG_ICONS[this.data.type] ?? '';
  }

  close(): void {
    this.dialogRef.close();
  }
}
