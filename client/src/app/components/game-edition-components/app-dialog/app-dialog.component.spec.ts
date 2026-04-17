import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DialogType } from '@app/constants/dialog-type.enum';
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
    type: DialogType.SUCCESS,
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

  it('doit créer', () => {
    expect(component).toBeTruthy();
  });

  it('doit retourner l\'icône correcte pour le type success', () => {
    component.data.type = DialogType.SUCCESS;
    expect(component.getIcon()).toBe('✓');
  });

  it('doit retourner l\'icône correcte pour le type error', () => {
    component.data.type = DialogType.ERROR;
    expect(component.getIcon()).toBe('✕');
  });

  it('doit retourner l\'icône correcte pour le type info', () => {
    component.data.type = DialogType.INFO;
    expect(component.getIcon()).toBe('ℹ');
  });
  it('doit retourner une chaîne vide pour un type inconnu', () => {
    component.data.type = 'unknown' as unknown as typeof component.data.type;
    expect(component.getIcon()).toBe('');
  });
});
