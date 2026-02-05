import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppDialogComponent } from './app-dialog.component';

describe('AppDialogComponent', () => {
  let component: AppDialogComponent;
  let fixture: ComponentFixture<AppDialogComponent>;

  const mockDialogRef = {
    close: jasmine.createSpy('close'),
  };

  const mockDialogData = {
    title: 'Test Title',
    message: 'Test Message',
    type: 'success' as const,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, AppDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(AppDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
