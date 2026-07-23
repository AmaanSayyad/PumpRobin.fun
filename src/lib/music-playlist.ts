/** Royalty-free techno playlist (hosted under /public/music). */

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  /** Display BPM (approximate) */
  bpm: number;
  color: string;
  license: string;
};

/**
 * Dark / high-energy picks for PumpRobin’s neon launchpad vibe.
 * Sourced from Jamendo via Internet Archive (royalty-free distribution).
 */
export const MUSIC_PLAYLIST: MusicTrack[] = [
  {
    id: "ultra-tech",
    title: "Ultra Tech",
    artist: "GYAKO",
    src: "/music/ultra-tech.mp3",
    bpm: 136,
    color: "#ccff00",
    license: "Jamendo / Archive.org",
  },
  {
    id: "tech-house-future",
    title: "Tech House Future",
    artist: "Mr.Aleks",
    src: "/music/tech-house-future.mp3",
    bpm: 128,
    color: "#5ce1ff",
    license: "Jamendo / Archive.org",
  },
  {
    id: "rave-sound",
    title: "Rave Sound",
    artist: "Play House",
    src: "/music/rave-sound.mp3",
    bpm: 138,
    color: "#ff6b9d",
    license: "Jamendo / Archive.org",
  },
  {
    id: "revenge-clown",
    title: "Revenge of the Clown",
    artist: "JURA",
    src: "/music/revenge-clown.mp3",
    bpm: 145,
    color: "#c4a0ff",
    license: "Jamendo / Archive.org",
  },
  {
    id: "kristall",
    title: "Kristall",
    artist: "nonymic",
    src: "/music/kristall.mp3",
    bpm: 132,
    color: "#ffd166",
    license: "Jamendo / Archive.org",
  },
  {
    id: "assembly-line",
    title: "Assembly Line",
    artist: "Ordinarypeople",
    src: "/music/assembly-line.mp3",
    bpm: 130,
    color: "#7dffb3",
    license: "Jamendo / Archive.org",
  },
  {
    id: "techno-refuse",
    title: "Techno You Can't Refuse",
    artist: "Dj TurtleGodfather",
    src: "/music/techno-refuse.mp3",
    bpm: 130,
    color: "#ff8c66",
    license: "Jamendo / Archive.org",
  },
  {
    id: "aberrations",
    title: "Aberrations",
    artist: "Xtremist",
    src: "/music/aberrations.mp3",
    bpm: 140,
    color: "#66d9ff",
    license: "Jamendo / Archive.org",
  },
  {
    id: "mecha-life",
    title: "Mecha Life",
    artist: "Speedgt",
    src: "/music/mecha-life.mp3",
    bpm: 135,
    color: "#b8ff66",
    license: "Jamendo / Archive.org",
  },
  {
    id: "afghanistan",
    title: "Afghanistan",
    artist: "Areal Kollen",
    src: "/music/afghanistan.mp3",
    bpm: 128,
    color: "#ff66a8",
    license: "Jamendo / Archive.org",
  },
  {
    id: "catching-vampire",
    title: "Catching the Vampire",
    artist: "Data Collaborate",
    src: "/music/catching-vampire.mp3",
    bpm: 134,
    color: "#a0b4ff",
    license: "Jamendo / Archive.org",
  },
  {
    id: "bioshell",
    title: "Bioshell",
    artist: "Outer Region Records",
    src: "/music/bioshell.mp3",
    bpm: 136,
    color: "#66ffe0",
    license: "Jamendo / Archive.org",
  },
  {
    id: "frequency",
    title: "Frequency",
    artist: "Ordinarypeople",
    src: "/music/frequency.mp3",
    bpm: 128,
    color: "#e0ff66",
    license: "Jamendo / Archive.org",
  },
];
