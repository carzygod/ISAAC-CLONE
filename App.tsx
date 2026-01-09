import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GameEngine } from './game';
import { InputManager } from './utils';
import { GameStatus, Settings, Language, KeyMap, Stats } from './types';
import { CONSTANTS, TRANSLATIONS, DEFAULT_KEYMAP } from './constants';
import { CHARACTERS } from './config/characters';
import { AssetLoader } from './assets';

const PixelHeart: React.FC<{ full: boolean }> = ({ full }) => (
    <svg viewBox="0 0 16 16" className="w-6 h-6 mr-1 drop-shadow-md" style={{imageRendering: 'pixelated'}}>
       <path d="M2 5 h2 v3 h-2 v-3 M4 3 h2 v2 h-2 v-2 M6 3 h4 v2 h-4 v-2 M10 3 h2 v2 h-2 v-2 M12 5 h2 v3 h-2 v-3 M2 8 h2 v3 h-2 v-3 M12 8 h2 v3 h-2 v-3 M4 11 h2 v2 h-2 v-2 M10 11 h2 v2 h-2 v-2 M6 13 h4 v2 h-4 v-2" 
             fill={full ? "#ef4444" : "#4b5563"} /> 
       {/* Highlight */}
       <path d="M4 4 h2 v1 h-2 v-1 M10 4 h1 v1 h-1 v-1" fill={full ? "#fca5a5" : "#6b7280"} opacity="0.6"/>
    </svg>
);

const StatBar: React.FC<{ label: string, value: number, max: number, color: string }> = ({ label, value, max, color }) => (
    <div className="flex items-center gap-2 w-full text-xs">
        <span className="w-10 text-gray-400 font-bold">{label}</span>
        <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
            <div 
                className="h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
            />
        </div>
        <span className="w-6 text-right text-gray-300">{value}</span>
    </div>
);

// Preview component that draws the actual game asset
const SpritePreview: React.FC<{ spriteName: string, assetLoader: AssetLoader }> = ({ spriteName, assetLoader }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const source = assetLoader.get(spriteName);
        if (canvas && source) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Draw scaled up 4x
                ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, canvas.width, canvas.height);
            }
        }
    }, [spriteName, assetLoader]);

    return <canvas ref={canvasRef} width={128} height={128} className="w-24 h-24" style={{imageRendering: 'pixelated'}} />;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const requestRef = useRef<number>(0);

  // Memoize asset loader for UI previews so we don't recreate it
  const uiAssetLoader = useMemo(() => new AssetLoader(), []);

  // Game Data State
  const [gameStats, setGameStats] = useState<{
    hp: number; 
    maxHp: number; 
    floor: number; 
    score: number; 
    seed: number;
    items: number;
    notification: string | null;
    dungeon: {x:number, y:number, type: string, visited: boolean}[];
    currentRoomPos: {x:number, y:number};
    stats?: Stats; // New Full Stats
    nearbyItem?: { name: string, desc: string, x: number, y: number, w: number, h: number } | null;
    boss?: { name: string, hp: number, maxHp: number } | null;
  } | null>(null);
  
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [showSettings, setShowSettings] = useState(false);
  const [waitingForKey, setWaitingForKey] = useState<keyof KeyMap | null>(null);
  const [menuSelection, setMenuSelection] = useState(0); 
  const [selectedCharIndex, setSelectedCharIndex] = useState(0);

  // Settings State
  const [settings, setSettings] = useState<Settings>({
    language: Language.ZH_CN,
    showMinimap: true,
    keyMap: { ...DEFAULT_KEYMAP }
  });

  // Translation Helper
  const t = (key: string) => {
    // If complex format (Key:Desc), split it
    if (key.includes(':')) {
        const parts = key.split(':');
        const name = TRANSLATIONS[settings.language][parts[0]] || parts[0];
        const desc = TRANSLATIONS[settings.language][parts[1]] || parts[1];
        return `${name}: ${desc}`;
    }
    return TRANSLATIONS[settings.language][key] || key;
  };

  // Initialize Game
  useEffect(() => {
    if (!canvasRef.current) return;

    inputRef.current = new InputManager(settings.keyMap);
    engineRef.current = new GameEngine(canvasRef.current, (stats) => {
      setGameStats(stats);
      // Only update local status if it changed significantly to avoid re-renders during gameplay (except PAUSE)
      if (engineRef.current?.status !== status) {
        setStatus(engineRef.current?.status || GameStatus.MENU);
      }
    });

    const loop = () => {
      if (engineRef.current && inputRef.current) {
        // Prevent game input when in Menu
        if (engineRef.current.status === GameStatus.PLAYING) {
            const move = inputRef.current.getMovementVector();
            const shoot = inputRef.current.getShootingDirection();
            const restart = inputRef.current.isRestartPressed();
            const pause = inputRef.current.isPausePressed();
            
            // Pass restart logic to engine
            engineRef.current.update({ move, shoot, restart, pause });
        }
        engineRef.current.draw();
      }
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      inputRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Update InputManager when settings change
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.updateKeyMap(settings.keyMap);
    }
  }, [settings.keyMap]);

  // Key Binding Listener (Settings)
  useEffect(() => {
    if (!waitingForKey) return;

    const handleRebind = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const code = e.code;
      // Simple validation to prevent breaking keys (like Escape)
      if (code === 'Escape') {
          setWaitingForKey(null);
          return;
      }

      setSettings(prev => ({
        ...prev,
        keyMap: {
          ...prev.keyMap,
          [waitingForKey]: code
        }
      }));
      setWaitingForKey(null);
    };

    window.addEventListener('keydown', handleRebind, { once: true });
    return () => window.removeEventListener('keydown', handleRebind);
  }, [waitingForKey]);

  // Menu Navigation Listener
  useEffect(() => {
      if (showSettings) return;
      if (status !== GameStatus.MENU && status !== GameStatus.CHARACTER_SELECT && status !== GameStatus.PAUSED) return;

      const handleMenuNav = (e: KeyboardEvent) => {
          if (status === GameStatus.MENU) {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  setMenuSelection(prev => (prev === 0 ? 1 : 0));
              } else if (e.key === 'Enter') {
                  if (menuSelection === 0) setStatus(GameStatus.CHARACTER_SELECT);
                  else if (menuSelection === 1) setShowSettings(true);
              }
          } 
          else if (status === GameStatus.CHARACTER_SELECT) {
              if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
                  setSelectedCharIndex(prev => (prev - 1 + CHARACTERS.length) % CHARACTERS.length);
              }
              else if (e.key === 'ArrowRight' || e.key === 'KeyD') {
                  setSelectedCharIndex(prev => (prev + 1) % CHARACTERS.length);
              }
              else if (e.key === 'Enter') {
                  startGame();
              }
              else if (e.key === 'Escape') {
                  setStatus(GameStatus.MENU);
              }
          }
          else if (status === GameStatus.PAUSED) {
              if (e.key === 'ArrowUp') {
                  setMenuSelection(prev => (prev - 1 + 3) % 3);
              } else if (e.key === 'ArrowDown') {
                  setMenuSelection(prev => (prev + 1) % 3);
              } else if (e.key === 'Enter') {
                  if (menuSelection === 0) resumeGame();
                  else if (menuSelection === 1) setShowSettings(true);
                  else if (menuSelection === 2) {
                      setStatus(GameStatus.MENU); // Quit to Menu
                  }
              }
          }
      };
      
      window.addEventListener('keydown', handleMenuNav);
      return () => window.removeEventListener('keydown', handleMenuNav);
  }, [status, showSettings, menuSelection]);

  const startGame = () => {
    if (engineRef.current) {
      engineRef.current.startNewGame(CHARACTERS[selectedCharIndex].id);
      setStatus(GameStatus.PLAYING);
      setShowSettings(false);
      canvasRef.current?.focus();
    }
  };
  
  const resumeGame = () => {
      if (engineRef.current) {
          engineRef.current.resumeGame();
          setStatus(GameStatus.PLAYING);
      }
  };

  const copySeed = () => {
      if (gameStats?.seed) {
          navigator.clipboard.writeText(gameStats.seed.toString());
      }
  };

  const renderHearts = () => {
    if (!gameStats) return null;
    const hearts = [];
    const totalHearts = Math.ceil(gameStats.maxHp / 2);
    
    for(let i=0; i<totalHearts; i++) {
        const heartHealth = Math.max(0, Math.min(2, gameStats.hp - (i * 2)));
        const isFull = heartHealth > 0;
        hearts.push(
            <PixelHeart key={i} full={isFull} />
        );
    }
    return <div className="flex">{hearts}</div>;
  };

  const renderMinimap = () => {
      if (!settings.showMinimap || !gameStats || !gameStats.dungeon) return null;

      const xs = gameStats.dungeon.map(r => r.x);
      const ys = gameStats.dungeon.map(r => r.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      const cellSize = 12;

      return (
          <div className="relative bg-black/50 border border-gray-600 p-1" style={{
              width: width * cellSize + 8, 
              height: height * cellSize + 8
          }}>
              {gameStats.dungeon.map((room, i) => {
                  if (!room.visited) return null;
                  const isCurrent = room.x === gameStats.currentRoomPos.x && room.y === gameStats.currentRoomPos.y;
                  let bgColor = 'bg-gray-500';
                  if (room.type === 'BOSS') bgColor = 'bg-red-900';
                  if (room.type === 'ITEM') bgColor = 'bg-yellow-600';
                  if (room.type === 'START') bgColor = 'bg-blue-900';
                  if (isCurrent) bgColor = 'bg-white animate-pulse';

                  return (
                    <div key={i} className={`absolute border border-black ${bgColor}`} style={{
                        width: cellSize,
                        height: cellSize,
                        left: (room.x - minX) * cellSize + 4,
                        top: (room.y - minY) * cellSize + 4
                    }} />
                  );
              })}
          </div>
      );
  };

  const selectedChar = CHARACTERS[selectedCharIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white font-mono select-none">
      
      {/* HUD (Show in Playing and Paused) */}
      {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && gameStats && (
        <div className="w-full max-w-3xl flex justify-between items-start mb-2 px-4 h-24">
          <div className="flex flex-col justify-end h-full">
            <div className="text-xs text-gray-400 mb-1">{t('HEALTH')}</div>
            {renderHearts()}
          </div>
          
          <div className="text-center pt-4 flex flex-col items-center">
            <div className="text-2xl font-bold text-amber-500">{t('FLOOR')} {gameStats.floor}</div>
            <div className="text-xs text-gray-400">{t('SCORE')}: {gameStats.score}</div>
          </div>
          
          <div className="flex flex-col items-end h-full">
             <div className="text-xs text-gray-400 mb-1">{t('MAP')}</div>
             {renderMinimap()}
             
             <div className="flex gap-1 justify-end mt-2">
                <span className="text-xs text-gray-500 mr-2">{t('ITEMS')}</span>
                {Array.from({length: gameStats.items}).map((_, i) => (
                    <div key={i} className="w-4 h-4 bg-purple-500 border border-purple-300"></div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Game Container Wrapper for Relative Positioning */}
      <div className="relative group flex">
        
        {/* SIDEBAR STATS (In Game) */}
        {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && gameStats?.stats && (
            <div className="absolute -left-16 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 bg-black/60 p-2 rounded-l border-y border-l border-gray-700 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2" title="Fire Rate">
                    <span className="text-lg">⚡</span>
                    <span className="text-xs font-bold text-yellow-300">{(60 / gameStats.stats.fireRate).toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2" title="Range">
                    <span className="text-lg">🔭</span>
                    <span className="text-xs font-bold text-green-300">{Math.round(gameStats.stats.range)}</span>
                </div>
                <div className="flex items-center gap-2" title="Move Speed">
                    <span className="text-lg">👟</span>
                    <span className="text-xs font-bold text-blue-300">{gameStats.stats.speed.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2" title="Knockback">
                    <span className="text-lg">🥊</span>
                    <span className="text-xs font-bold text-red-300">{Math.round(gameStats.stats.knockback)}</span>
                </div>
                <div className="flex items-center gap-2" title="Bullet Size">
                    <span className="text-lg">🔵</span>
                    <span className="text-xs font-bold text-cyan-300">{gameStats.stats.bulletScale.toFixed(1)}</span>
                </div>
            </div>
        )}

        <canvas
          ref={canvasRef}
          className="bg-black border-4 border-neutral-700 shadow-2xl rounded-sm cursor-none z-0"
          style={{ width: CONSTANTS.CANVAS_WIDTH, height: CONSTANTS.CANVAS_HEIGHT }}
        />

        {/* Item Notification Overlay */}
        {gameStats?.notification && (
           <div className="absolute top-10 left-0 right-0 flex justify-center pointer-events-none animate-bounce z-20">
              <div className="bg-black/80 border border-white/20 px-4 py-2 rounded text-amber-300 font-bold shadow-lg">
                  {t(gameStats.notification)}
              </div>
           </div>
        )}
        
        {/* BOSS HEALTH BAR OVERLAY */}
        {gameStats?.boss && (
            <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-30">
                <div className="text-red-500 font-bold text-lg mb-1 drop-shadow-md tracking-wider">
                    {gameStats.boss.name}
                </div>
                <div className="w-2/3 h-6 bg-gray-900 border-2 border-red-900 rounded relative overflow-hidden">
                    <div 
                        className="h-full bg-red-600 transition-all duration-200 ease-out"
                        style={{ width: `${(Math.max(0, gameStats.boss.hp) / gameStats.boss.maxHp) * 100}%` }}
                    />
                </div>
            </div>
        )}

        {/* Item Inspection Tooltip */}
        {gameStats?.nearbyItem && (status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
            <div className="absolute z-20 pointer-events-none flex flex-col items-center text-center transition-all duration-200"
                 style={{
                     left: gameStats.nearbyItem.x + gameStats.nearbyItem.w/2,
                     top: gameStats.nearbyItem.y - 40,
                     transform: 'translateX(-50%)'
                 }}
            >
                <div className="bg-black/90 text-white text-xs px-2 py-1 rounded border border-gray-600 shadow-xl whitespace-nowrap backdrop-blur-sm">
                    <div className="font-bold text-amber-400 mb-0.5">{t(gameStats.nearbyItem.name)}</div>
                    <div className="text-[10px] text-gray-300">{t(gameStats.nearbyItem.desc)}</div>
                </div>
                {/* Triangle Pointer */}
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-black/90"></div>
            </div>
        )}
        
        {/* RESTART HINT OVERLAY */}
        {status === GameStatus.PLAYING && engineRef.current && engineRef.current.restartTimer > 0 && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="text-white font-bold text-xl drop-shadow-md">{t('HOLD_R')}</div>
           </div>
        )}
        
        {/* PAUSE MENU OVERLAY */}
        {status === GameStatus.PAUSED && !showSettings && (
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-50">
               <h2 className="text-5xl font-black text-white mb-6 tracking-widest drop-shadow-lg">{t('PAUSE_TITLE')}</h2>
               
               {/* Seed Display */}
               <div className="mb-8 flex items-center gap-2 bg-black/40 px-3 py-1 rounded border border-white/10">
                   <span className="text-xs text-gray-400">SEED:</span>
                   <span className="font-mono text-amber-300 text-sm">{gameStats?.seed}</span>
                   <button onClick={copySeed} className="ml-2 text-xs text-blue-300 hover:text-white" title="Copy Seed">
                       [COPY]
                   </button>
               </div>

               <div className="flex flex-col gap-4 w-64">
                   <button 
                       onClick={resumeGame}
                       onMouseEnter={() => setMenuSelection(0)}
                       className={`px-6 py-3 font-bold text-xl transition-all duration-100 ${
                           menuSelection === 0 
                           ? 'bg-white text-black translate-x-2 border-l-4 border-amber-500' 
                           : 'bg-black/50 text-gray-300 border border-gray-600 hover:bg-gray-800'
                       }`}
                   >
                       {t('RESUME')}
                   </button>
                   <button 
                       onClick={() => setShowSettings(true)}
                       onMouseEnter={() => setMenuSelection(1)}
                       className={`px-6 py-3 font-bold text-xl transition-all duration-100 ${
                           menuSelection === 1
                           ? 'bg-white text-black translate-x-2 border-l-4 border-amber-500' 
                           : 'bg-black/50 text-gray-300 border border-gray-600 hover:bg-gray-800'
                       }`}
                   >
                       {t('SETTINGS')}
                   </button>
                   <button 
                       onClick={() => setStatus(GameStatus.MENU)} // Quit to Menu
                       onMouseEnter={() => setMenuSelection(2)}
                       className={`px-6 py-3 font-bold text-xl transition-all duration-100 ${
                           menuSelection === 2 
                           ? 'bg-red-500 text-white translate-x-2 border-l-4 border-white' 
                           : 'bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-900'
                       }`}
                   >
                       {t('KEY_PAUSE')}
                   </button>
               </div>
               
               <div className="mt-8 text-xs text-gray-500 flex gap-4">
                    <span>↑/↓: Navigate</span>
                    <span>ENTER: Select</span>
               </div>
           </div>
        )}
        
        {/* Main Menu (Title Screen) */}
        {status === GameStatus.MENU && !showSettings && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-40">
            <h1 className="text-7xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{t('GAME_TITLE')}</h1>
            <p className="text-gray-500 text-sm mb-12 tracking-[0.5em]">PIXEL ROGUELIKE</p>
            
            <div className="flex flex-col gap-6 w-72">
              <button 
                onClick={() => setStatus(GameStatus.CHARACTER_SELECT)}
                onMouseEnter={() => setMenuSelection(0)}
                className={`px-8 py-4 font-bold text-xl transition-all duration-200 transform hover:scale-105 ${
                    menuSelection === 0 
                    ? 'bg-white text-black border-l-8 border-amber-500' 
                    : 'bg-gray-900 text-gray-300 border-l-2 border-gray-700 hover:bg-gray-800'
                }`}
              >
                {t('START_RUN').replace(' (↵)', '')}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                onMouseEnter={() => setMenuSelection(1)}
                className={`px-8 py-3 font-bold transition-all duration-200 transform hover:scale-105 ${
                    menuSelection === 1
                    ? 'bg-white text-black border-l-8 border-amber-500' 
                    : 'bg-gray-900 text-gray-500 border-l-2 border-gray-700 hover:bg-gray-800'
                }`}
              >
                {t('SETTINGS')}
              </button>
            </div>
            
            <div className="absolute bottom-8 text-gray-700 text-xs">
                v0.2.0-Alpha | Use Arrow Keys or Mouse
            </div>
          </div>
        )}

        {/* Character Selection Screen */}
        {status === GameStatus.CHARACTER_SELECT && !showSettings && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-40">
            <h2 className="text-3xl font-bold text-amber-500 mb-8 tracking-widest uppercase">{t('START_RUN')}</h2>
            
            <div className="flex items-center gap-12 mb-8">
                {/* Left Arrow */}
                <button 
                    onClick={() => setSelectedCharIndex(prev => (prev - 1 + CHARACTERS.length) % CHARACTERS.length)}
                    className="text-gray-600 hover:text-white text-6xl transition-colors"
                >
                    ‹
                </button>

                {/* Character Card */}
                <div className="w-72 bg-gray-900 border-2 border-amber-500 rounded-xl p-6 flex flex-col items-center shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                    <div className="mb-6 relative">
                        {/* Actual Sprite Preview */}
                        <div className="rounded-full bg-gradient-to-b from-gray-800 to-black p-4 border-4 border-gray-700 shadow-inner">
                             <SpritePreview spriteName={selectedChar.sprite} assetLoader={uiAssetLoader} />
                        </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold text-white mb-2">{t(selectedChar.nameKey)}</h2>
                    <p className="text-xs text-gray-400 mb-6 min-h-[2.5em] flex items-center justify-center italic px-2">
                        "{t(selectedChar.descKey)}"
                    </p>
                    
                    <div className="w-full flex flex-col gap-2 bg-black/50 p-3 rounded-lg border border-white/5">
                        <StatBar label={t('STAT_HP')} value={selectedChar.baseStats.maxHp} max={12} color="#ef4444" />
                        <StatBar label={t('STAT_SPEED')} value={selectedChar.baseStats.speed} max={2.5} color="#3b82f6" />
                        <StatBar label={t('STAT_DMG')} value={selectedChar.baseStats.damage} max={8} color="#eab308" />
                        <StatBar label={t('STAT_RATE')} value={100 - selectedChar.baseStats.fireRate} max={100} color="#a855f7" />
                        <StatBar label={t('STAT_RANGE')} value={selectedChar.baseStats.range} max={800} color="#22c55e" />
                    </div>
                </div>

                {/* Right Arrow */}
                <button 
                    onClick={() => setSelectedCharIndex(prev => (prev + 1) % CHARACTERS.length)}
                    className="text-gray-600 hover:text-white text-6xl transition-colors"
                >
                    ›
                </button>
            </div>

            <div className="flex gap-4">
                <button 
                    onClick={() => setStatus(GameStatus.MENU)}
                    className="px-6 py-2 border border-gray-700 text-gray-500 hover:text-white hover:border-gray-500 rounded transition-colors"
                >
                    BACK (ESC)
                </button>
                <button 
                    onClick={startGame}
                    className="px-10 py-2 bg-amber-600 text-white font-bold rounded shadow-lg hover:bg-amber-500 transition-transform active:scale-95"
                >
                    START (ENTER)
                </button>
            </div>
          </div>
        )}

        {/* Settings Overlay */}
        {showSettings && (
          <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-8 z-50">
             <h2 className="text-3xl font-bold text-amber-500 mb-6">{t('SETTING_TITLE')}</h2>
             
             <div className="w-full max-w-md h-80 overflow-y-auto pr-2 custom-scrollbar">
                {/* Language */}
                <div className="mb-4">
                    <label className="block text-gray-400 text-sm mb-1">{t('SETTING_LANG')}</label>
                    <div className="flex gap-2">
                        {Object.values(Language).map(lang => (
                            <button
                                key={lang}
                                onClick={() => setSettings(s => ({...s, language: lang}))}
                                className={`px-3 py-1 text-sm border ${settings.language === lang ? 'bg-amber-600 border-amber-600 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
                            >
                                {lang === Language.ZH_CN ? '简' : lang === Language.ZH_TW ? '繁' : lang === Language.EN ? 'EN' : 'RU'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Minimap */}
                <div className="mb-6 flex items-center justify-between">
                    <label className="text-gray-400 text-sm">{t('SETTING_MINIMAP')}</label>
                    <button 
                        onClick={() => setSettings(s => ({...s, showMinimap: !s.showMinimap}))}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showMinimap ? 'bg-green-600' : 'bg-gray-700'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${settings.showMinimap ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* Key Bindings */}
                <h3 className="text-lg font-bold text-white mb-2 border-b border-gray-700 pb-1">{t('SETTING_KEYS')}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {Object.keys(DEFAULT_KEYMAP).map((key) => {
                       const mapKey = key as keyof KeyMap;
                       return (
                         <div key={key} className="flex justify-between items-center bg-white/5 p-2 rounded">
                            <span className="text-gray-400">{t(`KEY_${mapKey.replace(/([A-Z])/g, '_$1').toUpperCase()}`)}</span>
                            <button 
                                onClick={() => setWaitingForKey(mapKey)}
                                className={`px-2 py-1 min-w-[60px] text-center font-mono text-xs border rounded ${waitingForKey === mapKey ? 'bg-amber-500 text-black border-amber-500 animate-pulse' : 'bg-black text-amber-200 border-gray-600 hover:border-white'}`}
                            >
                                {waitingForKey === mapKey ? '...' : settings.keyMap[mapKey]}
                            </button>
                         </div>
                       );
                    })}
                </div>
             </div>

             {waitingForKey && <div className="mt-4 text-amber-400 font-bold animate-bounce">{t('WAITING_FOR_KEY')}</div>}

             <button 
                onClick={() => setShowSettings(false)}
                className="mt-6 px-8 py-2 bg-white text-black font-bold hover:bg-gray-200"
             >
                {t('CLOSE')}
             </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center p-8 text-center z-40">
            <h1 className="text-6xl font-black text-white mb-2">{t('GAME_OVER')}</h1>
            <p className="text-red-200 text-xl mb-8">
              {t('FLOOR')}: {gameStats?.floor} <br/>
              {t('SCORE')}: {gameStats?.score}
            </p>
            <button 
              onClick={startGame} // Note: This restarts with the PREVIOUSLY selected character stored in engine or state
              className="px-8 py-3 bg-red-500 text-white font-bold text-xl hover:bg-red-400 active:scale-95 transition-transform"
            >
              {t('TRY_AGAIN')}
            </button>
            <p className="text-white/50 mt-4 text-sm">{t('RESTART_HINT')}</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-neutral-600">
        Engine: React + Canvas 2D | GenAI Prototype
      </div>
    </div>
  );
}