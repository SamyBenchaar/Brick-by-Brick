import { TestBed } from '@angular/core/testing';

import { MapEditorServiceService } from './map-editor-service.service';

describe('MapEditorServiceService', () => {
  let service: MapEditorServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapEditorServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
