import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { EditionPageComponent } from './edition-page.component';

describe('EditionPageComponent', () => {
  let component: EditionPageComponent;
  let fixture: ComponentFixture<EditionPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditionPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ size: 'small' }),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditionPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
