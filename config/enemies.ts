import { EnemyType } from '../types';
import { CONSTANTS } from '../constants';

export interface EnemyConfig {
  id: string;
  type: EnemyType;
  name: string;
  hpBase: number;
  hpPerLevel: number;
  speed: number; // Multiplier relative to base AI speed logic
  damage: number;
  color: string;
  size: number;
  sprite: string;
  weight: number; // Spawn probability weight
  minFloor: number;
  ai: 'CHASE' | 'SHOOT' | 'DASHER' | 'TANK' | 'ORBIT' | 'BOSS';
  scoreValue: number;
}

export const ENEMIES: EnemyConfig[] = [
  {
    id: 'ghost',
    type: EnemyType.CHASER,
    name: 'Ghost',
    hpBase: 10,
    hpPerLevel: 2,
    speed: 0.6,
    damage: 1,
    color: CONSTANTS.COLORS.ENEMY,
    size: 32,
    sprite: 'ENEMY_CHASER',
    weight: 50,
    minFloor: 1,
    ai: 'CHASE',
    scoreValue: 10
  },
  {
    id: 'dasher',
    type: EnemyType.DASHER,
    name: 'Dasher',
    hpBase: 10,
    hpPerLevel: 2,
    speed: 1.0, 
    damage: 1,
    color: CONSTANTS.COLORS.ENEMY,
    size: 32,
    sprite: 'ENEMY_CHASER', // Re-using chaser sprite as base, normally would be distinct
    weight: 15,
    minFloor: 1,
    ai: 'DASHER',
    scoreValue: 15
  },
  {
    id: 'eye',
    type: EnemyType.SHOOTER,
    name: 'Floating Eye',
    hpBase: 10,
    hpPerLevel: 2,
    speed: 0,
    damage: 1,
    color: CONSTANTS.COLORS.ENEMY_FLYING,
    size: 32,
    sprite: 'ENEMY_SHOOTER',
    weight: 20,
    minFloor: 1,
    ai: 'SHOOT',
    scoreValue: 15
  },
  {
    id: 'orbiter',
    type: EnemyType.ORBITER,
    name: 'Orbiter',
    hpBase: 10,
    hpPerLevel: 2,
    speed: 1.0,
    damage: 1,
    color: CONSTANTS.COLORS.ENEMY_ORBITER,
    size: 32,
    sprite: 'ENEMY_CHASER', // Fallback sprite
    weight: 10,
    minFloor: 2,
    ai: 'ORBIT',
    scoreValue: 20
  },
  {
    id: 'tank',
    type: EnemyType.TANK,
    name: 'Tank',
    hpBase: 30,
    hpPerLevel: 5,
    speed: 0.3,
    damage: 2,
    color: CONSTANTS.COLORS.ENEMY_TANK,
    size: 40,
    sprite: 'ENEMY_TANK',
    weight: 5,
    minFloor: 1,
    ai: 'TANK',
    scoreValue: 30
  }
];

export const BOSSES: EnemyConfig[] = [
  {
    id: 'boss_skull',
    type: EnemyType.BOSS,
    name: 'Skull King',
    hpBase: 100,
    hpPerLevel: 20,
    speed: 1.0,
    damage: 1,
    color: CONSTANTS.COLORS.ENEMY_BOSS,
    size: 80,
    sprite: 'ENEMY_BOSS',
    weight: 100,
    minFloor: 1,
    ai: 'BOSS',
    scoreValue: 500
  }
];