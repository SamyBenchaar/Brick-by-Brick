import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerBoardComponent } from './player-board.component';

describe('PlayerBoardComponent', () => {
  let component: PlayerBoardComponent;
  let fixture: ComponentFixture<PlayerBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerBoardComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerBoardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
