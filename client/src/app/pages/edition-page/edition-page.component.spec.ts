import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => '123',
              },
            },
            queryParams: of({ id: '123' }),
            params: of({ id: '123' }),
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
