import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { ObjectType, TileType } from '@common/map';
import { Tile } from '@app/classes/tile';
import { GameGridComponent } from './game-grid.component';

describe('GameGridComponent', () => {
  let component: GameGridComponent;
  let fixture: ComponentFixture<GameGridComponent>;

  let mapEditorServiceSpy: jasmine.SpyObj<MapEditorServiceService>;
  let objectCounterServiceSpy: jasmine.SpyObj<ObjectCounterService>;

  beforeEach(async () => {
    mapEditorServiceSpy = jasmine.createSpyObj('MapEditorServiceService', ['getSelectedTileType', 'getSelectedObject', 'setTileType', 'setObject']);
    objectCounterServiceSpy = jasmine.createSpyObj('ObjectCounterService', ['canPlace', 'place', 'remove', 'reset']);

    await TestBed.configureTestingModule({
      imports: [GameGridComponent],
      providers: [
        { provide: MapEditorServiceService, useValue: mapEditorServiceSpy },
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

  it('doit appeler setObject sur mapEditorService et place sur objectCounterService lorsque addObject est appelé', () => {
    const tile = { type: TileType.Base, object: undefined };
    spyOn(component, 'getTile').and.returnValue(tile as Tile);
    mapEditorServiceSpy.getSelectedObject.and.returnValue('TestObject' as ObjectType);
    objectCounterServiceSpy.canPlace.and.returnValue(true);
    spyOn(component, 'isTileObjectFree').and.returnValue(true);
    component['addObject']({ x: 0, y: 0 });
    expect(objectCounterServiceSpy.place).toHaveBeenCalledWith('TestObject' as ObjectType);
    expect(mapEditorServiceSpy.setObject).toHaveBeenCalledWith({ x: 0, y: 0 }, 'TestObject' as ObjectType);
  });

  it('doit appeler remove sur objectCounterService et setObject(null) sur mapEditorService lorsque removeObject est appelé', () => {
    const tile = { object: 'TestObject' as ObjectType };
    spyOn(component, 'getTile').and.returnValue(tile as Tile);
    component['removeObject']({ x: 0, y: 0 });
    expect(objectCounterServiceSpy.remove).toHaveBeenCalledWith('TestObject' as ObjectType);
    expect(mapEditorServiceSpy.setObject).toHaveBeenCalledWith({ x: 0, y: 0 }, null);
  });
});
