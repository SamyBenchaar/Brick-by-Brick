import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CombatViewComponent } from './combat-view.component';

describe('CombatViewComponent', () => {
  let component: CombatViewComponent;
  let fixture: ComponentFixture<CombatViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatViewComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CombatViewComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
