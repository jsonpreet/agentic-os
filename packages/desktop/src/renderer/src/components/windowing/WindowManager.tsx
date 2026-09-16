import React, { useState, useEffect, useRef } from 'react';
import {
  AgentSession,
  AgentInstruction,
  WindowLayout
} from '@agentic/shared-contracts';
import { AgentTerminalWindow } from '../terminal/AgentTerminalWindow.js';

interface WindowManagerProps {
  desktopId: string;
  agentSessions: AgentSession[];
  queues: Record<string, AgentInstruction[]>;
  onRenameAgent: (sessionId: string, newName: string) => void;
  onTerminateAgent: (sessionId: string) => void;
  onInterruptAgent: (sessionId: string) => void;
  onCancelInstruction: (instructionId: string) => void;
}

export const WindowManager: React.FC<WindowManagerProps> = ({
  desktopId,
  agentSessions,
  queues,
  onRenameAgent,
  onTerminateAgent,
  onInterruptAgent,
  onCancelInstruction
}) => {
  const [layouts, setLayouts] = useState<Record<string, WindowLayout>>({});
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active sessions in current desktop
  const desktopSessions = agentSessions.filter(
    (s) => s.desktopId === desktopId && s.status !== 'terminated'
  );

  // Load layouts from DB
  useEffect(() => {
    if (!window.agenticApi || !desktopId) return;

    window.agenticApi.getWindowLayouts(desktopId).then((saved) => {
      const layoutMap: Record<string, WindowLayout> = {};
      for (const l of saved) {
        layoutMap[l.windowId] = l;
      }
      setLayouts(layoutMap);
    });
  }, [desktopId]);

  // Ensure default layout for new windows
  useEffect(() => {
    setLayouts((prev) => {
      const updated = { ...prev };
      let changed = false;

      desktopSessions.forEach((session, idx) => {
        if (!updated[session.id]) {
          const cascadeOffset = (idx % 6) * 32;
          const defaultLayout: WindowLayout = {
            windowId: session.id,
            desktopId,
            x: 64 + cascadeOffset,
            y: 32 + cascadeOffset,
            width: 720,
            height: 480,
            state: 'normal',
            zIndex: idx + 1,
            updatedAt: Date.now()
          };
          updated[session.id] = defaultLayout;
          changed = true;
          window.agenticApi?.saveWindowLayout(defaultLayout);
        }
      });

      return changed ? updated : prev;
    });
  }, [desktopSessions, desktopId]);

  const bringToFront = (windowId: string) => {
    setFocusedWindowId(windowId);
    setLayouts((prev) => {
      const current = prev[windowId];
      if (!current) return prev;
      const maxZ = Math.max(1, ...Object.values(prev).map((l) => l.zIndex));
      if (current.zIndex === maxZ) return prev;

      const updated = { ...current, zIndex: maxZ + 1, updatedAt: Date.now() };
      window.agenticApi?.saveWindowLayout(updated);
      return { ...prev, [windowId]: updated };
    });
  };

  const handleStartDrag = (
    e: React.MouseEvent,
    windowId: string,
    initialX: number,
    initialY: number
  ) => {
    e.preventDefault();
    bringToFront(windowId);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;

      const newX = Math.max(10, initialX + deltaX);
      const newY = Math.max(10, initialY + deltaY);

      setLayouts((prev) => {
        const win = prev[windowId];
        if (!win) return prev;
        return {
          ...prev,
          [windowId]: { ...win, x: newX, y: newY }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setLayouts((prev) => {
        const win = prev[windowId];
        if (win) {
          window.agenticApi?.saveWindowLayout(win);
        }
        return prev;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleStartResize = (
    e: React.MouseEvent,
    windowId: string,
    initialW: number,
    initialH: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(windowId);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newW = Math.max(480, initialW + (moveEvent.clientX - startMouseX));
      const newH = Math.max(300, initialH + (moveEvent.clientY - startMouseY));

      setLayouts((prev) => {
        const win = prev[windowId];
        if (!win) return prev;
        return {
          ...prev,
          [windowId]: { ...win, width: newW, height: newH }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setLayouts((prev) => {
        const win = prev[windowId];
        if (win) {
          window.agenticApi?.saveWindowLayout(win);
        }
        return prev;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleMinimize = (windowId: string) => {
    setLayouts((prev) => {
      const win = prev[windowId];
      if (!win) return prev;
      const updated: WindowLayout = { ...win, state: 'minimized', updatedAt: Date.now() };
      window.agenticApi?.saveWindowLayout(updated);
      return { ...prev, [windowId]: updated };
    });
  };

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden">
      {desktopSessions.map((session) => {
        const layout = layouts[session.id] || {
          x: 64,
          y: 32,
          width: 720,
          height: 480,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') {
          return null; // Minimized window rendered as icon in the dock
        }

        const isFocused = focusedWindowId === session.id;

        return (
          <div
            key={session.id}
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(session.id)}
          >
            {/* Draggable header trigger overlay */}
            <div
              onMouseDown={(e) => handleStartDrag(e, session.id, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />

            <AgentTerminalWindow
              session={session}
              queue={queues[session.id] || []}
              isFocused={isFocused}
              onFocus={() => bringToFront(session.id)}
              onMinimize={() => handleMinimize(session.id)}
              onClose={() => onTerminateAgent(session.id)}
              onRename={(newName) => onRenameAgent(session.id, newName)}
              onInterrupt={() => onInterruptAgent(session.id)}
              onCancelInstruction={onCancelInstruction}
            />

            {/* Resize handle in bottom-right corner */}
            <div
              onMouseDown={(e) =>
                handleStartResize(e, session.id, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })}

      {desktopSessions.length === 0 && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 pointer-events-none select-none">
          <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center mb-3 border border-white/5">
            <span className="text-xl">🤖</span>
          </div>
          <h3 className="text-sm font-semibold text-zinc-300">No agents on this desktop</h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            Type an instruction in the prompt dock below (e.g. &ldquo;Hey Tim, build the homepage&rdquo;) to launch an agent in an isolated worktree.
          </p>
        </div>
      )}
    </div>
  );
};
