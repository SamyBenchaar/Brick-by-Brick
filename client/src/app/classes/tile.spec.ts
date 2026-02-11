import { TileType } from '@common/map';
import { Tile } from './tile';

describe('Tile', () => {
  it('should create an instance', () => {
    expect(new Tile(TileType.Base)).toBeTruthy();
  });
});
