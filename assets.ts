import { CONSTANTS } from './constants';
import { SPRITES } from './sprites';

export type SpriteName = keyof typeof SPRITES;

export class AssetLoader {
  assets: Record<string, HTMLCanvasElement> = {};

  constructor() {
    this.generateAssets();
  }

  // Draw a 16x16 grid definition onto a canvas of arbitrary size (scaled)
  // Palettes: [Transparent, Primary, Secondary, Highlight]
  createTexture(matrix: number[][], palette: string[], size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Pixel size relative to destination
    const px = size / 16; 

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const val = matrix[y][x];
        if (val > 0) {
          ctx.fillStyle = palette[val];
          // Overlap slightly to prevent sub-pixel gaps
          ctx.fillRect(x * px, y * px, px + 0.5, px + 0.5); 
        }
      }
    }
    return canvas;
  }

  generateAssets() {
    const P = CONSTANTS.PALETTE;

    // Walls
    this.assets['WALL'] = this.createTexture(SPRITES.WALL, 
      ['', P.WALL_BASE, P.WALL_HIGHLIGHT, P.WALL_SHADOW], CONSTANTS.TILE_SIZE);
      
    // Floor (Low contrast)
    this.assets['FLOOR'] = this.createTexture(SPRITES.FLOOR,
      ['', P.FLOOR_BASE, P.FLOOR_VAR_1, P.FLOOR_VAR_2], CONSTANTS.TILE_SIZE);

    // Obstacles
    this.assets['ROCK'] = this.createTexture(SPRITES.ROCK,
      ['', P.ROCK_BASE, P.ROCK_HIGHLIGHT, '#000000'], CONSTANTS.TILE_SIZE);

    // Player
    this.assets['PLAYER'] = this.createTexture(SPRITES.PLAYER,
      ['', P.PLAYER_MAIN, P.PLAYER_SHADOW, P.PLAYER_SKIN], CONSTANTS.PLAYER_SIZE);

    // Enemies
    this.assets['ENEMY_CHASER'] = this.createTexture(SPRITES.ENEMY_CHASER,
      ['', P.ENEMY_RED_MAIN, P.ENEMY_RED_DARK, '#ffffff'], CONSTANTS.ENEMY_SIZE);
      
    this.assets['ENEMY_SHOOTER'] = this.createTexture(SPRITES.ENEMY_SHOOTER,
      ['', P.ENEMY_BLUE_MAIN, P.ENEMY_BLUE_DARK, '#ffffff'], CONSTANTS.ENEMY_SIZE);

    this.assets['ENEMY_TANK'] = this.createTexture(SPRITES.ENEMY_TANK,
      ['', P.ENEMY_GREEN_MAIN, P.ENEMY_GREEN_DARK, '#000000'], CONSTANTS.ENEMY_SIZE * 1.25); // Slightly larger rendered

    this.assets['ENEMY_BOSS'] = this.createTexture(SPRITES.BOSS,
      ['', P.BOSS_MAIN, P.BOSS_HIGHLIGHT, '#000000'], 80); // Boss Size

    // Items
    this.assets['ITEM'] = this.createTexture(SPRITES.ITEM,
      ['', P.ITEM_GOLD, P.ITEM_SHADOW, '#ffffff'], CONSTANTS.ITEM_SIZE);
      
    this.assets['HEART'] = this.createTexture(SPRITES.HEART,
      ['', P.HEART_MAIN, P.HEART_SHADOW, '#ffffff'], 16);
      
    // Projectiles (Procedural circle sprites)
    this.assets['PROJ_PLAYER'] = this.createCircleSprite(8, P.PROJ_PLAYER_MAIN, P.PROJ_PLAYER_CORE);
    this.assets['PROJ_ENEMY'] = this.createCircleSprite(8, P.PROJ_ENEMY_MAIN, P.PROJ_ENEMY_CORE);
  }

  createCircleSprite(radius: number, color: string, core: string): HTMLCanvasElement {
      const size = radius * 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      // Outer
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(radius, radius, radius, 0, Math.PI*2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(radius, radius, radius * 0.5, 0, Math.PI*2);
      ctx.fill();
      
      return canvas;
  }

  get(name: string): HTMLCanvasElement | null {
    return this.assets[name] || null;
  }
}