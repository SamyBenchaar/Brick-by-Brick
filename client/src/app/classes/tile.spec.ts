import { Tile } from './tile';
import { TileType } from '@common/map';

describe('Tile', () => {
  it('should create an instance', () => {
    expect(new Tile(TileType.Base, 0, 0)).toBeTruthy();
  });
});
