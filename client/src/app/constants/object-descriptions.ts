import { ObjectType } from '@common/map';


export const OBJECT_DESCRIPTIONS: Record<ObjectType, string> = {

    [ObjectType.StartingPoint]: 'Départ',
    [ObjectType.HealingSanctuary]: 'Sanctuaire de soin',
    [ObjectType.CombatSanctuary]: 'Sanctuaire de combat',
};