import { Vector2, Rect, Direction } from './types';

export const uuid = () => Math.random().toString(36).substr(2, 9);

export const checkAABB = (r1: Rect, r2: Rect): boolean => {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
};

export const normalizeVector = (v: Vector2): Vector2 => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
};

export const distance = (a: Vector2, b: Vector2): number => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
};

export class SeededRNG {
  seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }

  // Simple Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Range inclusive [min, max]
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer Range inclusive [min, max]
  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

export class InputManager {
  keys: { [key: string]: boolean } = {};

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };

  onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  getMovementVector(): Vector2 {
    const v = { x: 0, y: 0 };
    // Strictly WASD for movement
    if (this.keys['KeyW']) v.y -= 1;
    if (this.keys['KeyS']) v.y += 1;
    if (this.keys['KeyA']) v.x -= 1;
    if (this.keys['KeyD']) v.x += 1;
    return normalizeVector(v);
  }

  getShootingDirection(): Vector2 | null {
    let x = 0;
    let y = 0;
    
    // Strictly Arrow Keys for shooting
    if (this.keys['ArrowUp']) y -= 1;
    if (this.keys['ArrowDown']) y += 1;
    if (this.keys['ArrowLeft']) x -= 1;
    if (this.keys['ArrowRight']) x += 1;

    if (x === 0 && y === 0) return null;
    
    // Enforce 4-way shooting (Isaac style)
    if (Math.abs(x) >= Math.abs(y)) {
        y = 0;
    } else {
        x = 0;
    }
    
    return normalizeVector({x, y});
  }
}