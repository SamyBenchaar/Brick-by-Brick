import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerSignComponent } from './player-sign/player-sign.component';

describe('PlayerSignComponent', () => {
    let component: PlayerSignComponent;
    let fixture: ComponentFixture<PlayerSignComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PlayerSignComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PlayerSignComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
