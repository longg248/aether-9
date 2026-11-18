import { GRID_SIZE } from '@/constants/gameConfig';
import { MINIMAP_SIZE, worldToMinimap } from '@/engine/rendering/minimap';
import { POI_CONFIG } from '@/engine/systems/poiSystem';
import { MinimapSnapshot } from '@/types/game';

export function Minimap({ snapshot }: { snapshot: MinimapSnapshot }) {
  const { width, height } = MINIMAP_SIZE;
  const tileWidth = width / GRID_SIZE;
  const tileHeight = height / GRID_SIZE;
  const revealPath = snapshot.revealedTiles
    .map(({ gx, gy }) => {
      const x = gx * tileWidth;
      const y = gy * tileHeight;
      return `M${x} ${y}h${tileWidth}v${tileHeight}H${x}z`;
    })
    .join('');
  const hub = worldToMinimap(snapshot.hub);
  const rover = worldToMinimap(snapshot.rover);

  return (
    <div className="pointer-events-none absolute bottom-48 right-4 z-20 rounded-xl border border-slate-700/90 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-md">
      <svg
        className="block h-40 w-40"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Bản đồ chiến thuật"
      >
        <rect width={width} height={height} rx={4} fill="#020617" />
        <path d={revealPath} fill="#38bdf8" opacity={0.16} />
        <rect x={hub.x - 3} y={hub.y - 3} width={6} height={6} fill="#38bdf8" stroke="#e0f2fe" strokeWidth={1} />
        {snapshot.pois.map((poi) => {
          const point = worldToMinimap(poi);
          return (
            <circle
              key={poi.id}
              cx={point.x}
              cy={point.y}
              r={2.5}
              fill={poi.completed ? '#64748b' : POI_CONFIG[poi.type].accent}
              stroke="#0f172a"
              strokeWidth={0.75}
            />
          );
        })}
        {snapshot.enemies.map((enemy) => {
          const point = worldToMinimap(enemy);
          return (
            <circle
              key={enemy.id}
              cx={point.x}
              cy={point.y}
              r={enemy.elite ? 2.75 : 2}
              fill={enemy.elite ? '#facc15' : '#fb7185'}
            />
          );
        })}
        <circle cx={rover.x} cy={rover.y} r={3.5} fill="#f8fafc" stroke="#0284c7" strokeWidth={1.5} />
        <rect width={width} height={height} rx={4} fill="none" stroke="#334155" strokeWidth={1} />
      </svg>
    </div>
  );
}
