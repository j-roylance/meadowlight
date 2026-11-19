"use client";

import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { BuildingDefId } from "@/game/types";
import { getBuilding } from "@/game/catalog/definitions";
import { C, Mat } from "./Mat";

/** Eave past the wall face — enough to read as a lip, not enough to collide. */
const EAVE = 0.055;
/** Sit just above the wall top to avoid z-fighting without a visible gap. */
const SEAT = 0.01;

/**
 * Hip roof sized to a rectangular wall top.
 * Base corners = wall half-extents + eave; apex above center.
 * Place the group at the wall's top center (x, wallTopY, z).
 */
function HipRoof({
  wallW,
  wallD,
  rise = 0.55,
  color = C.roof,
  eave = EAVE,
}: {
  wallW: number;
  wallD: number;
  rise?: number;
  color?: string;
  eave?: number;
}) {
  const hx = wallW / 2 + eave;
  const hz = wallD / 2 + eave;
  const geom = useMemo(() => {
    const apex = new THREE.Vector3(0, rise, 0);
    const corners = [
      new THREE.Vector3(-hx, 0, -hz),
      new THREE.Vector3(hx, 0, -hz),
      new THREE.Vector3(hx, 0, hz),
      new THREE.Vector3(-hx, 0, hz),
    ];
    const positions: number[] = [];
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    };
    for (let i = 0; i < 4; i++) {
      // outward winding so tops face up/out
      tri(apex, corners[i]!, corners[(i + 1) % 4]!);
    }
    // Closed underside
    tri(corners[0]!, corners[2]!, corners[1]!);
    tri(corners[0]!, corners[3]!, corners[2]!);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [hx, hz, rise]);

  return (
    <mesh geometry={geom} position={[0, SEAT, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Gable roof sized to a rectangular wall top.
 * Ridge along X; eaves at ±Z = ±(wallD/2 + eave); extrusion spans wallW + 2·eave.
 * Place the group at the wall's top center.
 */
function GableRoof({
  wallW,
  wallD,
  rise = 0.38,
  left = C.thatch,
  right = C.thatch,
  eave = EAVE,
}: {
  wallW: number;
  wallD: number;
  rise?: number;
  left?: string;
  right?: string;
  eave?: number;
}) {
  const halfDepth = wallD / 2 + eave;
  const span = wallW + eave * 2;
  const geom = useMemo(() => {
    // Triangle in XY: eaves at (±halfDepth, 0), ridge at (0, rise)
    const shape = new THREE.Shape();
    shape.moveTo(-halfDepth, 0);
    shape.lineTo(0, rise);
    shape.lineTo(halfDepth, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: span,
      bevelEnabled: false,
      steps: 1,
    });
    // Extrude was +Z; rotate so span runs along building X
    g.rotateY(Math.PI / 2);
    // After rotateY(π/2): former Z∈[0,span] → X∈[0,span]. Center on origin.
    g.translate(-span / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [halfDepth, rise, span]);

  return (
    <group position={[0, SEAT, 0]}>
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial
          color={left}
          roughness={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, rise + 0.015, 0]}>
        <boxGeometry args={[span * 0.92, 0.045, 0.055]} />
        <Mat color={right} />
      </mesh>
    </group>
  );
}

function WindowPane({
  x,
  y,
  z,
  w = 0.22,
  h = 0.26,
  yaw = 0,
}: {
  x: number;
  y: number;
  z: number;
  w?: number;
  h?: number;
  /** Yaw so the pane faces out from the wall (0 = +Z). */
  yaw?: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh>
        <boxGeometry args={[w + 0.04, h + 0.04, 0.03]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[w, h, 0.02]} />
        <Mat color={C.window} emissive={C.window} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[0.02, h * 0.92, 0.01]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[w * 0.92, 0.02, 0.01]} />
        <Mat color={C.wood} />
      </mesh>
    </group>
  );
}

function Cottage({
  roof = C.thatch,
  accent = C.thatch,
  level = 1,
}: {
  roof?: string;
  accent?: string;
  level?: 1 | 2;
}) {
  const wallW = 0.82;
  const wallH = level === 2 ? 1.25 : 0.95;
  const padTop = 0.08;
  const wallTop = padTop + wallH;
  const rise = 0.36;
  const faceZ = 0.5 + wallW / 2;
  return (
    <group>
      <mesh position={[0.5, 0.04, 0.5]} receiveShadow>
        <boxGeometry args={[0.92, 0.08, 0.92]} />
        <Mat color={C.pathStone} />
      </mesh>
      {/* Porch step */}
      <mesh position={[0.5, 0.1, 0.12]} receiveShadow>
        <boxGeometry args={[0.4, 0.06, 0.16]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[0.5, padTop + wallH / 2, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallW]} />
        <Mat color={C.wall} />
      </mesh>
      {/* Warm front face */}
      <mesh position={[0.5, padTop + wallH / 2, faceZ + 0.01]}>
        <boxGeometry args={[wallW * 0.95, wallH * 0.92, 0.04]} />
        <Mat color={C.wallWarm} />
      </mesh>
      {/* Corner posts */}
      {(
        [
          [0.5 - wallW / 2, 0.5 - wallW / 2],
          [0.5 + wallW / 2, 0.5 - wallW / 2],
          [0.5 - wallW / 2, 0.5 + wallW / 2],
          [0.5 + wallW / 2, 0.5 + wallW / 2],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, padTop + wallH / 2, z]}>
          <boxGeometry args={[0.05, wallH + 0.02, 0.05]} />
          <Mat color={C.woodDark} />
        </mesh>
      ))}
      {/* Door + frame */}
      <mesh position={[0.5, 0.32, 0.08]} castShadow>
        <boxGeometry args={[0.28, 0.52, 0.05]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[0.5, 0.32, 0.06]}>
        <boxGeometry args={[0.32, 0.56, 0.02]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.58, 0.32, 0.12]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <Mat color={C.gold} />
      </mesh>
      {/* Side window + shutters */}
      <WindowPane
        x={0.5 + wallW / 2 + 0.02}
        y={padTop + wallH * 0.55}
        z={0.5}
        w={0.2}
        h={0.24}
        yaw={Math.PI / 2}
      />
      <mesh position={[0.5 + wallW / 2 + 0.03, padTop + wallH * 0.55, 0.34]}>
        <boxGeometry args={[0.03, 0.28, 0.1]} />
        <Mat color={C.shutter} />
      </mesh>
      <mesh position={[0.5 + wallW / 2 + 0.03, padTop + wallH * 0.55, 0.66]}>
        <boxGeometry args={[0.03, 0.28, 0.1]} />
        <Mat color={C.shutter} />
      </mesh>
      {/* Flower box */}
      <mesh position={[0.5 + wallW / 2 + 0.06, padTop + wallH * 0.38, 0.5]}>
        <boxGeometry args={[0.1, 0.08, 0.36]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.97, padTop + wallH * 0.48, 0.4]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <Mat color={C.flower} />
      </mesh>
      <mesh position={[0.97, padTop + wallH * 0.48, 0.5]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <Mat color={C.flowerYellow} />
      </mesh>
      <mesh position={[0.97, padTop + wallH * 0.48, 0.6]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <Mat color={C.flowerPurple} />
      </mesh>
      <group position={[0.5, wallTop, 0.5]}>
        <GableRoof wallW={wallW} wallD={wallW} rise={rise} left={roof} right={accent} />
      </group>
      {/* Chimney + pot */}
      <mesh position={[0.72, wallTop + rise * 0.45, 0.68]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[0.72, wallTop + rise * 0.45 + 0.24, 0.68]}>
        <boxGeometry args={[0.16, 0.05, 0.16]} />
        <Mat color={C.stoneDark} />
      </mesh>
      {/* Rain barrel */}
      <mesh position={[0.12, 0.22, 0.78]} castShadow>
        <cylinderGeometry args={[0.1, 0.11, 0.28, 8]} />
        <Mat color={C.woodDark} />
      </mesh>
      {level === 2 && (
        <mesh position={[0.5, wallTop + rise + 0.14, 0.5]} castShadow>
          <boxGeometry args={[0.3, 0.28, 0.3]} />
          <Mat color={C.wall} />
        </mesh>
      )}
    </group>
  );
}

function Workshop() {
  const wallW = 0.86;
  const wallH = 1.0;
  const wallTop = wallH;
  const rise = 0.34;
  return (
    <group>
      <mesh position={[0.5, 0.03, 0.5]} receiveShadow>
        <boxGeometry args={[0.95, 0.06, 0.95]} />
        <Mat color={C.path} />
      </mesh>
      <mesh position={[0.5, wallH / 2, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallW]} />
        <Mat color={C.wood} />
      </mesh>
      {/* Plank lines */}
      {[0.25, 0.45, 0.65, 0.85].map((y) => (
        <mesh key={y} position={[0.5, y, 0.5 + wallW / 2 + 0.01]}>
          <boxGeometry args={[wallW * 0.92, 0.02, 0.015]} />
          <Mat color={C.woodDark} />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[0.5, 0.32, 0.08]}>
        <boxGeometry args={[0.34, 0.52, 0.05]} />
        <Mat color={C.cream} />
      </mesh>
      <mesh position={[0.5, 0.32, 0.06]}>
        <boxGeometry args={[0.38, 0.56, 0.02]} />
        <Mat color={C.woodDark} />
      </mesh>
      {/* Hanging sign */}
      <mesh position={[0.5, 0.92, 0.05]}>
        <boxGeometry args={[0.02, 0.16, 0.02]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.5, 0.78, 0.05]} castShadow>
        <boxGeometry args={[0.28, 0.16, 0.04]} />
        <Mat color={C.thatch} />
      </mesh>
      <WindowPane
        x={0.5 + wallW / 2 + 0.02}
        y={0.62}
        z={0.5}
        w={0.18}
        h={0.2}
        yaw={Math.PI / 2}
      />
      {/* Log stack */}
      <mesh position={[0.72, 0.14, 0.72]} rotation={[0, 0.4, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 8]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.72, 0.26, 0.72]} rotation={[0, -0.25, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.36, 8]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[0.7, 0.36, 0.7]} rotation={[0.1, 0.5, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.32, 7]} />
        <Mat color={C.trunk} />
      </mesh>
      {/* Sawhorse */}
      <mesh position={[0.22, 0.18, 0.7]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.04, 0.32, 0.04]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.34, 0.18, 0.7]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.04, 0.32, 0.04]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.28, 0.32, 0.7]}>
        <boxGeometry args={[0.36, 0.04, 0.08]} />
        <Mat color={C.wood} />
      </mesh>
      <group position={[0.5, wallTop, 0.5]}>
        <GableRoof
          wallW={wallW}
          wallD={wallW}
          rise={rise}
          left={C.thatch}
          right={C.thatch}
        />
      </group>
    </group>
  );
}

function StoneYard() {
  return (
    <group>
      <mesh position={[0.5, 0.05, 0.5]} receiveShadow>
        <boxGeometry args={[0.95, 0.1, 0.95]} />
        <Mat color={C.pathStone} />
      </mesh>
      {/* Low wall ring */}
      <mesh position={[0.5, 0.16, 0.12]}>
        <boxGeometry args={[0.85, 0.14, 0.1]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[0.5, 0.16, 0.88]}>
        <boxGeometry args={[0.85, 0.14, 0.1]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <mesh position={[0.28, 0.35, 0.38]} castShadow rotation={[0.15, 0.3, 0.1]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <mesh position={[0.58, 0.48, 0.42]} castShadow>
        <boxGeometry args={[0.32, 0.85, 0.3]} />
        <Mat color={C.stone} />
      </mesh>
      {/* Cap on cut stone */}
      <mesh position={[0.58, 0.94, 0.42]}>
        <boxGeometry args={[0.36, 0.06, 0.34]} />
        <Mat color={C.pathStone} />
      </mesh>
      <mesh position={[0.72, 0.28, 0.68]} castShadow rotation={[0.2, -0.4, 0]}>
        <dodecahedronGeometry args={[0.16, 0]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <mesh position={[0.4, 0.18, 0.7]} rotation={[0.3, 0.5, 0]}>
        <dodecahedronGeometry args={[0.1, 0]} />
        <Mat color={C.pathStone} />
      </mesh>
      <mesh position={[0.78, 0.14, 0.3]} rotation={[0.1, -0.2, 0.2]}>
        <dodecahedronGeometry args={[0.09, 0]} />
        <Mat color={C.stone} />
      </mesh>
    </group>
  );
}

function Market() {
  const wallW = 0.88;
  const wallD = 0.7;
  const wallH = 0.76;
  const cx = 0.5;
  const cz = 0.55;
  const wallTop = wallH;
  const rise = 0.4;
  return (
    <group>
      <mesh position={[cx, wallH / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallD]} />
        <Mat color={C.wallWarm} />
      </mesh>
      {/* Awning posts + cloth */}
      <mesh position={[0.18, 0.35, 0.22]}>
        <cylinderGeometry args={[0.025, 0.03, 0.7, 6]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.82, 0.35, 0.22]}>
        <cylinderGeometry args={[0.025, 0.03, 0.7, 6]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.5, 0.72, 0.28]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.75, 0.04, 0.35]} />
        <Mat color={C.roof} />
      </mesh>
      {/* Counter + crates */}
      <mesh position={[0.5, 0.2, 0.18]}>
        <boxGeometry args={[0.75, 0.18, 0.16]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[0.22, 0.14, 0.78]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.18]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.22, 0.28, 0.78]}>
        <boxGeometry args={[0.16, 0.12, 0.16]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[0.32, 0.36, 0.14]}>
        <sphereGeometry args={[0.08, 7, 7]} />
        <Mat color={C.flowerYellow} />
      </mesh>
      <mesh position={[0.5, 0.36, 0.12]}>
        <sphereGeometry args={[0.07, 7, 7]} />
        <Mat color={C.flower} />
      </mesh>
      <mesh position={[0.68, 0.36, 0.14]}>
        <sphereGeometry args={[0.075, 7, 7]} />
        <Mat color={C.leaf} />
      </mesh>
      <mesh position={[0.4, 0.34, 0.2]}>
        <sphereGeometry args={[0.055, 6, 6]} />
        <Mat color={C.flowerPurple} />
      </mesh>
      <WindowPane x={cx} y={0.55} z={cz + wallD / 2 + 0.02} w={0.28} h={0.2} />
      <group position={[cx, wallTop, cz]}>
        <HipRoof wallW={wallW} wallD={wallD} rise={rise} color={C.roof} />
      </group>
    </group>
  );
}

function Garden() {
  return (
    <group>
      <mesh position={[0.5, 0.05, 0.5]} receiveShadow>
        <boxGeometry args={[0.9, 0.1, 0.9]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[0.5, 0.1, 0.5]} receiveShadow>
        <boxGeometry args={[0.78, 0.06, 0.78]} />
        <Mat color={C.grass} />
      </mesh>
      {(
        [
          [0.28, 0.32, C.flower],
          [0.5, 0.55, C.flowerYellow],
          [0.7, 0.35, C.flowerPurple],
          [0.4, 0.7, C.flower],
          [0.65, 0.65, C.flowerYellow],
        ] as const
      ).map(([x, z, color], i) => (
        <group key={i} position={[x, 0.12, z]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.16, 5]} />
            <Mat color={C.leaf} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.09, 7, 7]} />
            <Mat color={color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Portal() {
  return (
    <group>
      <mesh position={[0.5, 0.06, 0.5]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.48, 0.12, 16]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[0.5, 0.9, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.06, 10, 24]} />
        <Mat color={C.portalRing} metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[0.5, 0.9, 0.5]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <Mat
          color={C.portal}
          transparent
          opacity={0.5}
          emissive={C.portal}
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh position={[0.5, 0.9, 0.5]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <Mat color={C.cream} emissive={C.cream} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function TownHall() {
  const wallW = 2.45;
  const wallH = 1.6;
  const padTop = 0.1;
  const wallY = padTop + wallH / 2;
  const wallTop = padTop + wallH;
  const rise = 1.05;
  const faceZ = 1.5 - wallW / 2;
  return (
    <group>
      <mesh position={[1.5, padTop / 2, 1.5]} receiveShadow>
        <boxGeometry args={[2.95, padTop, 2.95]} />
        <Mat color={C.pathStone} />
      </mesh>
      {/* Entrance stairs */}
      <mesh position={[1.5, 0.08, 0.2]} receiveShadow>
        <boxGeometry args={[1.2, 0.08, 0.35]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[1.5, 0.14, 0.28]} receiveShadow>
        <boxGeometry args={[1.0, 0.08, 0.22]} />
        <Mat color={C.pathStone} />
      </mesh>
      <mesh position={[1.5, wallY, 1.5]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallW]} />
        <Mat color={C.wallStone} />
      </mesh>
      {/* Corner quoins */}
      {(
        [
          [1.5 - wallW / 2, 1.5 - wallW / 2],
          [1.5 + wallW / 2, 1.5 - wallW / 2],
          [1.5 - wallW / 2, 1.5 + wallW / 2],
          [1.5 + wallW / 2, 1.5 + wallW / 2],
        ] as const
      ).map(([x, z], i) => (
        <group key={i}>
          {[0.25, 0.55, 0.85, 1.15, 1.45].map((y) => (
            <mesh key={y} position={[x, y, z]}>
              <boxGeometry args={[0.12, 0.14, 0.12]} />
              <Mat color={y % 0.6 < 0.3 ? C.cream : C.stone} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Double doors */}
      <mesh position={[1.1, 0.48, faceZ - 0.02]}>
        <boxGeometry args={[0.42, 0.75, 0.08]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[1.9, 0.48, faceZ - 0.02]}>
        <boxGeometry args={[0.42, 0.75, 0.08]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[1.5, 0.9, faceZ - 0.06]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <Mat color={C.gold} />
      </mesh>
      {/* Banner */}
      <mesh position={[1.5, 1.35, faceZ - 0.08]}>
        <boxGeometry args={[0.7, 0.22, 0.03]} />
        <Mat color={C.roof} />
      </mesh>
      {[0.7, 1.5, 2.3].map((x) => (
        <group key={x}>
          <WindowPane x={x} y={1.15} z={faceZ - 0.02} w={0.28} h={0.26} />
          <WindowPane x={x} y={1.15} z={1.5 + wallW / 2 + 0.02} w={0.28} h={0.26} />
        </group>
      ))}
      {/* Side chimneys */}
      <mesh position={[0.45, wallTop + 0.35, 1.5]} castShadow>
        <boxGeometry args={[0.22, 0.7, 0.22]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[2.55, wallTop + 0.35, 1.5]} castShadow>
        <boxGeometry args={[0.22, 0.7, 0.22]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <group position={[1.5, wallTop, 1.5]}>
        <HipRoof wallW={wallW} wallD={wallW} rise={rise} color={C.roof} />
      </group>
      <mesh position={[1.5, wallTop + rise + 0.08, 1.5]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <Mat color={C.gold} metalness={0.45} />
      </mesh>
      {/* Planters */}
      {(
        [
          [0.4, 0.4, C.flower],
          [2.6, 0.4, C.flowerYellow],
          [0.4, 2.6, C.flowerPurple],
          [2.6, 2.6, C.flowerCoral],
        ] as const
      ).map(([x, z, color], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.14, 8]} />
            <Mat color={C.terracotta} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.1, 7, 7]} />
            <Mat color={color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Park2() {
  return (
    <group>
      <mesh position={[1, 0.04, 1]} receiveShadow>
        <boxGeometry args={[1.95, 0.08, 1.95]} />
        <Mat color={C.grass} />
      </mesh>
      {/* Path ring */}
      <mesh position={[1, 0.06, 1]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <torusGeometry args={[0.55, 0.08, 6, 20]} />
        <Mat color={C.path} />
      </mesh>
      <mesh position={[0.5, 0.38, 0.5]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.7, 6]} />
        <Mat color={C.trunk} />
      </mesh>
      <mesh position={[0.5, 0.98, 0.5]} castShadow>
        <sphereGeometry args={[0.4, 10, 10]} />
        <Mat color={C.leaf} />
      </mesh>
      <mesh position={[0.65, 1.15, 0.55]}>
        <sphereGeometry args={[0.24, 8, 8]} />
        <Mat color={C.leafLight} />
      </mesh>
      {/* Second smaller tree */}
      <mesh position={[1.55, 0.28, 0.45]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 6]} />
        <Mat color={C.trunk} />
      </mesh>
      <mesh position={[1.55, 0.7, 0.45]} castShadow scale={[1.1, 0.85, 1]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <Mat color={C.leafLight} />
      </mesh>
      <mesh position={[1.4, 0.1, 1.45]} receiveShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.1, 16]} />
        <Mat color={C.water} transparent opacity={0.85} roughness={0.15} />
      </mesh>
      <mesh position={[1.4, 0.14, 1.45]}>
        <cylinderGeometry args={[0.42, 0.44, 0.05, 16]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[1.55, 0.14, 0.85]}>
        <boxGeometry args={[0.55, 0.1, 0.14]} />
        <Mat color={C.wood} />
      </mesh>
      {/* Bench legs */}
      <mesh position={[1.35, 0.1, 0.85]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[1.75, 0.1, 0.85]}>
        <boxGeometry args={[0.06, 0.12, 0.06]} />
        <Mat color={C.woodDark} />
      </mesh>
      {(
        [
          [0.3, 1.6, C.flower],
          [1.7, 1.65, C.flowerYellow],
          [0.35, 0.35, C.flowerPurple],
          [1.75, 1.2, C.flowerCoral],
        ] as const
      ).map(([x, z, color], i) => (
        <mesh key={i} position={[x, 0.14, z]}>
          <sphereGeometry args={[0.08, 7, 7]} />
          <Mat color={color} />
        </mesh>
      ))}
    </group>
  );
}

function LandmarkBox({
  accent = C.gold,
  columns = false,
  roof = C.roof,
}: {
  accent?: string;
  columns?: boolean;
  roof?: string;
}) {
  const wallW = 1.45;
  const wallH = 1.3;
  const padTop = 0.08;
  const wallY = padTop + wallH / 2;
  const wallTop = padTop + wallH;
  const rise = 0.52;
  const faceZ = 1 - wallW / 2;
  return (
    <group>
      <mesh position={[1, 0.04, 1]} receiveShadow>
        <boxGeometry args={[1.95, 0.08, 1.95]} />
        <Mat color={C.pathStone} />
      </mesh>
      <mesh position={[1, 0.1, faceZ - 0.08]} receiveShadow>
        <boxGeometry args={[0.9, 0.08, 0.28]} />
        <Mat color={C.stone} />
      </mesh>
      <mesh position={[1, wallY, 1]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallW]} />
        <Mat color={C.wall} />
      </mesh>
      {/* Pediment band */}
      <mesh position={[1, wallTop - 0.06, 1]}>
        <boxGeometry args={[wallW + 0.08, 0.1, wallW + 0.08]} />
        <Mat color={C.cream} />
      </mesh>
      {columns && (
        <>
          {[0.35, 1.65].map((x) =>
            [0.35, 1.65].map((z) => (
              <group key={`${x}-${z}`}>
                <mesh position={[x, wallY, z]}>
                  <cylinderGeometry args={[0.09, 0.1, wallH, 8]} />
                  <Mat color={C.cream} />
                </mesh>
                <mesh position={[x, wallTop - 0.02, z]}>
                  <boxGeometry args={[0.2, 0.06, 0.2]} />
                  <Mat color={C.cream} />
                </mesh>
                <mesh position={[x, padTop + 0.04, z]}>
                  <boxGeometry args={[0.22, 0.08, 0.22]} />
                  <Mat color={C.pathStone} />
                </mesh>
              </group>
            ))
          )}
        </>
      )}
      {/* Door */}
      <mesh position={[1, 0.45, faceZ - 0.02]} castShadow>
        <boxGeometry args={[0.32, 0.7, 0.06]} />
        <Mat color={C.wood} />
      </mesh>
      <WindowPane x={0.55} y={wallY + 0.15} z={faceZ - 0.02} w={0.22} h={0.24} />
      <WindowPane x={1.45} y={wallY + 0.15} z={faceZ - 0.02} w={0.22} h={0.24} />
      <group position={[1, wallTop, 1]}>
        <HipRoof wallW={wallW} wallD={wallW} rise={rise} color={roof} />
      </group>
      <mesh position={[1, wallTop + rise + 0.06, 1]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <Mat color={accent} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Tower() {
  const wallW = 1.15;
  const wallH = 4.1;
  const padTop = 0.08;
  const wallY = padTop + wallH / 2;
  const wallTop = padTop + wallH;
  const rise = 0.5;
  return (
    <group>
      <mesh position={[1, 0.04, 1]} receiveShadow>
        <boxGeometry args={[1.95, 0.08, 1.95]} />
        <Mat color={C.pathStone} />
      </mesh>
      <mesh position={[1, wallY, 1]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallW]} />
        <Mat color={C.metal} />
      </mesh>
      {[0.9, 1.7, 2.5, 3.3].map((y) => (
        <group key={y}>
          <mesh position={[1 - wallW / 2 - 0.02, y, 1]}>
            <boxGeometry args={[0.05, 0.22, 0.65]} />
            <Mat color={C.window} emissive={C.window} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[1 + wallW / 2 + 0.02, y, 1]}>
            <boxGeometry args={[0.05, 0.22, 0.65]} />
            <Mat color={C.window} emissive={C.window} emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
      <group position={[1, wallTop, 1]}>
        <HipRoof wallW={wallW} wallD={wallW} rise={rise} color={C.cream} />
      </group>
      <mesh position={[1, wallTop + rise + 0.06, 1]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <Mat color={C.gold} metalness={0.45} />
      </mesh>
    </group>
  );
}

function SpaceCenter() {
  return (
    <group>
      <mesh position={[2, 0.03, 2]} receiveShadow>
        <boxGeometry args={[3.9, 0.06, 3.9]} />
        <Mat color={C.grass} />
      </mesh>
      <mesh position={[2, 0.08, 2]} receiveShadow>
        <cylinderGeometry args={[1.45, 1.6, 0.1, 20]} />
        <Mat color={C.pathStone} />
      </mesh>
      <mesh position={[2, 0.14, 2]} receiveShadow>
        <cylinderGeometry args={[0.95, 1.05, 0.08, 20]} />
        <Mat color={C.stoneDark} />
      </mesh>
      <mesh position={[1.15, 1.15, 2]} castShadow>
        <boxGeometry args={[0.1, 2.1, 0.1]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[1.45, 1.5, 2]}>
        <boxGeometry args={[0.65, 0.07, 0.07]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[2, 1.25, 2]} castShadow>
        <cylinderGeometry args={[0.26, 0.3, 2.15, 12]} />
        <Mat color={C.rocket} />
      </mesh>
      <mesh position={[2, 2.5, 2]} castShadow>
        <coneGeometry args={[0.28, 0.5, 12]} />
        <Mat color={C.roof} />
      </mesh>
      <mesh position={[2, 1.45, 2.28]}>
        <circleGeometry args={[0.09, 12]} />
        <Mat color={C.window} emissive={C.window} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[1.72, 0.35, 2]} rotation={[0, 0, 0.45]}>
        <boxGeometry args={[0.12, 0.42, 0.06]} />
        <Mat color={C.roofDark} />
      </mesh>
      <mesh position={[2.28, 0.35, 2]} rotation={[0, 0, -0.45]}>
        <boxGeometry args={[0.12, 0.42, 0.06]} />
        <Mat color={C.roof} />
      </mesh>
      <mesh position={[3.2, 0.35, 3.15]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <Mat color={C.wall} />
      </mesh>
      <group position={[3.2, 0.7, 3.15]}>
        <HipRoof wallW={0.7} wallD={0.7} rise={0.3} color={C.moss} />
      </group>
    </group>
  );
}

function ProjectSite({ stage }: { stage?: string }) {
  const wallW = 1.55;
  const wallH = 1.25;
  const wallY = wallH / 2 + 0.06;
  const wallTop = wallY + wallH / 2;
  return (
    <group>
      <mesh position={[2, 0.03, 2]} receiveShadow>
        <boxGeometry args={[3.9, 0.06, 3.9]} />
        <Mat color={C.path} />
      </mesh>
      <mesh position={[1.2, 0.55, 1.4]} castShadow>
        <boxGeometry args={[0.16, 1.0, 0.16]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[2.7, 0.4, 2.3]} castShadow>
        <boxGeometry args={[0.16, 0.7, 0.16]} />
        <Mat color={C.wood} />
      </mesh>
      <mesh position={[1.8, 0.12, 2.6]}>
        <boxGeometry args={[0.5, 0.12, 0.25]} />
        <Mat color={C.stone} />
      </mesh>
      {(stage === "active" || stage === "complete") && (
        <mesh position={[2, wallY, 2]} castShadow receiveShadow>
          <boxGeometry args={[wallW, wallH, wallW]} />
          <Mat color={C.wall} />
        </mesh>
      )}
      {stage === "complete" && (
        <group position={[2, wallTop, 2]}>
          <HipRoof wallW={wallW} wallD={wallW} rise={0.48} color={C.roof} />
        </group>
      )}
    </group>
  );
}

function RecCenter() {
  const wallW = 1.5;
  const wallD = 1.35;
  const wallH = 1.2;
  const padTop = 0.08;
  const wallY = padTop + wallH / 2;
  const wallTop = padTop + wallH;
  const rise = 0.46;
  const faceZ = 1 - wallD / 2;
  return (
    <group>
      <mesh position={[1, 0.04, 1]} receiveShadow>
        <boxGeometry args={[1.95, 0.08, 1.95]} />
        <Mat color={C.grass} />
      </mesh>
      <mesh position={[1, wallY, 1]} castShadow receiveShadow>
        <boxGeometry args={[wallW, wallH, wallD]} />
        <Mat color={C.wallWarm} />
      </mesh>
      {/* Entry canopy */}
      <mesh position={[1, wallTop - 0.15, faceZ - 0.12]} castShadow>
        <boxGeometry args={[0.7, 0.06, 0.35]} />
        <Mat color={C.moss} />
      </mesh>
      <mesh position={[0.72, 0.45, faceZ - 0.12]}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[1.28, 0.45, faceZ - 0.12]}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
        <Mat color={C.woodDark} />
      </mesh>
      <mesh position={[1, 0.4, faceZ - 0.02]} castShadow>
        <boxGeometry args={[0.36, 0.65, 0.06]} />
        <Mat color={C.wood} />
      </mesh>
      <group position={[1, wallTop, 1]}>
        <HipRoof wallW={wallW} wallD={wallD} rise={rise} color={C.moss} />
      </group>
      {/* Courts */}
      <mesh position={[0.4, 0.1, 0.4]}>
        <cylinderGeometry args={[0.26, 0.28, 0.08, 14]} />
        <Mat color={C.path} />
      </mesh>
      <mesh position={[1.6, 0.1, 0.4]}>
        <cylinderGeometry args={[0.26, 0.28, 0.08, 14]} />
        <Mat color={C.path} />
      </mesh>
      <WindowPane x={0.55} y={wallY + 0.15} z={faceZ - 0.02} w={0.26} h={0.22} />
      <WindowPane x={1.45} y={wallY + 0.15} z={faceZ - 0.02} w={0.26} h={0.22} />
    </group>
  );
}

function University() {
  const cupolaW = 0.42;
  const cupolaH = 0.65;
  // LandmarkBox wall top = 0.08 + 1.3 = 1.38; cupola sits on roof ridge area
  const cupolaBottom = 1.38 + 0.52; // on landmark roof apex band
  const cupolaY = cupolaBottom + cupolaH / 2;
  const cupolaTop = cupolaBottom + cupolaH;
  const rise = 0.28;
  return (
    <group>
      <LandmarkBox accent={C.portal} roof={C.roof} />
      <mesh position={[1, cupolaY, 1]} castShadow>
        <boxGeometry args={[cupolaW, cupolaH, cupolaW]} />
        <Mat color={C.wallWarm} />
      </mesh>
      <group position={[1, cupolaTop, 1]}>
        <HipRoof wallW={cupolaW} wallD={cupolaW} rise={rise} color={C.roof} />
      </group>
      <mesh position={[0.35, 0.35, 1.55]} castShadow>
        <sphereGeometry args={[0.28, 9, 9]} />
        <Mat color={C.leaf} />
      </mesh>
    </group>
  );
}

export function BuildingMesh({
  definitionId,
  level = 1,
  stage,
  projectType,
}: {
  definitionId: BuildingDefId | string;
  level?: 1 | 2;
  stage?: string;
  projectType?: string;
}) {
  switch (definitionId) {
    case "cottage_a":
      return <Cottage roof={C.thatch} accent={C.thatch} level={level} />;
    case "cottage_b":
      return <Cottage roof={C.roof} accent={C.roofDark} level={level} />;
    case "cottage_c":
      return <Cottage roof={C.moss} accent={C.leaf} level={level} />;
    case "wood_workshop":
      return <Workshop />;
    case "stone_yard":
      return <StoneYard />;
    case "neighborhood_market":
      return <Market />;
    case "flower_garden":
      return <Garden />;
    case "portal":
      return <Portal />;
    case "town_hall":
      return <TownHall />;
    case "pocket_park":
    case "landmark_park":
      return <Park2 />;
    case "landmark_museum":
      return <LandmarkBox accent={C.gold} columns />;
    case "landmark_bank":
      return <LandmarkBox accent={C.gold} columns />;
    case "landmark_rec":
      return <RecCenter />;
    case "landmark_tower":
      return <Tower />;
    case "landmark_university":
      return <University />;
    case "space_center":
    case "landmark_space_center":
      return <SpaceCenter />;
    case "project_site":
      if (stage === "complete" && projectType) {
        const map: Record<string, ReactNode> = {
          riverside_park: <Park2 />,
          community_museum: <LandmarkBox accent={C.gold} columns />,
          municipal_rec: <RecCenter />,
          skyline_tower: <Tower />,
          community_university: <University />,
          town_bank: <LandmarkBox accent={C.gold} columns />,
          space_center: <SpaceCenter />,
        };
        return <>{map[projectType] ?? <ProjectSite stage={stage} />}</>;
      }
      return <ProjectSite stage={stage} />;
    default: {
      const def = getBuilding(definitionId as BuildingDefId);
      const fw = def.footprint.w;
      const fd = def.footprint.h;
      const wallW = fw * 0.85;
      const wallD = fd * 0.85;
      const wallH = 0.8;
      const wallTop = wallH;
      return (
        <group>
          <mesh position={[fw / 2, wallH / 2, fd / 2]} castShadow receiveShadow>
            <boxGeometry args={[wallW, wallH, wallD]} />
            <Mat color={C.wall} />
          </mesh>
          <group position={[fw / 2, wallTop, fd / 2]}>
            <HipRoof wallW={wallW} wallD={wallD} rise={0.4} />
          </group>
        </group>
      );
    }
  }
}
