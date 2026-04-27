import { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Play, Pause, SkipForward } from 'lucide-react';

type Props = {
  tca: string;
  onScrub: (t: Date | null) => void;
};

export function TimeScrubBar({ tca, onScrub }: Props) {
  const tcaDate = new Date(tca);
  const nowMs = Date.now();
  const endMs = tcaDate.getTime() + 3600000; // TCA + 1 hour
  const totalRange = endMs - nowMs;

  const [position, setPosition] = useState(0); // 0-1
  const [isLive, setIsLive] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const scrubToPosition = useCallback(
    (pos: number) => {
      const clamped = Math.max(0, Math.min(1, pos));
      setPosition(clamped);
      if (clamped === 0) {
        setIsLive(true);
        onScrub(null);
      } else {
        setIsLive(false);
        const targetMs = nowMs + clamped * totalRange;
        onScrub(new Date(targetMs));
      }
    },
    [nowMs, totalRange, onScrub]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = (e.clientX - rect.left) / rect.width;
      scrubToPosition(pos);
    },
    [scrubToPosition]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    handleTrackClick(e as React.MouseEvent<HTMLDivElement>);
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pos = (ev.clientX - rect.left) / rect.width;
      scrubToPosition(pos);
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const currentMs = nowMs + position * totalRange;
  const currentTime = format(new Date(currentMs), 'HH:mm:ss');
  const tcaTime = format(tcaDate, 'HH:mm') + ' UTC';
  const tcaPos = Math.max(0, Math.min(1, (tcaDate.getTime() - nowMs) / totalRange));

  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-2"
      style={{
        background: 'linear-gradient(to top, rgba(10, 14, 20, 0.95) 0%, rgba(10, 14, 20, 0.6) 80%, transparent 100%)',
      }}
    >
      {/* Time labels */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="font-mono text-xs tabular" style={{ color: 'var(--text-tertiary)' }}>
          NOW {format(new Date(), 'HH:mm')} UTC
        </span>
        <div className="flex items-center gap-1.5">
          {!isLive && (
            <span className="font-mono text-xs tabular" style={{ color: 'var(--accent-amber)' }}>
              T {currentTime} UTC
            </span>
          )}
          {isLive && (
            <span
              className="font-mono text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0, 230, 118, 0.15)', color: 'var(--accent-green)' }}
            >
              ● LIVE
            </span>
          )}
        </div>
        <span className="font-mono text-xs tabular" style={{ color: 'var(--accent-red)' }}>
          TCA {tcaTime} +1h
        </span>
      </div>

      {/* Track */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setIsLive(true); setPosition(0); onScrub(null); }}
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{
            color: isLive ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
            background: isLive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
          }}
        >
          {isLive ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <div
          ref={trackRef}
          className="relative flex-1 h-1.5 rounded-full cursor-pointer"
          style={{ background: 'var(--border-default)' }}
          onMouseDown={handleMouseDown}
          onClick={handleTrackClick}
        >
          {/* Filled portion */}
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${position * 100}%`,
              background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-amber))',
            }}
          />

          {/* TCA marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${tcaPos * 100}%` }}
          >
            <div
              className="w-0.5 absolute"
              style={{ height: 16, top: -6, background: 'var(--accent-red)', opacity: 0.8 }}
            />
            <div
              className="absolute -translate-x-1/2"
              style={{
                top: 10, fontSize: 9,
                color: 'var(--accent-red)',
                fontFamily: 'JetBrains Mono',
                whiteSpace: 'nowrap',
              }}
            >
              TCA
            </div>
          </div>

          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
            style={{
              left: `${position * 100}%`,
              background: 'var(--text-primary)',
              border: '2px solid var(--accent-cyan)',
              boxShadow: '0 0 6px rgba(0, 212, 255, 0.5)',
            }}
          />
        </div>

        <button
          onClick={() => scrubToPosition(tcaPos)}
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          title="Jump to TCA"
        >
          <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
}
