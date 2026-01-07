export const CONSTANTS = {
  TILE_SIZE: 48,
  // 15x9 Grid for the room (Isaac standard is 13x7 inner + walls)
  ROOM_WIDTH: 15, 
  ROOM_HEIGHT: 9,
  CANVAS_WIDTH: 15 * 48, // 720
  CANVAS_HEIGHT: 9 * 48, // 432
  
  PLAYER_SIZE: 32,
  ENEMY_SIZE: 32,
  PROJECTILE_SIZE: 12,
  ITEM_SIZE: 24,

  // Frames per second for logic updates
  FPS: 60,
  
  // Colors (Tailwind palette approximation)
  COLORS: {
    BG: '#1a1a1a',
    WALL: '#404040',
    FLOOR: '#262626',
    ROCK: '#525252',
    DOOR: '#78350f', // Amber 900
    DOOR_OPEN: '#14532d', // Green 900
    TRAPDOOR: '#000000',
    PLAYER: '#06b6d4', // Cyan 500
    PLAYER_HIT: '#cffafe', // Cyan 100
    ENEMY: '#ef4444', // Red 500
    ENEMY_FLYING: '#3b82f6', // Blue 500
    ENEMY_TANK: '#3f6212', // Lime 800 (Dark Green)
    ENEMY_ORBITER: '#db2777', // Pink 600
    ENEMY_BOSS: '#7f1d1d', // Red 900
    PROJECTILE_FRIENDLY: '#3b82f6', // Blue 500
    PROJECTILE_ENEMY: '#f97316', // Orange 500
    ITEM: '#a855f7', // Purple 500
  }
};