# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Revo Realms is a 3D web game built with Three.js (WebGPU renderer), Rapier physics, and Svelte for UI. It's an interactive 3D world where players control a ball-like character exploring a procedurally-generated landscape with vegetation, monuments, and themed areas.

## Commands

```bash
npm run dev          # Start development server with hot reload (--host enabled)
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
npm run textures:atlases:process  # Process texture atlases (node script)
```

## Architecture

### Initialization Flow

1. `main.ts` creates `_SetupManager` which initializes core systems asynchronously
2. Systems (renderer, physics, assets) are initialized in parallel where possible
3. `Game` class is instantiated, creating the `Player` and `RevoRealm`
4. Game loop runs via `renderer.setAnimationLoop()`

### Systems Layer (`src/systems/`)

All systems are singletons instantiated and exported from `src/systems/index.ts`. Import them directly:

```typescript
import { sceneManager, physicsManager, eventsManager } from "./systems";
```

Key systems:
- **EventsManager** - Type-safe event bus using tseep. Provides throttled update variants (`engine-update-throttle-2x`, `4x`, `16x`, `64x`) for less frequent updates
- **SceneManager** - Manages Three.js scene and cameras (`playerCamera`, `renderCamera`)
- **RendererManager** - WebGPU renderer with postprocessing and monitoring (dev only)
- **PhysicsManager** - Rapier3D physics world, handles collision events for audio feedback
- **AssetManager** - Loads textures (including KTX2), GLTF models (with DRACO), and cube textures
- **SystemState** - Global state including wind controller for vegetation animation
- **LightingManager** - Directional light with cascaded shadow maps

### Realm and Entities (`src/realm/`, `src/entities/`)

- **RevoRealm** (`src/realm/RevoRealm.ts`) - Composes the world by instantiating entities
- **Player** - Ball character with physics-based movement, camera following, jump mechanics
- **Terrain** - Heightmap-based terrain
- **Vegetation** - Container for Grass, Flowers, PineTree, Trees, etc.
- **CoolStuff** - Themed areas (DragonBall, Berserk, GodOfWar, etc.)

### TSL Shaders (`src/utils/TSLUtils.ts`)

Three.js Shading Language utilities for GPU-side computations:
- Bit packing/unpacking functions for efficient data storage (angles, flags, units, signed values)
- UV computation helpers for heightmaps and texture atlases
- Normal map blending (RNM and UDN methods)
- Lightmap sampling

### UI Layer (`src/ui/`)

Svelte 5 components mounted via `UIManager`. Components include loading screen, toggles, and credits dialog.

## Key Patterns

### Subscribing to Updates

```typescript
eventsManager.on("engine-update", (state: State) => {
  // state.delta, state.player available
});
```

### Creating Physics Colliders

Use `RevoColliderType` enum for collision identification. Colliders store type in `userData`.

### Materials

Use WebGPU node materials (`MeshLambertNodeMaterial`, etc.) with TSL for shader logic.

## Configuration

- `realmConfig` in `RevoRealm.ts` defines map size (512x512) and related constants
- Player config in `Player.ts` includes physics parameters and camera settings
- FPS capping available in `Game.ts` for high refresh rate displays
