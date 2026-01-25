import { ObjectType } from '@common/map';


export const OBJECT_DESCRIPTIONS: Record<ObjectType, string> = {
    [ObjectType.FLAG]: 'flag',
    [ObjectType.HEALINGSANCTUARY]: 'soin',
    [ObjectType.COMBATSANCTUARY]: 'combat',
    [ObjectType.STARTPOINT]: 'départ',
};