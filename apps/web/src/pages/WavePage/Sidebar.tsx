import { useMemo, useState } from "react";
import { Button, Input, Sparkle } from "../../components/ui/index";
import { SearchIcon } from "./icons";
import { waveSubtitle, waveTitle, type Wave } from "./types";

const SHAPES = ["a", "b", "c"] as const;

export interface SidebarProps {
  waves: Wave[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNewWave: () => void;
  onJoinWave: () => void;
}

export function Sidebar({ waves, selectedId, onSelect, onNewWave, onJoinWave }: SidebarProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? waves.filter((w) => waveTitle(w).toLowerCase().includes(q)) : waves;
  }, [waves, query]);

  return (
    <nav className="wp-sidebar" aria-label="Waves">
      <div className="wp-sidebar__actions">
        <Button variant="primary" onClick={onNewWave}>
          + New wave
        </Button>
        <Button variant="secondary" onClick={onJoinWave}>
          Join Wave
        </Button>
      </div>

      <div className="wp-search">
        <Input
          type="search"
          shape="c"
          placeholder="Search waves"
          aria-label="Search waves"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SearchIcon className="wp-search__icon" />
      </div>

      <ul className="wp-wavelist">
        {visible.map((wave, i) => {
          const selected = wave.id === selectedId;
          return (
            <li key={wave.id}>
              <button
                type="button"
                className={`sketch sketch-${SHAPES[i % SHAPES.length]} sketch-double wp-wave`}
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(wave.id)}
              >
                <span className="wp-wave__title">{waveTitle(wave)}</span>
                <span className="wp-wave__sub">{waveSubtitle(wave)}</span>
                {selected ? (
                  <>
                    <Sparkle size={10} rotate={-10} className="wp-spark wp-spark--tl" />
                    <Sparkle size={14} rotate={8} className="wp-spark wp-spark--br" />
                    <Sparkle size={10} rotate={14} className="wp-spark wp-spark--l" />
                  </>
                ) : (
                  <>
                    <Sparkle size={16} rotate={6} className="wp-spark wp-spark--tr1" />
                    <Sparkle size={12} rotate={-12} className="wp-spark wp-spark--tr2" />
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? <p className="wp-sidebar__none">No waves match.</p> : null}
    </nav>
  );
}
