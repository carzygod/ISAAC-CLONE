import { CONSTANTS } from './constants';
import { 
  Entity, PlayerEntity, EnemyEntity, ProjectileEntity, ItemEntity, 
  EntityType, EnemyType, Direction, Stats, ItemType, GameStatus, Room, Rect 
} from './types';
import { uuid, checkAABB, distance, normalizeVector } from './utils';
import { generateDungeon, carveDoors } from './dungeon';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  status: GameStatus = GameStatus.MENU;
  floorLevel: number = 1;
  baseSeed: number = 0;
  score: number = 0;
  
  player: PlayerEntity;
  entities: Entity[] = [];
  currentRoom: Room | null = null;
  dungeon: Room[] = [];

  // Notification system
  notification: string | null = null;
  notificationTimer: number = 0;
  
  // Restart Logic
  restartTimer: number = 0;
  
  // Callback to sync React UI
  onUiUpdate: (stats: any) => void;

  constructor(canvas: HTMLCanvasElement, onUiUpdate: (stats: any) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onUiUpdate = onUiUpdate;
    this.canvas.width = CONSTANTS.CANVAS_WIDTH;
    this.canvas.height = CONSTANTS.CANVAS_HEIGHT;

    // Default Player
    this.player = this.createPlayer();
  }

  startNewGame() {
    this.floorLevel = 1;
    this.score = 0;
    this.baseSeed = Date.now(); // Initial random seed for the run
    this.player = this.createPlayer();
    this.loadFloor(1);
    this.status = GameStatus.PLAYING;
    this.restartTimer = 0;
  }

  createPlayer(): PlayerEntity {
    return {
      id: 'player',
      type: EntityType.PLAYER,
      x: CONSTANTS.CANVAS_WIDTH / 2 - CONSTANTS.PLAYER_SIZE / 2,
      y: CONSTANTS.CANVAS_HEIGHT / 2 - CONSTANTS.PLAYER_SIZE / 2,
      w: CONSTANTS.PLAYER_SIZE,
      h: CONSTANTS.PLAYER_SIZE,
      velocity: { x: 0, y: 0 },
      color: CONSTANTS.COLORS.PLAYER,
      markedForDeletion: false,
      stats: {
        hp: 6, // 3 Hearts (2 hp per heart)
        maxHp: 6,
        speed: 4,
        damage: 3.5,
        fireRate: 20, // Frames
        shotSpeed: 7,
        range: 400,
        shotSpread: 1,
        bulletScale: 1
      },
      cooldown: 0,
      invincibleTimer: 0,
      inventory: []
    };
  }

  loadFloor(level: number) {
    this.floorLevel = level;
    // Deterministic seed for this floor based on run seed
    const floorSeed = this.baseSeed + (level * 1000); 
    this.dungeon = generateDungeon(level, floorSeed);
    
    const startRoom = this.dungeon.find(r => r.type === 'START');
    if (startRoom) {
      this.enterRoom(startRoom, null);
    }
  }

  enterRoom(room: Room, inputDir: Direction | null) {
    this.currentRoom = room;
    room.visited = true;
    
    // Sync clear status for Item Rooms (re-entry logic)
    if (room.type === 'ITEM' && room.itemCollected) {
        room.cleared = true;
    }

    // Ensure cleared rooms have open physical doors (updates collision map)
    if (room.cleared) {
        carveDoors(room.layout, room.doors);
    }

    // Clear dynamic entities
    this.entities = [];

    // Position Player based on entry direction (Movement Direction)
    const cx = CONSTANTS.CANVAS_WIDTH / 2;
    const cy = CONSTANTS.CANVAS_HEIGHT / 2;
    
    // Offset to place player just inside the room (Tile size + padding)
    const offset = CONSTANTS.TILE_SIZE + 16; 
    
    // Door Clamping: Ensure player aligns with the door frame
    const doorW = CONSTANTS.TILE_SIZE * 3;
    const minX = cx - doorW/2;
    const maxX = cx + doorW/2 - this.player.w;
    const minY = cy - doorW/2; 
    const maxY = cy + doorW/2 - this.player.h;

    // Logic: If I moved UP to enter, I spawn at the BOTTOM of the new room.
    if (inputDir === Direction.UP) {
      this.player.y = CONSTANTS.CANVAS_HEIGHT - offset - this.player.h;
      this.player.x = Math.max(minX, Math.min(this.player.x, maxX)); // Clamp X
    } else if (inputDir === Direction.DOWN) {
      this.player.y = offset;
      this.player.x = Math.max(minX, Math.min(this.player.x, maxX)); // Clamp X
    } else if (inputDir === Direction.LEFT) {
      this.player.x = CONSTANTS.CANVAS_WIDTH - offset - this.player.w;
      this.player.y = Math.max(minY, Math.min(this.player.y, maxY)); // Clamp Y
    } else if (inputDir === Direction.RIGHT) {
      this.player.x = offset;
      this.player.y = Math.max(minY, Math.min(this.player.y, maxY)); // Clamp Y
    } else {
      // Start room / Teleport: Center
      this.player.x = cx - this.player.w/2;
      this.player.y = cy - this.player.h/2;
    }

    // Spawn Enemies if not cleared
    // Note: This logic ensures walls block doors because carveDoors is only called if cleared=true
    if (!room.cleared && room.type !== 'START') {
      this.spawnEnemiesForRoom(room);
    }

    // Spawn Item if Item Room and NOT collected yet
    if (room.type === 'ITEM') {
        if (!room.itemCollected) {
            this.spawnItem(cx, cy);
            // DO NOT force clear here. Room stays locked until item collected.
        }
    }
    
    // Boss Spawn
    if (room.type === 'BOSS' && !room.cleared) {
        this.spawnBoss(cx, cy);
    }

    // If boss room is already cleared, spawn trapdoor
    if (room.type === 'BOSS' && room.cleared) {
        this.spawnTrapdoor(cx, cy);
    }
  }

  spawnEnemiesForRoom(room: Room) {
    const count = 2 + Math.floor(Math.random() * 3) + this.floorLevel;
    
    // Don't spawn enemies in Item rooms
    if (room.type === 'ITEM') return;

    for (let i = 0; i < count; i++) {
        const ex = CONSTANTS.TILE_SIZE * 2 + Math.random() * (CONSTANTS.CANVAS_WIDTH - CONSTANTS.TILE_SIZE * 4);
        const ey = CONSTANTS.TILE_SIZE * 2 + Math.random() * (CONSTANTS.CANVAS_HEIGHT - CONSTANTS.TILE_SIZE * 4);
        
        // Don't spawn on top of player
        if (distance({x: ex, y: ey}, this.player) < 150) continue;

        const typeRoll = Math.random();
        let eType = EnemyType.CHASER;
        let color = CONSTANTS.COLORS.ENEMY; // Red
        let size = CONSTANTS.ENEMY_SIZE;
        let hp = 10 + (this.floorLevel * 2);
        let speed = 1.0;

        if (typeRoll > 0.85) {
            eType = EnemyType.TANK;
            color = CONSTANTS.COLORS.ENEMY_TANK;
            size = 40;
            hp = 30 + (this.floorLevel * 5);
        } else if (typeRoll > 0.7) {
            eType = EnemyType.ORBITER;
            color = CONSTANTS.COLORS.ENEMY_ORBITER;
        } else if (typeRoll > 0.5) {
            eType = EnemyType.SHOOTER;
            color = CONSTANTS.COLORS.ENEMY_FLYING; // Blue
        } else if (typeRoll > 0.35) {
            eType = EnemyType.DASHER;
            color = CONSTANTS.COLORS.ENEMY; // Red
        }

        const enemy: EnemyEntity = {
            id: uuid(),
            type: EntityType.ENEMY,
            x: ex, y: ey,
            w: size, h: size,
            velocity: { x: 0, y: 0 },
            color: color,
            markedForDeletion: false,
            enemyType: eType,
            hp: hp,
            maxHp: hp,
            aiState: 'IDLE',
            timer: 0,
            orbitAngle: Math.random() * Math.PI * 2
        };
        this.entities.push(enemy);
    }
  }

  spawnBoss(x: number, y: number) {
      const boss: EnemyEntity = {
          id: uuid(),
          type: EntityType.ENEMY,
          x: x - 40, y: y - 40,
          w: 80, h: 80,
          velocity: {x:0, y:0},
          color: CONSTANTS.COLORS.ENEMY_BOSS,
          markedForDeletion: false,
          enemyType: EnemyType.BOSS,
          hp: 100 + (this.floorLevel * 20),
          maxHp: 100 + (this.floorLevel * 20),
          aiState: 'IDLE',
          timer: 0
      };
      this.entities.push(boss);
  }

  spawnItem(x: number, y: number) {
      const types = Object.values(ItemType);
      const type = types[Math.floor(Math.random() * types.length)];
      
      let description = "Stat Up";
      switch(type) {
          case ItemType.HP_UP: description = "HP Up + Heal"; break;
          case ItemType.DAMAGE_UP: description = "Damage +10%"; break;
          case ItemType.SPEED_UP: description = "Speed +0.5"; break;
          case ItemType.FIRE_RATE_UP: description = "Fire Rate +20%"; break;
          case ItemType.SHOT_SPEED_UP: description = "Shot Speed +1.5"; break;
          case ItemType.RANGE_UP: description = "Range +20%"; break;
          case ItemType.BULLET_SIZE_UP: description = "Big Bullets +50%"; break;
          case ItemType.TRIPLE_SHOT: description = "Triple Shot"; break;
          case ItemType.QUAD_SHOT: description = "Quad Shot"; break;
      }

      const item: ItemEntity = {
          id: uuid(),
          type: EntityType.ITEM,
          x: x - CONSTANTS.ITEM_SIZE/2,
          y: y - CONSTANTS.ITEM_SIZE/2,
          w: CONSTANTS.ITEM_SIZE,
          h: CONSTANTS.ITEM_SIZE,
          velocity: {x:0, y:0},
          color: CONSTANTS.COLORS.ITEM,
          markedForDeletion: false,
          itemType: type,
          name: type.replace(/_/g, ' '),
          description: description
      };
      this.entities.push(item);
  }

  spawnTrapdoor(x: number, y: number) {
      const td: Entity = {
          id: uuid(),
          type: EntityType.TRAPDOOR,
          x: x - 24, y: y - 24,
          w: 48, h: 48,
          velocity: {x:0,y:0},
          color: CONSTANTS.COLORS.TRAPDOOR,
          markedForDeletion: false
      };
      this.entities.push(td);
  }

  update(input: { move: {x:number, y:number}, shoot: {x:number, y:number} | null, restart?: boolean }) {
    
    // Quick Restart Logic (Allow in Playing and Game Over)
    if (input.restart) {
        this.restartTimer++;
        if (this.restartTimer > 60) { // 1 second hold
            this.startNewGame();
            this.notification = "RUN RESTARTED";
            this.notificationTimer = 120;
        }
    } else {
        this.restartTimer = 0;
    }

    if (this.status !== GameStatus.PLAYING) return;

    // --- Notification Logic ---
    if (this.notificationTimer > 0) {
        this.notificationTimer--;
        if (this.notificationTimer <= 0) {
            this.notification = null;
        }
    }

    // --- Player Logic ---
    if (input.move.x !== 0 || input.move.y !== 0) {
        this.player.velocity.x = input.move.x * this.player.stats.speed;
        this.player.velocity.y = input.move.y * this.player.stats.speed;
    } else {
        this.player.velocity.x = 0;
        this.player.velocity.y = 0;
    }

    this.resolveWallCollision(this.player);

    // Shooting
    if (this.player.cooldown > 0) this.player.cooldown--;
    if (input.shoot && this.player.cooldown <= 0) {
        this.spawnProjectile(this.player, input.shoot);
        this.player.cooldown = this.player.stats.fireRate;
    }

    // Invincibility
    if (this.player.invincibleTimer > 0) this.player.invincibleTimer--;

    // --- Entity Loop ---
    const enemies = this.entities.filter(e => e.type === EntityType.ENEMY) as EnemyEntity[];
    const roomIsClear = enemies.length === 0;

    // Auto-clear Room (Normal/Boss) when all enemies are dead
    // Note: We exclude ITEM rooms here because they are cleared via item collection
    if (this.currentRoom && !this.currentRoom.cleared && roomIsClear && this.currentRoom.type !== 'ITEM') {
        this.currentRoom.cleared = true;
        // Open doors physically when room is cleared
        carveDoors(this.currentRoom.layout, this.currentRoom.doors);
        
        // If it was a boss room, spawn trapdoor
        if (this.currentRoom.type === 'BOSS') {
            const cx = CONSTANTS.CANVAS_WIDTH / 2;
            const cy = CONSTANTS.CANVAS_HEIGHT / 2;
            this.spawnTrapdoor(cx, cy);
        }
    }

    // Doors Logic (Check exit)
    if (this.currentRoom && this.currentRoom.cleared) {
        this.checkDoorCollisions();
    }

    // Resolve Enemy-Enemy Collisions (Physics for Red monsters)
    this.resolveEnemyPhysics(enemies);

    this.entities.forEach(e => {
        if (e.markedForDeletion) return;

        // Move
        e.x += e.velocity.x;
        e.y += e.velocity.y;

        // Type Specific Logic
        if (e.type === EntityType.PROJECTILE) {
            this.updateProjectile(e as ProjectileEntity);
        } else if (e.type === EntityType.ENEMY) {
            this.updateEnemy(e as EnemyEntity);
        } else if (e.type === EntityType.ITEM) {
            if (checkAABB(this.player, e)) {
                this.collectItem(e as ItemEntity);
            }
        } else if (e.type === EntityType.TRAPDOOR) {
            if (checkAABB(this.player, e)) {
                // Go next floor
                this.loadFloor(this.floorLevel + 1);
            }
        }
    });

    // Cleanup
    this.entities = this.entities.filter(e => !e.markedForDeletion);

    // Sync UI
    this.onUiUpdate({
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
        floor: this.floorLevel,
        score: this.score,
        items: this.player.inventory.length,
        notification: this.notification, // Send notification
        // Minimap Data
        dungeon: this.dungeon.map(r => ({x: r.x, y: r.y, type: r.type, visited: r.visited})),
        currentRoomPos: this.currentRoom ? {x: this.currentRoom.x, y: this.currentRoom.y} : {x:0, y:0}
    });
  }

  resolveEnemyPhysics(enemies: EnemyEntity[]) {
      for (let i = 0; i < enemies.length; i++) {
          for (let j = i + 1; j < enemies.length; j++) {
              const e1 = enemies[i];
              const e2 = enemies[j];
              
              // Flyings (Shooter, Orbiter) overlap
              const fly1 = e1.enemyType === EnemyType.SHOOTER || e1.enemyType === EnemyType.ORBITER;
              const fly2 = e2.enemyType === EnemyType.SHOOTER || e2.enemyType === EnemyType.ORBITER;
              if (fly1 || fly2) continue;

              const dx = e1.x - e2.x;
              const dy = e1.y - e2.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const minDist = e1.w; 

              if (dist < minDist && dist > 0) {
                  const overlap = minDist - dist;
                  const pushX = (dx / dist) * (overlap / 2);
                  const pushY = (dy / dist) * (overlap / 2);

                  e1.x += pushX;
                  e1.y += pushY;
                  e2.x -= pushX;
                  e2.y -= pushY;
              }
          }
      }
  }

  spawnProjectile(owner: PlayerEntity | EnemyEntity, dir: {x:number, y:number}) {
      const isPlayer = owner.type === EntityType.PLAYER;
      const stats = isPlayer ? (owner as PlayerEntity).stats : null;
      
      const speed = stats ? stats.shotSpeed : 5;
      const damage = stats ? stats.damage : 1;
      
      // Feature: Bullet size proportional to attack damage
      // Base Size + (Damage / BaseDamage * scaling)
      let baseSize = CONSTANTS.PROJECTILE_SIZE;
      if (isPlayer) {
          // Scale based on damage (linear scaling for simplicity)
          // 3.5 is base damage.
          const dmgFactor = Math.max(1, damage / 3.5);
          baseSize = baseSize * dmgFactor;
          
          // Apply bullet scale stat
          baseSize *= stats!.bulletScale;
      }
      
      const range = stats ? stats.range : 600;
      
      // Helper to push a projectile
      const pushProj = (vx: number, vy: number) => {
          this.entities.push({
              id: uuid(),
              type: EntityType.PROJECTILE,
              x: owner.x + owner.w/2 - baseSize/2,
              y: owner.y + owner.h/2 - baseSize/2,
              w: baseSize, h: baseSize,
              velocity: { x: vx * speed, y: vy * speed },
              color: isPlayer ? CONSTANTS.COLORS.PROJECTILE_FRIENDLY : CONSTANTS.COLORS.PROJECTILE_ENEMY,
              markedForDeletion: false,
              ownerId: owner.id,
              damage,
              lifeTime: range
          } as ProjectileEntity);
      };

      if (!isPlayer || stats!.shotSpread === 1) {
          pushProj(dir.x, dir.y);
      } else {
          // Multi-shot Logic
          const angle = Math.atan2(dir.y, dir.x);
          const spreadRad = 15 * (Math.PI / 180); // 15 degrees spread

          // Triple Shot: -15, 0, +15
          if (stats!.shotSpread === 3) {
              const angles = [angle - spreadRad, angle, angle + spreadRad];
              angles.forEach(a => pushProj(Math.cos(a), Math.sin(a)));
          }
          // Quad Shot: -22.5, -7.5, +7.5, +22.5 (Wider spread)
          else if (stats!.shotSpread === 4) {
              const angles = [
                  angle - spreadRad * 1.5, 
                  angle - spreadRad * 0.5, 
                  angle + spreadRad * 0.5, 
                  angle + spreadRad * 1.5
              ];
              angles.forEach(a => pushProj(Math.cos(a), Math.sin(a)));
          }
      }
  }

  updateProjectile(p: ProjectileEntity) {
      p.lifeTime -= Math.abs(p.velocity.x) + Math.abs(p.velocity.y); 
      if (p.lifeTime <= 0) {
          p.markedForDeletion = true;
          return;
      }

      // Wall Collision
      if (this.checkWallCollision(p)) {
          p.markedForDeletion = true;
          return;
      }

      // Entity Collision
      if (p.ownerId === 'player') {
           // Hit Enemy
           const enemies = this.entities.filter(e => e.type === EntityType.ENEMY);
           for (const enemy of enemies) {
               if (checkAABB(p, enemy)) {
                   p.markedForDeletion = true;
                   this.damageEnemy(enemy as EnemyEntity, p.damage);
                   return;
               }
           }
      } else {
          // Hit Player
          if (checkAABB(p, this.player)) {
              p.markedForDeletion = true;
              this.damagePlayer(1); 
          }
      }
  }

  updateEnemy(e: EnemyEntity) {
      // Simple AI
      e.timer++;
      const distToPlayer = distance(e, this.player);

      if (e.enemyType === EnemyType.CHASER || (e.enemyType === EnemyType.BOSS && distToPlayer > 100)) {
          if (e.timer % 5 === 0) { // Re-path occasionally
            const dir = normalizeVector({ x: this.player.x - e.x, y: this.player.y - e.y });
            e.velocity = { x: dir.x * 0.6, y: dir.y * 0.6 };
          }
      } 
      else if (e.enemyType === EnemyType.TANK) {
          // Very slow, follows relentlessly
          if (e.timer % 10 === 0) {
             const dir = normalizeVector({ x: this.player.x - e.x, y: this.player.y - e.y });
             e.velocity = { x: dir.x * 0.3, y: dir.y * 0.3 };
          }
      }
      else if (e.enemyType === EnemyType.ORBITER) {
          // Circle the player
          if (!e.orbitAngle) e.orbitAngle = 0;
          e.orbitAngle += 0.02; // Rotate speed
          const orbitDist = 150;
          const targetX = this.player.x + Math.cos(e.orbitAngle) * orbitDist;
          const targetY = this.player.y + Math.sin(e.orbitAngle) * orbitDist;
          
          // Move towards orbit position
          const dx = targetX - e.x;
          const dy = targetY - e.y;
          e.velocity = { x: dx * 0.05, y: dy * 0.05 };
      }
      else if (e.enemyType === EnemyType.SHOOTER) {
          e.velocity = { x: 0, y: 0 };
          if (e.timer % 120 === 0 && distToPlayer < 400) {
              const dir = normalizeVector({ x: this.player.x - e.x, y: this.player.y - e.y });
              this.spawnProjectile(e, dir);
          }
      } else if (e.enemyType === EnemyType.DASHER) {
          if (e.aiState === 'IDLE') {
              e.velocity = {x:0,y:0};
              if (e.timer > 60) {
                  e.aiState = 'ATTACK';
                  e.timer = 0;
                  const dir = normalizeVector({ x: this.player.x - e.x, y: this.player.y - e.y });
                  e.velocity = { x: dir.x * 2.4, y: dir.y * 2.4 }; // Dash speed reduced
              }
          } else if (e.aiState === 'ATTACK') {
              if (e.timer > 20) {
                  e.aiState = 'IDLE';
                  e.timer = 0;
              }
          }
      }

      this.resolveWallCollision(e);
      
      // Contact Damage
      if (checkAABB(e, this.player)) {
          this.damagePlayer(1);
      }
  }

  damagePlayer(amount: number) {
      if (this.player.invincibleTimer > 0) return;
      this.player.stats.hp -= amount;
      this.player.invincibleTimer = 60; // 1 sec invincibility
      this.player.color = CONSTANTS.COLORS.PLAYER_HIT;
      setTimeout(() => this.player.color = CONSTANTS.COLORS.PLAYER, 200);

      if (this.player.stats.hp <= 0) {
          this.status = GameStatus.GAME_OVER;
      }
  }

  damageEnemy(e: EnemyEntity, amount: number) {
      e.hp -= amount;
      e.x += (Math.random() - 0.5) * 5; // Shake/Knockback
      e.y += (Math.random() - 0.5) * 5;
      
      if (e.hp <= 0) {
          e.markedForDeletion = true;
          this.score += e.maxHp * 10;
          
          if (e.enemyType === EnemyType.BOSS) {
               // Boss logic
          }
      }
  }

  collectItem(item: ItemEntity) {
      item.markedForDeletion = true;
      this.player.inventory.push(item.itemType);
      
      // Mark as collected in the room data for persistence
      if (this.currentRoom) {
          this.currentRoom.itemCollected = true;
          // Unlock doors if in item room
          if (this.currentRoom.type === 'ITEM') {
               this.currentRoom.cleared = true;
               carveDoors(this.currentRoom.layout, this.currentRoom.doors);
          }
      }

      // Show notification
      this.notification = `${item.name}: ${item.description}`;
      this.notificationTimer = 180; // 3 seconds
      
      // Apply stats
      const s = this.player.stats;
      switch(item.itemType) {
          case ItemType.HP_UP: 
              s.maxHp += 2; 
              s.hp = Math.min(s.hp + 2, s.maxHp); 
              break;
          case ItemType.DAMAGE_UP: 
              s.damage *= 1.1; 
              break;
          case ItemType.SPEED_UP: s.speed += 0.5; break;
          case ItemType.FIRE_RATE_UP: s.fireRate = Math.max(5, s.fireRate * 0.8); break; // 20% reduction (faster)
          case ItemType.SHOT_SPEED_UP: s.shotSpeed += 1.5; break;
          case ItemType.RANGE_UP: s.range *= 1.2; break;
          case ItemType.BULLET_SIZE_UP: s.bulletScale += 0.5; break;
          case ItemType.TRIPLE_SHOT: s.shotSpread = 3; break;
          case ItemType.QUAD_SHOT: s.shotSpread = 4; break;
      }
  }

  // --- Physics Helpers ---
  resolveWallCollision(ent: Entity) {
      const ts = CONSTANTS.TILE_SIZE;
      const map = this.currentRoom!.layout;

      // Improved "2.5D" Feet Collision Logic
      const getFeetRect = (x: number, y: number): Rect => ({
          x: x + 4, // Slight horizontal padding to avoid sticky sliding
          y: y + ent.h * 0.5, // Start from middle of sprite
          w: ent.w - 8,
          h: ent.h * 0.5
      });

      // Predict next position
      const nextX = ent.x + ent.velocity.x;
      const nextY = ent.y + ent.velocity.y;

      // Check Feet Box against the tile map
      const checkCollision = (rect: Rect) => {
          // Check 4 corners of the feet rect
          const points = [
              {x: rect.x, y: rect.y},
              {x: rect.x + rect.w, y: rect.y},
              {x: rect.x, y: rect.y + rect.h},
              {x: rect.x + rect.w, y: rect.y + rect.h}
          ];

          for (const p of points) {
              const c = Math.floor(p.x / ts);
              const r = Math.floor(p.y / ts);
              if (r < 0 || r >= map.length || c < 0 || c >= map[0].length) return true;
              const tile = map[r][c];
              if (tile === 1 || tile === 2) return true;
          }
          return false;
      };

      // X Axis
      const feetX = getFeetRect(nextX, ent.y);
      if (!checkCollision(feetX)) {
          ent.x = nextX;
      }

      // Y Axis
      const feetY = getFeetRect(ent.x, nextY); // Use updated X if it moved
      if (!checkCollision(feetY)) {
          ent.y = nextY;
      }
  }

  checkWallCollision(ent: Entity): boolean {
      // Simplified for projectiles - strict center point check is usually fine for bullets
      const ts = CONSTANTS.TILE_SIZE;
      const map = this.currentRoom!.layout;
      const c = Math.floor((ent.x + ent.w/2) / ts);
      const r = Math.floor((ent.y + ent.h/2) / ts);
      if (r < 0 || r >= map.length || c < 0 || c >= map[0].length) return true;
      return (map[r][c] === 1 || map[r][c] === 2);
  }

  checkDoorCollisions() {
      if (!this.currentRoom) return;
      const p = this.player;
      const w = CONSTANTS.CANVAS_WIDTH;
      const h = CONSTANTS.CANVAS_HEIGHT;
      const ts = CONSTANTS.TILE_SIZE;
      const doors = this.currentRoom.doors;

      let triggerDir: Direction | null = null;
      let nextX = this.currentRoom.x;
      let nextY = this.currentRoom.y;

      // STRICT Collision Check: Player must overlap with door physically
      const cx = w / 2;
      const cy = h / 2;
      const doorSpan = ts * 1.5; 
      
      const pCx = p.x + p.w / 2;
      const pCy = p.y + p.h / 2;

      // UP (must overlap horizontally with center)
      if (doors.UP && p.y < ts && Math.abs(pCx - cx) < doorSpan) { 
          triggerDir = Direction.UP; nextY--; 
      }
      // DOWN
      if (doors.DOWN && p.y > h - ts - p.h && Math.abs(pCx - cx) < doorSpan) { 
          triggerDir = Direction.DOWN; nextY++; 
      }
      // LEFT (must overlap vertically with center)
      if (doors.LEFT && p.x < ts && Math.abs(pCy - cy) < doorSpan) { 
          triggerDir = Direction.LEFT; nextX--; 
      }
      // RIGHT
      if (doors.RIGHT && p.x > w - ts - p.w && Math.abs(pCy - cy) < doorSpan) { 
          triggerDir = Direction.RIGHT; nextX++; 
      }

      if (triggerDir) {
          const nextRoom = this.dungeon.find(r => r.x === nextX && r.y === nextY);
          // Only enter if the next room exists (Strict door logic)
          if (nextRoom) {
              // Pass the TRIGGER direction (Movement direction)
              this.enterRoom(nextRoom, triggerDir);
          }
      }
  }

  draw() {
      // Clear
      this.ctx.fillStyle = CONSTANTS.COLORS.BG;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      if (!this.currentRoom) return;

      // Draw Room Tiles
      const ts = CONSTANTS.TILE_SIZE;
      const map = this.currentRoom.layout;

      const visualMap = carveDoors(map.map(r => [...r]), this.currentRoom.cleared ? this.currentRoom.doors : {});

      for (let r = 0; r < visualMap.length; r++) {
          for (let c = 0; c < visualMap[0].length; c++) {
              const tile = visualMap[r][c];
              const x = c * ts;
              const y = r * ts;

              if (tile === 1) { // Wall
                  this.ctx.fillStyle = CONSTANTS.COLORS.WALL;
                  this.ctx.fillRect(x, y, ts, ts);
              } else if (tile === 2) { // Rock
                  this.ctx.fillStyle = CONSTANTS.COLORS.FLOOR; // Floor under rock
                  this.ctx.fillRect(x, y, ts, ts);
                  this.ctx.fillStyle = CONSTANTS.COLORS.ROCK;
                  this.ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
              } else if (tile === 3) { // Door floor
                  this.ctx.fillStyle = CONSTANTS.COLORS.DOOR_OPEN;
                  this.ctx.fillRect(x, y, ts, ts);
              } else { // Floor
                  this.ctx.fillStyle = CONSTANTS.COLORS.FLOOR;
                  this.ctx.fillRect(x, y, ts, ts);
                  // Grid detail
                  this.ctx.strokeStyle = '#2a2a2a';
                  this.ctx.strokeRect(x,y,ts,ts);
              }
          }
      }

      // Draw Doors (Locked/Closed) and Arrows
      const doors = this.currentRoom.doors;
      const cx = Math.floor(visualMap[0].length / 2) * ts;
      const cy = Math.floor(visualMap.length / 2) * ts;

      // Draw Door Locks (if not cleared)
      if (!this.currentRoom.cleared) {
          this.ctx.fillStyle = CONSTANTS.COLORS.DOOR;
          
          // STRICT check: only draw if the door direction has a room (doors.KEY is true)
          if(doors.UP) this.ctx.fillRect(cx, 0, ts, ts);
          if(doors.DOWN) this.ctx.fillRect(cx, this.canvas.height - ts, ts, ts);
          if(doors.LEFT) this.ctx.fillRect(0, cy, ts, ts);
          if(doors.RIGHT) this.ctx.fillRect(this.canvas.width - ts, cy, ts, ts);
      }

      // Draw Direction Arrows (If door exists, even if cleared)
      // New feature: 50% opacity arrows
      this.ctx.save();
      this.ctx.globalAlpha = 0.5;
      this.ctx.fillStyle = '#FFFFFF';
      
      const arrowSize = 10;
      
      if (doors.UP) {
        this.ctx.beginPath();
        this.ctx.moveTo(cx + ts/2, 10);
        this.ctx.lineTo(cx + ts/2 - arrowSize, 10 + arrowSize);
        this.ctx.lineTo(cx + ts/2 + arrowSize, 10 + arrowSize);
        this.ctx.fill();
      }
      if (doors.DOWN) {
        this.ctx.beginPath();
        this.ctx.moveTo(cx + ts/2, this.canvas.height - 10);
        this.ctx.lineTo(cx + ts/2 - arrowSize, this.canvas.height - 10 - arrowSize);
        this.ctx.lineTo(cx + ts/2 + arrowSize, this.canvas.height - 10 - arrowSize);
        this.ctx.fill();
      }
      if (doors.LEFT) {
        this.ctx.beginPath();
        this.ctx.moveTo(10, cy + ts/2);
        this.ctx.lineTo(10 + arrowSize, cy + ts/2 - arrowSize);
        this.ctx.lineTo(10 + arrowSize, cy + ts/2 + arrowSize);
        this.ctx.fill();
      }
      if (doors.RIGHT) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width - 10, cy + ts/2);
        this.ctx.lineTo(this.canvas.width - 10 - arrowSize, cy + ts/2 - arrowSize);
        this.ctx.lineTo(this.canvas.width - 10 - arrowSize, cy + ts/2 + arrowSize);
        this.ctx.fill();
      }
      this.ctx.restore();


      // Entities
      [...this.entities, this.player].forEach(e => {
          this.ctx.fillStyle = e.color;
          if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) {
             this.ctx.fillRect(e.x, e.y, e.w, e.h);
             // HP Bar for Boss
             if ((e as EnemyEntity).enemyType === EnemyType.BOSS) {
                 this.ctx.fillStyle = 'red';
                 this.ctx.fillRect(e.x, e.y - 10, e.w * ((e as EnemyEntity).hp / (e as EnemyEntity).maxHp), 5);
             }
          } else if (e.type === EntityType.PROJECTILE) {
             this.ctx.beginPath();
             this.ctx.arc(e.x + e.w/2, e.y + e.h/2, e.w/2, 0, Math.PI * 2);
             this.ctx.fill();
          } else if (e.type === EntityType.ITEM) {
             this.ctx.fillRect(e.x, e.y, e.w, e.h);
             this.ctx.fillStyle = 'white';
             this.ctx.font = '10px monospace';
             this.ctx.fillText("?", e.x + 6, e.y + 16);
          } else if (e.type === EntityType.TRAPDOOR) {
              // Draw trapdoor
              this.ctx.fillStyle = 'black';
              this.ctx.fillRect(e.x, e.y, e.w, e.h);
              this.ctx.strokeStyle = '#333';
              this.ctx.strokeRect(e.x, e.y, e.w, e.h);
              // Hatch lines
              this.ctx.beginPath();
              this.ctx.moveTo(e.x, e.y); this.ctx.lineTo(e.x + e.w, e.y + e.h);
              this.ctx.moveTo(e.x + e.w, e.y); this.ctx.lineTo(e.x, e.y + e.h);
              this.ctx.stroke();
          }
      });
      
      // Draw Restart Overlay
      if (this.restartTimer > 0) {
           this.ctx.save();
           this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
           this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
           
           this.ctx.fillStyle = 'white';
           this.ctx.font = 'bold 20px monospace';
           this.ctx.textAlign = 'center';
           this.ctx.textBaseline = 'middle';
           this.ctx.fillText("HOLD R TO RESTART", this.canvas.width/2, this.canvas.height/2 - 20);
           
           // Bar
           const maxW = 200;
           const h = 10;
           const pct = Math.min(this.restartTimer / 60, 1);
           
           this.ctx.fillStyle = '#333';
           this.ctx.fillRect(this.canvas.width/2 - maxW/2, this.canvas.height/2 + 10, maxW, h);
           this.ctx.fillStyle = '#ef4444'; // Red
           this.ctx.fillRect(this.canvas.width/2 - maxW/2, this.canvas.height/2 + 10, maxW * pct, h);
           
           this.ctx.restore();
      }
  }
}