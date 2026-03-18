import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppDialogData } from '@app/interfaces/dialog-model';

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
    switch (this.data.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ℹ';
      case 'warning':
        return '⚠';
      default:
        return '';
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
