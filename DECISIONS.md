# Architectural Decisions

## CesiumJS Direct vs. Resium
Used CesiumJS directly (not resium React bindings) for fine-grained control over PointPrimitiveCollection LOD, 
custom polyline rendering, and camera animation. Resium's Entity API would have been too high-level for 
performant satellite rendering at 24+ objects with per-frame updates.

## Cesium Polyline Approach
Used `PolylineColorAppearance` with `ColorGeometryInstanceAttribute` (instead of PolylineMaterialAppearance 
with a color material) because the per-instance color API integrates cleanly with the batched Primitive renderer.

## Imagery Layer
Used Cesium's bundled NaturalEarth II imagery (TileMapServiceImageryProvider) instead of Bing Maps for two 
reasons: (1) no API key required, (2) muted blues/greens look better with a dark color grade.

## TLE Propagation in Browser
Ran SGP4 propagation on the main thread via requestAnimationFrame. For 24 satellites at 60fps this is ~0.2ms/frame, 
well within budget. Web Workers would only be needed if rendering 500+ objects simultaneously.

## CDM Queue Data
CDMs are fully synthetic but use real TLE data from Celestrak for secondary objects (Iridium-33 debris, Cosmos-2251 
debris). The hero conjunction (ARC-07 vs IRIDIUM 33 DEB) uses a hand-crafted TLE designed so the orbits 
visually converge near the equatorial plane in ~47 hours.

## Maneuver Simulation
Used simplified vis-viva linear approximation: miss distance grows proportional to Δv × time-to-TCA. 
Flight-grade computation would require proper Monte Carlo P_c integration with covariance propagation — 
overkill for a 3-minute demo.

## Anthropic SDK in Browser
Set `dangerouslyAllowBrowser: true` since this is a demo app with no backend. For production, API calls 
would route through a server to avoid key exposure.

## State Management
Zustand chosen over Redux/Jotai for minimal boilerplate and the ability to access store state outside React 
(useful for Cesium event handlers that live outside the React tree).

## No Backend
Pure in-memory. Zustand holds all state. A refresh resets everything. This is the correct design for a 
timed demo — no auth, no DB setup friction.
