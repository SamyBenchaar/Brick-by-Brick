import { GameMap } from './game-map';
import { MapSize } from '@common/map';

describe('GameMap', () => {
  it('should create an instance', () => {
    expect(new GameMap(MapSize.Small)).toBeTruthy();
  });
});
