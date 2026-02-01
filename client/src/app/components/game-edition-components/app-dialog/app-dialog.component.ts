import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppDialogData } from '@app/interfaces/dialog-model';

@Component({
  selector: 'app-dialog',
  imports: [NgClass, NgIf, NgFor, MatDialogModule, MatButtonModule],
  templateUrl: './app-dialog.component.html',
  styleUrl: './app-dialog.component.scss',
})
export class AppDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<AppDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AppDialogData,
  ) {}

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
      default:
        return '';
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
