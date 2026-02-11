import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextInputComponent } from './text-input.component';

describe('TextInputComponent', () => {
  let component: TextInputComponent;
  let fixture: ComponentFixture<TextInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextInputComponent],
    })
      .compileComponents();

    fixture = TestBed.createComponent(TextInputComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('doit créer', () => {
    expect(component).toBeTruthy();
  });
  
  it('doit émettre la valeur lors du changement de saisie', () => {
    spyOn(component.valueChange, 'emit');
    const inputElement = fixture.nativeElement.querySelector('input');
    inputElement.value = 'Test';
    inputElement.dispatchEvent(new Event('input'));
    expect(component.valueChange.emit).toHaveBeenCalledWith('Test');
  });
});
