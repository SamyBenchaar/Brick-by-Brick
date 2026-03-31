import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tile } from '@app/classes/tile/tile';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { TileType } from '@common/map';
import { GameGridComponent } from './game-grid.component';

describe('GameGridComponent', () => {
  let component: GameGridComponent;
  let fixture: ComponentFixture<GameGridComponent>;

  let mapEditorServiceSpy: jasmine.SpyObj<MapEditorService>;
  let objectCounterServiceSpy: jasmine.SpyObj<ObjectCounterService>;

  beforeEach(async () => {
    mapEditorServiceSpy = jasmine.createSpyObj('MapEditorService', ['getSelectedTileType', 'getSelectedObject', 'setTileType', 'setObject']);
    objectCounterServiceSpy = jasmine.createSpyObj('ObjectCounterService', ['canPlace', 'place', 'remove', 'reset']);

    await TestBed.configureTestingModule({
      imports: [GameGridComponent],
      providers: [
        { provide: MapEditorService, useValue: mapEditorServiceSpy },
        { provide: ObjectCounterService, useValue: objectCounterServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameGridComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('doit créer', () => {
    expect(component).toBeTruthy();
  });

  it('doit appeler reset sur objectCounterService lorsque resetGrid est appelé', () => {
    component.resetGrid();
    expect(objectCounterServiceSpy.reset).toHaveBeenCalled();
  });

  it('doit appeler setTileType sur mapEditorService lorsque applyDeletion est appelé', () => {
    const tile = { type: TileType.Base };
    spyOn(component, 'getTile').and.returnValue(tile as Tile);
    component['isShiftPressed'] = false;
    component.applyDeletion({ x: 0, y: 0 });
    expect(mapEditorServiceSpy.setTileType).toHaveBeenCalledWith({ x: 0, y: 0 }, TileType.Base);
  });
});
