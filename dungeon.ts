import { CONSTANTS } from './constants';
import { Room, Direction } from './types';
import { SeededRNG } from './utils';

const GRID_SIZE = 10; // Virtual grid for dungeon layout

// 0: Floor, 1: Wall, 2: Obstacle
const TEMPLATE_EMPTY = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const TEMPLATE_ROCKS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const copyLayout = (template: number[][]) => template.map(row => [...row]);

export const generateDungeon = (floorLevel: number, seed: number): Room[] => {
  const rng = new SeededRNG(seed);
  const rooms: Room[] = [];
  const roomCount = 5 + Math.floor(floorLevel * 1.5); // Increase rooms per floor
  
  // Start at center
  const startX = Math.floor(GRID_SIZE / 2);
  const startY = Math.floor(GRID_SIZE / 2);
  
  const occupied = new Set<string>();
  const queue: {x: number, y: number, dist: number}[] = [{x: startX, y: startY, dist: 0}];
  occupied.add(`${startX},${startY}`);

  const createdRooms: {x: number, y: number, type: Room['type'], dist: number}[] = [];

  // Simple BFS/Random Walk hybrid to generate layout
  while (createdRooms.length < roomCount && queue.length > 0) {
    const current = queue.shift()!;
    createdRooms.push({ ...current, type: 'NORMAL' });

    // Try to expand in random directions
    const directions = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
    ].sort(() => rng.next() - 0.5);

    for (const dir of directions) {
      if (createdRooms.length >= roomCount) break;
      
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const key = `${nx},${ny}`;

      if (!occupied.has(key) && rng.next() > 0.3) {
        occupied.add(key);
        const nextRoom = { x: nx, y: ny, dist: current.dist + 1 };
        queue.push(nextRoom);
        // Sometimes re-add current to queue to create branching
        if(rng.next() > 0.5) queue.push(current);
      }
    }
  }

  // Assign Special Rooms
  // Start Room
  createdRooms[0].type = 'START';
  
  // Boss Room (Furthest away)
  const furthest = createdRooms.reduce((prev, curr) => curr.dist > prev.dist ? curr : prev, createdRooms[0]);
  furthest.type = 'BOSS';

  // Item Room (Random non-start, non-boss)
  const candidates = createdRooms.filter(r => r.type === 'NORMAL');
  if (candidates.length > 0) {
    const itemRoom = candidates[Math.floor(rng.next() * candidates.length)];
    itemRoom.type = 'ITEM';
  }

  // Use a Set of valid room coordinates to strictly determine neighbors
  const validRoomCoords = new Set(createdRooms.map(r => `${r.x},${r.y}`));

  // Convert to Full Room Objects with Doors
  createdRooms.forEach(cr => {
    // Check neighbors using the VALID rooms list, not just the queue history
    const doors: Room['doors'] = {};
    const hasNeighbor = (dx: number, dy: number) => 
      validRoomCoords.has(`${cr.x + dx},${cr.y + dy}`);

    if (hasNeighbor(0, -1)) doors[Direction.UP] = true;
    if (hasNeighbor(0, 1)) doors[Direction.DOWN] = true;
    if (hasNeighbor(-1, 0)) doors[Direction.LEFT] = true;
    if (hasNeighbor(1, 0)) doors[Direction.RIGHT] = true;

    // Pick a layout
    let layout = copyLayout(TEMPLATE_EMPTY);
    if (cr.type === 'NORMAL' && rng.next() > 0.5) {
      layout = copyLayout(TEMPLATE_ROCKS);
    } else if (cr.type === 'BOSS') {
       layout = copyLayout(TEMPLATE_EMPTY); // Open arena
    }

    rooms.push({
      x: cr.x,
      y: cr.y,
      type: cr.type,
      doors,
      cleared: cr.type === 'START', // Start is safe
      itemCollected: false,
      layout,
      visited: false
    });
  });

  return rooms;
};

// Helper to carve doors into the tile layout
export const carveDoors = (layout: number[][], doors: Room['doors']) => {
  const h = layout.length;
  const w = layout[0].length;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Door format: set tile to 0 (floor) and maybe a special ID for physics
  if (doors.UP) { layout[0][cx] = 3; layout[0][cx-1] = 3; layout[0][cx+1] = 3; }
  if (doors.DOWN) { layout[h-1][cx] = 3; layout[h-1][cx-1] = 3; layout[h-1][cx+1] = 3; }
  if (doors.LEFT) { layout[cy][0] = 3; layout[cy-1][0] = 3; layout[cy+1][0] = 3; }
  if (doors.RIGHT) { layout[cy][w-1] = 3; layout[cy-1][w-1] = 3; layout[cy+1][w-1] = 3; }
  
  // 3 is internally used as "Doorway Floor" to distinguish from normal floor
  return layout;
};