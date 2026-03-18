import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapEditorService } from '@app/services/map-editor.service';
import { TileType } from '@common/map';
import { TileTypeSidebarComponent } from './tile-type-sidebar.component';

describe('TileTypeSidebarComponent', () => {
  let component: TileTypeSidebarComponent;
  let fixture: ComponentFixture<TileTypeSidebarComponent>;

  let mapEditorServiceSpy: jasmine.SpyObj<MapEditorService>;

  beforeEach(async () => {
    mapEditorServiceSpy = jasmine.createSpyObj('MapEditorService', ['selectTileType', 'getSelectedTileType']);

    await TestBed.configureTestingModule({
      imports: [TileTypeSidebarComponent],
      providers: [
        { provide: MapEditorService, useValue: mapEditorServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TileTypeSidebarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('doit créer', () => {
    expect(component).toBeTruthy();
  });

  it('doit appeler selectTileType sur mapEditorService lorsque selectTileType est appelé', () => {
    const type = 'TestType' as TileType;
    component.selectTileType(type);
    expect(mapEditorServiceSpy.selectTileType).toHaveBeenCalledWith(type);
  });

  it('doit appeler getSelectedTileType sur mapEditorService lorsque isSelected est appelé', () => {
    mapEditorServiceSpy.getSelectedTileType.and.returnValue('TestType' as TileType);
    const type = 'TestType' as TileType;
    component.isSelected(type);
    expect(mapEditorServiceSpy.getSelectedTileType).toHaveBeenCalled();
  });
});
