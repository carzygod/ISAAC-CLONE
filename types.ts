// Vector Math
export interface Vector2 {
  x: number;
  y: number;
}

// Enums
export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
  PROJECTILE = 'PROJECTILE',
  ITEM = 'ITEM',
  OBSTACLE = 'OBSTACLE',
  DOOR = 'DOOR',
  TRAPDOOR = 'TRAPDOOR'
}

export enum EnemyType {
  CHASER = 'CHASER',       // Runs at player
  SHOOTER = 'SHOOTER',     // Stationary, shoots
  DASHER = 'DASHER',       // Dashes periodically
  TANK = 'TANK',           // Slow, High HP, Knockback resistant
  ORBITER = 'ORBITER',     // Circles the player
  BOSS = 'BOSS'            // Big HP, bullet hell
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum ItemType {
  HP_UP = 'HP_UP',
  SPEED_UP = 'SPEED_UP',
  DAMAGE_UP = 'DAMAGE_UP',
  FIRE_RATE_UP = 'FIRE_RATE_UP',
  SHOT_SPEED_UP = 'SHOT_SPEED_UP',
  RANGE_UP = 'RANGE_UP',           
  BULLET_SIZE_UP = 'BULLET_SIZE_UP', 
  TRIPLE_SHOT = 'TRIPLE_SHOT',     
  QUAD_SHOT = 'QUAD_SHOT',
  HEART_PICKUP = 'HEART_PICKUP'   // New Pickup
}

// Interfaces
export interface Stats {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  fireRate: number; // Cooldown in frames
  shotSpeed: number;
  range: number;
  shotSpread: number; // 1 = normal, 3 = triple, 4 = quad
  bulletScale: number; // Multiplier for size
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Entity extends Rect {
  id: string;
  type: EntityType;
  velocity: Vector2;
  color: string;
  markedForDeletion: boolean;
}

export interface PlayerEntity extends Entity {
  stats: Stats;
  cooldown: number;
  invincibleTimer: number;
  inventory: ItemType[];
}

export interface EnemyEntity extends Entity {
  enemyType: EnemyType;
  hp: number;
  maxHp: number;
  aiState: 'IDLE' | 'CHASE' | 'ATTACK' | 'COOLDOWN';
  timer: number;
  orbitAngle?: number; // For Orbiter
}

export interface ProjectileEntity extends Entity {
  ownerId: string; // 'player' or enemy ID
  damage: number;
  lifeTime: number;
}

export interface ItemEntity extends Entity {
  itemType: ItemType;
  name: string;
  description: string;
}

export interface Room {
  x: number; // Grid X
  y: number; // Grid Y
  type: 'START' | 'NORMAL' | 'ITEM' | 'BOSS';
  doors: { [key in Direction]?: boolean };
  cleared: boolean;
  itemCollected?: boolean; // New flag for persistence
  layout: number[][]; // 0: Floor, 1: Wall, 2: Rock
  visited: boolean;
}

export interface GameState {
  status: GameStatus;
  floorLevel: number;
  score: number;
  hudStats: Stats | null; // For React UI
  notification: string | null; // New notification text
}