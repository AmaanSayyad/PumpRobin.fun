"use client";

import { useCallback, useMemo } from "react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

function ParticleCanvas() {
  const options = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      particles: {
        number: { value: 60, density: { enable: true, width: 800, height: 800 } },
        color: { value: ["#CCFF00", "#00E5FF", "#FFFFFF"] },
        shape: { type: "circle" as const },
        opacity: { value: { min: 0.1, max: 0.5 } },
        size: { value: { min: 1, max: 3 } },
        move: {
          enable: true,
          speed: 0.6,
          direction: "none" as const,
          random: true,
          outModes: { default: "out" as const },
        },
        links: {
          enable: true,
          distance: 120,
          color: "#CCFF00",
          opacity: 0.08,
          width: 1,
        },
      },
      detectRetina: true,
    }),
    []
  );

  const particlesLoaded = useCallback(async () => {}, []);

  return (
    <Particles
      id="tsparticles"
      className="absolute inset-0 -z-10"
      particlesLoaded={particlesLoaded}
      options={options}
    />
  );
}

const initParticles = async (engine: Engine) => {
  await loadSlim(engine);
};

export function ParticleField() {
  return (
    <ParticlesProvider init={initParticles}>
      <ParticleCanvas />
    </ParticlesProvider>
  );
}
