import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerCombatCardComponent } from './player-combat-card.component';

describe('PlayerCombatCardComponent', () => {
  let component: PlayerCombatCardComponent;
  let fixture: ComponentFixture<PlayerCombatCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerCombatCardComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerCombatCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
