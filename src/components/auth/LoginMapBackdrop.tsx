"use client";

import { useMemo } from "react";
import { createStarterCity } from "@/game/simulation/starter";
import { MapViewport } from "@/game/rendering/MapViewport";

/** Wide, read-only meadow used behind the auth panel. */
export function LoginMapBackdrop() {
  const city = useMemo(
    () =>
      createStarterCity({
        id: "login-preview",
        ownerId: "login-preview",
        name: "Meadowlight",
        displayName: "Welcome",
        specialty: "markets",
        now: Date.now(),
        seed: 42,
      }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="login-map-pan absolute inset-0 h-full w-full">
        <MapViewport
          city={city}
          readOnly
          tool="inspect"
          reducedMotion
          interactive={false}
          initialCam={{ x: 3, y: 2, zoom: 0.55 }}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(184,212,232,0.28) 0%, rgba(245,230,200,0.42) 42%, rgba(232,212,168,0.62) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 42%, rgba(245,230,200,0.08) 0%, rgba(58,48,32,0.32) 100%)",
        }}
      />
    </div>
  );
}
