import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { ObjectType } from '@common/map';
import { ObjectSidebarComponent } from './object-sidebar.component';

describe('ObjectSidebarComponent', () => {
  let component: ObjectSidebarComponent;
  let fixture: ComponentFixture<ObjectSidebarComponent>;

  const REMAINING_COUNT = 3;

  let mapEditorServiceSpy: jasmine.SpyObj<MapEditorService>;
  let objectCounterServiceSpy: jasmine.SpyObj<ObjectCounterService>;

  beforeEach(async () => {
    mapEditorServiceSpy = jasmine.createSpyObj('MapEditorService', ['selectObject', 'getSelectedObject', 'getCurrentGame']);
    objectCounterServiceSpy = jasmine.createSpyObj('ObjectCounterService', ['canPlace', 'getRemainingCount'], { startPoint: undefined });

    await TestBed.configureTestingModule({
      imports: [ObjectSidebarComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { size: 'small' },
            },
          },
        },
        { provide: MapEditorService, useValue: mapEditorServiceSpy },
        { provide: ObjectCounterService, useValue: objectCounterServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectSidebarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('doit créer', () => {
    expect(component).toBeTruthy();
  });

  it('doit appeler selectObject sur mapEditorService lorsque selectObject est appelé', () => {
    const type = 'TestType' as ObjectType;
    component.selectObject(type);
    expect(mapEditorServiceSpy.selectObject).toHaveBeenCalledWith(type);
  });

  it('doit appeler getSelectedObject sur mapEditorService lorsque isSelected est appelé', () => {
    mapEditorServiceSpy.getSelectedObject.and.returnValue('TestType' as ObjectType);
    const type = 'TestType' as ObjectType;
    component.isSelected(type);
    expect(mapEditorServiceSpy.getSelectedObject).toHaveBeenCalled();
  });

  it('doit appeler canPlace sur objectCounterService lorsque isDisabled est appelé', () => {
    objectCounterServiceSpy.canPlace.and.returnValue(true);
    const type = 'TestType' as ObjectType;
    component.isDisabled(type);
    expect(objectCounterServiceSpy.canPlace).toHaveBeenCalledWith(type);
  });

  it('doit appeler getRemainingCount sur objectCounterService lorsque getRemainingCount est appelé', () => {
    objectCounterServiceSpy.getRemainingCount.and.returnValue(REMAINING_COUNT);
    const type = 'TestType' as ObjectType;
    component.getRemainingCount(type);
    expect(objectCounterServiceSpy.getRemainingCount).toHaveBeenCalledWith(type);
  });
});
