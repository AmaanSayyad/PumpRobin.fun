"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function LimeOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1.5}>
      <mesh ref={meshRef} scale={2.2}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color="#CCFF00"
          emissive="#CCFF00"
          emissiveIntensity={0.4}
          distort={0.35}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
}

function Ring() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.z = state.clock.elapsedTime * 0.3;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[3.5, 0.02, 16, 100]} />
      <meshBasicMaterial color="#00E5FF" transparent opacity={0.4} />
    </mesh>
  );
}

export function HeroScene() {
  const dpr = useMemo(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 1 : 1.5), []);

  return (
    <div className="absolute inset-0 -z-10 opacity-60">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={dpr} gl={{ alpha: true }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#CCFF00" />
        <pointLight position={[-10, -5, 5]} intensity={0.5} color="#00E5FF" />
        <LimeOrb />
        <Ring />
      </Canvas>
    </div>
  );
}
