"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MUSIC_PLAYLIST, type MusicTrack } from "@/lib/music-playlist";

const STORAGE_KEY = "pumprobin.techno";

type Persisted = {
  muted?: boolean;
  volume?: number;
  trackIndex?: number;
  collapsed?: boolean;
  disabled?: boolean;
};

function readPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

function writePersisted(patch: Persisted) {
  try {
    const next = { ...readPersisted(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function TechnoPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [trackIndex, setTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [showList, setShowList] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const startedRef = useRef(false);
  const trackIndexRef = useRef(0);

  const track: MusicTrack = MUSIC_PLAYLIST[trackIndex] ?? MUSIC_PLAYLIST[0]!;

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.loop = false;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const loadTrack = useCallback(
    (index: number) => {
      const audio = ensureAudio();
      const next =
        ((index % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) %
        MUSIC_PLAYLIST.length;
      trackIndexRef.current = next;
      setTrackIndex(next);
      const t = MUSIC_PLAYLIST[next]!;
      if (!audio.src.endsWith(t.src) && !audio.src.includes(encodeURI(t.src))) {
        audio.src = t.src;
      }
      audio.load();
      writePersisted({ trackIndex: next });
    },
    [ensureAudio]
  );

  const startPlayback = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!opts?.force && readPersisted().disabled) return;
      const audio = ensureAudio();
      try {
        if (!audio.src) {
          loadTrack(trackIndexRef.current);
        }
        audio.muted = muted;
        audio.volume = muted ? 0 : volume;
        await audio.play();
        startedRef.current = true;
        setNeedsGesture(false);
        setPlaying(true);
        setDisabled(false);
        writePersisted({ disabled: false });
      } catch {
        setNeedsGesture(true);
        setPlaying(false);
      }
    },
    [ensureAudio, loadTrack, muted, volume]
  );

  useEffect(() => {
    setMounted(true);
    const audio = ensureAudio();
    const saved = readPersisted();

    const vol = typeof saved.volume === "number" ? saved.volume : 0.55;
    setVolume(vol);
    audio.volume = saved.muted ? 0 : vol;

    if (saved.muted) {
      setMuted(true);
      audio.muted = true;
    }
    if (saved.collapsed) setCollapsed(true);

    const idx =
      typeof saved.trackIndex === "number"
        ? saved.trackIndex % MUSIC_PLAYLIST.length
        : 0;
    trackIndexRef.current = idx;
    setTrackIndex(idx);
    audio.src = MUSIC_PLAYLIST[idx]!.src;

    const onTime = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) {
        setProgress(0);
        return;
      }
      setProgress(audio.currentTime / audio.duration);
    };
    const onEnded = () => {
      const next = (trackIndexRef.current + 1) % MUSIC_PLAYLIST.length;
      loadTrack(next);
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      );
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    if (saved.disabled) {
      setDisabled(true);
      return () => {
        audio.removeEventListener("timeupdate", onTime);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("pause", onPause);
      };
    }

    void audio.play().then(
      () => {
        startedRef.current = true;
        setPlaying(true);
        setNeedsGesture(false);
      },
      () => setNeedsGesture(true)
    );

    const unlock = () => {
      if (startedRef.current || readPersisted().disabled) return;
      void startPlayback({ force: true });
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    // intentionally mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || pathname.startsWith("/admin")) return null;

  const bars = Array.from({ length: 16 }, (_, i) => i);
  const activeBar = Math.min(15, Math.floor(progress * 16));

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 sm:bottom-5 sm:left-5">
      {needsGesture && !disabled && !playing && (
        <button
          type="button"
          onClick={() => void startPlayback({ force: true })}
          className="animate-pulse rounded-full border border-rh-lime/40 bg-rh-lime px-4 py-2 text-xs font-semibold text-rh-on-lime shadow-[0_0_28px_-6px_rgba(204,255,0,0.7)]"
        >
          Tap for techno
        </button>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-white/10 bg-[#111]/95 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md transition-all",
          collapsed ? "w-[200px]" : "w-[min(100%,300px)]"
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              const audio = ensureAudio();
              if (playing) {
                audio.pause();
                setPlaying(false);
              } else {
                void startPlayback({ force: true });
              }
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rh-lime text-rh-on-lime transition-transform hover:scale-105"
          >
            {playing ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4" fill="currentColor" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-white">{track.title}</p>
            {!collapsed && (
              <p className="truncate text-[10px] text-rh-muted">
                {track.artist} · {track.bpm} BPM
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label={collapsed ? "Expand player" : "Collapse player"}
            onClick={() => {
              setCollapsed((v) => {
                writePersisted({ collapsed: !v });
                return !v;
              });
            }}
            className="rounded-lg p-1.5 text-rh-muted hover:bg-white/5 hover:text-white"
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="flex h-6 items-end gap-0.5 px-3 pb-1">
              {bars.map((i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm transition-all duration-100"
                  style={{
                    height:
                      playing && i === activeBar
                        ? "100%"
                        : playing && Math.abs(i - activeBar) < 3
                          ? "55%"
                          : "22%",
                    background: i === activeBar ? track.color : "rgba(255,255,255,0.12)",
                    opacity: playing ? 1 : 0.45,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-1 px-2 pb-2.5">
              <button
                type="button"
                aria-label="Previous track"
                onClick={() => {
                  const next =
                    (trackIndexRef.current - 1 + MUSIC_PLAYLIST.length) %
                    MUSIC_PLAYLIST.length;
                  loadTrack(next);
                  void startPlayback({ force: true });
                }}
                className="rounded-lg p-2 text-rh-muted hover:bg-white/5 hover:text-white"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                type="button"
                aria-label="Playlist"
                onClick={() => setShowList((v) => !v)}
                className={cn(
                  "rounded-lg p-2 hover:bg-white/5",
                  showList ? "text-rh-lime" : "text-rh-muted hover:text-white"
                )}
              >
                <ListMusic className="h-4 w-4" />
              </button>

              <button
                type="button"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  const audio = ensureAudio();
                  const next = !muted;
                  audio.muted = next;
                  setMuted(next);
                  writePersisted({ muted: next });
                }}
                className="rounded-lg p-2 text-rh-muted hover:bg-white/5 hover:text-white"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  const audio = ensureAudio();
                  audio.volume = muted ? 0 : v;
                  writePersisted({ volume: v });
                  if (v > 0 && muted) {
                    audio.muted = false;
                    setMuted(false);
                    writePersisted({ muted: false });
                  }
                }}
                className="mx-1 h-1 w-16 cursor-pointer accent-[#ccff00]"
              />

              <button
                type="button"
                aria-label="Next track"
                onClick={() => {
                  const next = (trackIndexRef.current + 1) % MUSIC_PLAYLIST.length;
                  loadTrack(next);
                  void startPlayback({ force: true });
                }}
                className="rounded-lg p-2 text-rh-muted hover:bg-white/5 hover:text-white"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            {showList && (
              <ul className="max-h-44 overflow-y-auto border-t border-white/[0.06] py-1">
                {MUSIC_PLAYLIST.map((t, i) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        loadTrack(i);
                        setShowList(false);
                        void startPlayback({ force: true });
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/[0.04]",
                        i === trackIndex ? "text-rh-lime" : "text-white/85"
                      )}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: t.color }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      <span className="tabular-nums text-[10px] text-rh-dim">{t.bpm}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
