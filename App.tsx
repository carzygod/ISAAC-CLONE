import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game';
import { InputManager } from './utils';
import { GameStatus, Stats } from './types';
import { CONSTANTS } from './constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const requestRef = useRef<number>();

  const [gameStats, setGameStats] = useState<{
    hp: number; 
    maxHp: number; 
    floor: number; 
    score: number; 
    items: number;
    notification: string | null;
    dungeon: {x:number, y:number, type: string, visited: boolean}[];
    currentRoomPos: {x:number, y:number};
  } | null>(null);
  
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);

  // Initialize Game
  useEffect(() => {
    if (!canvasRef.current) return;

    inputRef.current = new InputManager();
    engineRef.current = new GameEngine(canvasRef.current, (stats) => {
      setGameStats(stats);
      // Sync status heavily to check for Game Over
      if (engineRef.current?.status !== status) {
        setStatus(engineRef.current?.status || GameStatus.MENU);
      }
    });

    const loop = () => {
      if (engineRef.current && inputRef.current) {
        const move = inputRef.current.getMovementVector();
        const shoot = inputRef.current.getShootingDirection();
        const restart = inputRef.current.keys['KeyR'] || false;
        
        engineRef.current.update({ move, shoot, restart });
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
  }, []);

  const startGame = () => {
    if (engineRef.current) {
      engineRef.current.startNewGame();
      setStatus(GameStatus.PLAYING);
      // Focus canvas for key events
      canvasRef.current?.focus();
    }
  };

  // UI Helpers
  const renderHearts = () => {
    if (!gameStats) return null;
    const hearts = [];
    const count = Math.ceil(gameStats.maxHp / 2);
    for(let i=0; i<count; i++) {
        const val = gameStats.hp - (i*2);
        let color = 'bg-gray-800'; // empty
        if (val >= 2) color = 'bg-red-600'; // full
        else if (val === 1) color = 'bg-red-900'; // half (simulated by darker red here)
        
        hearts.push(
            <div key={i} className={`w-6 h-6 rounded-sm ${color} border-2 border-red-950 mr-1 shadow-md`}></div>
        );
    }
    return <div className="flex">{hearts}</div>;
  };

  const renderMinimap = () => {
      if (!gameStats || !gameStats.dungeon) return null;

      // Find bounds
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white font-mono">
      
      {/* HUD */}
      {status === GameStatus.PLAYING && gameStats && (
        <div className="w-full max-w-3xl flex justify-between items-start mb-2 px-4 h-24">
          <div className="flex flex-col justify-end h-full">
            <div className="text-xs text-gray-400 mb-1">HEALTH</div>
            {renderHearts()}
          </div>
          
          <div className="text-center pt-4 flex flex-col items-center">
            <div className="text-2xl font-bold text-amber-500">FLOOR {gameStats.floor}</div>
            <div className="text-xs text-gray-400">SCORE: {gameStats.score}</div>
          </div>
          
          <div className="flex flex-col items-end h-full">
             <div className="text-xs text-gray-400 mb-1">MAP</div>
             {renderMinimap()}
             
             <div className="flex gap-1 justify-end mt-2">
                {Array.from({length: gameStats.items}).map((_, i) => (
                    <div key={i} className="w-4 h-4 bg-purple-500 border border-purple-300"></div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Game Container */}
      <div className="relative group">
        <canvas
          ref={canvasRef}
          className="bg-black border-4 border-neutral-700 shadow-2xl rounded-sm cursor-none"
          style={{ width: CONSTANTS.CANVAS_WIDTH, height: CONSTANTS.CANVAS_HEIGHT }}
        />

        {/* Item Notification Overlay */}
        {gameStats?.notification && (
           <div className="absolute top-10 left-0 right-0 flex justify-center pointer-events-none animate-bounce">
              <div className="bg-black/80 border border-white/20 px-4 py-2 rounded text-amber-300 font-bold shadow-lg">
                  {gameStats.notification}
              </div>
           </div>
        )}
        
        {/* Main Menu Overlay */}
        {status === GameStatus.MENU && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center">
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">PIXEL CRAWLER</h1>
            <p className="text-gray-400 mb-8 max-w-md">
              WASD to Move. Arrow Keys to Shoot. <br/>
              Clear rooms, collect items, defeat the boss.
            </p>
            <button 
              onClick={startGame}
              className="px-8 py-3 bg-white text-black font-bold text-xl hover:bg-gray-200 active:scale-95 transition-transform"
            >
              START RUN
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center p-8 text-center">
            <h1 className="text-6xl font-black text-white mb-2">YOU DIED</h1>
            <p className="text-red-200 text-xl mb-8">
              Floor reached: {gameStats?.floor} <br/>
              Score: {gameStats?.score}
            </p>
            <button 
              onClick={startGame}
              className="px-8 py-3 bg-red-500 text-white font-bold text-xl hover:bg-red-400 active:scale-95 transition-transform"
            >
              TRY AGAIN
            </button>
            <p className="text-white/50 mt-4 text-sm">Hold 'R' to Quick Restart</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-neutral-600">
        Engine: React + Canvas 2D | GenAI Prototype
      </div>
    </div>
  );
}