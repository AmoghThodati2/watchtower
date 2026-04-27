import { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useStore } from '../../state/store';
import { ARCLIGHT_FLEET } from '../../ontology/fixtures';
import { parseTLE, propagateToCartesian, getFutureTrajectory, getOrbitTrail } from '../../lib/propagation';
import { isDebrisObject } from '../../ontology/types';
import { TimeScrubBar } from './TimeScrubBar';

(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium';
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string;

type SatPoint = {
  noradId: number;
  name: string;
  satrec: ReturnType<typeof parseTLE>;
  isOwned: boolean;
  primitive?: Cesium.PointPrimitive;
};

export function WatchtowerGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const pointCollRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const satPointsRef = useRef<SatPoint[]>([]);
  const rafRef = useRef<number>(0);
  const conjPrimitivesRef = useRef<Cesium.Primitive[]>([]);
  const conjEntitiesRef = useRef<Cesium.Entity[]>([]);

  const { conjunctions, selectedCdmId, fleet, showPostExecuteTrajectory, maneuverOptions } = useStore();
  const [scrubTime, setScrubTime] = useState<Date | null>(null);
  const [isReady, setIsReady] = useState(false);

  const selectedConj = conjunctions.find((c) => c.cdmId === selectedCdmId) ?? null;

  // Initialize Cesium viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenButton: false,
      vrButton: false,
      creditContainer: document.createElement('div'),
      requestRenderMode: false,
    });

    viewerRef.current = viewer;

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0A0E14');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0D1117');
    viewer.scene.globe.enableLighting = true;

    if (viewer.scene.skyBox) {
      (viewer.scene.skyBox as Cesium.SkyBox & { show?: boolean }).show = true;
    }
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;

    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.hueShift = -0.05;
      viewer.scene.skyAtmosphere.brightnessShift = -0.4;
      viewer.scene.skyAtmosphere.saturationShift = -0.2;
    }

    viewer.imageryLayers.removeAll();
    try {
      const naturalEarth = viewer.imageryLayers.addImageryProvider(
        new Cesium.TileMapServiceImageryProvider({
          url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
        } as ConstructorParameters<typeof Cesium.TileMapServiceImageryProvider>[0])
      );
      if (naturalEarth) {
        naturalEarth.brightness = 0.22;
        naturalEarth.contrast = 0.85;
        naturalEarth.saturation = 0.3;
      }
    } catch {
      // Use default imagery if NaturalEarth fails
    }

    const pointColl = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(pointColl);
    pointCollRef.current = pointColl;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, 20, 25000000),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
    });

    setIsReady(true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Initialize satellite points
  useEffect(() => {
    if (!isReady || !pointCollRef.current) return;
    const pointColl = pointCollRef.current;

    pointColl.removeAll();
    satPointsRef.current = [];

    fleet.forEach((sat) => {
      const satrec = parseTLE(sat.tle.line1, sat.tle.line2);
      if (!satrec) return;

      const point = pointColl.add({
        position: Cesium.Cartesian3.ZERO,
        color: Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0.9),
        pixelSize: 6,
        outlineColor: Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0.25),
        outlineWidth: 3,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1.5, 2e7, 0.6),
      });

      satPointsRef.current.push({ noradId: sat.noradId, name: sat.name, satrec, isOwned: true, primitive: point });
    });
  }, [isReady, fleet]);

  // Animate positions
  useEffect(() => {
    if (!isReady) return;

    const animate = () => {
      const now = scrubTime ?? new Date();
      satPointsRef.current.forEach((sp) => {
        if (!sp.primitive || !sp.satrec) return;
        const pos = propagateToCartesian(sp.satrec, now);
        if (pos) sp.primitive.position = pos;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isReady, scrubTime]);

  // Conjunction trajectories
  useEffect(() => {
    if (!isReady || !viewerRef.current) return;
    const viewer = viewerRef.current;

    conjPrimitivesRef.current.forEach((p) => {
      try { viewer.scene.primitives.remove(p); } catch { /* ignore */ }
    });
    conjPrimitivesRef.current = [];
    conjEntitiesRef.current.forEach((e) => { try { viewer.entities.remove(e); } catch { /* ignore */ } });
    conjEntitiesRef.current = [];

    if (!selectedConj) return;

    const primarySatrec = parseTLE(selectedConj.primary.tle.line1, selectedConj.primary.tle.line2);
    const secondaryTLE = isDebrisObject(selectedConj.secondary)
      ? selectedConj.secondary.tle
      : selectedConj.secondary.tle;
    const secondarySatrec = parseTLE(secondaryTLE.line1, secondaryTLE.line2);

    if (!primarySatrec) return;

    const now = new Date();
    const tca = new Date(selectedConj.tca);

    // Fly to primary
    const primaryNow = propagateToCartesian(primarySatrec, now);
    if (primaryNow) {
      const dist = Cesium.Cartesian3.magnitude(primaryNow);
      const scale = 1.4;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromElements(
          primaryNow.x * scale,
          primaryNow.y * scale,
          primaryNow.z * scale
        ),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
        duration: 2.2,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    }

    // Orbit trail behind primary (last 30 min) — dim cyan
    const trail = getOrbitTrail(primarySatrec, now, 30, 60);
    if (trail.length > 1) {
      const trailPrim = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.PolylineGeometry({ positions: trail, width: 1 }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0.2)
            ),
          },
        }),
        appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
      });
      viewer.scene.primitives.add(trailPrim);
      conjPrimitivesRef.current.push(trailPrim);
    }

    // Primary trajectory — cyan
    const primTraj = getFutureTrajectory(primarySatrec, now, tca, 90);
    if (primTraj.length > 1) {
      const primPrim = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.PolylineGeometry({ positions: primTraj, width: 2.5 }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0.8)
            ),
          },
        }),
        appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
      });
      viewer.scene.primitives.add(primPrim);
      conjPrimitivesRef.current.push(primPrim);
    }

    // Secondary trajectory — red
    if (secondarySatrec) {
      const secTraj = getFutureTrajectory(secondarySatrec, now, tca, 90);
      if (secTraj.length > 1) {
        const secPrim = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({ positions: secTraj, width: 2 }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.fromCssColorString('#FF3838').withAlpha(0.75)
              ),
            },
          }),
          appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
          asynchronous: false,
        });
        viewer.scene.primitives.add(secPrim);
        conjPrimitivesRef.current.push(secPrim);
      }
    }

    // TCA pulsing sphere
    const tcaPos = propagateToCartesian(primarySatrec, tca);
    if (tcaPos) {
      const tcaEntity = viewer.entities.add({
        position: tcaPos,
        ellipsoid: {
          radii: new Cesium.Cartesian3(8000, 8000, 8000),
          material: Cesium.Color.fromCssColorString('#FF3838').withAlpha(0.4),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#FF3838'),
          outlineWidth: 2,
        },
      });
      conjEntitiesRef.current.push(tcaEntity);
    }

    // Post-maneuver green trajectory
    const showPost = showPostExecuteTrajectory[selectedConj.cdmId];
    if (showPost && primarySatrec) {
      const postEnd = new Date(tca.getTime() + 3600000);
      const postTraj = getFutureTrajectory(primarySatrec, now, postEnd, 90);
      if (postTraj.length > 1) {
        const opts = maneuverOptions[selectedConj.cdmId] ?? [];
        const opt = opts.find((o) => o.label === 'B') ?? opts[1];
        const offset = opt ? opt.deltaVMs * 0.0003 : 0.0002;
        const shifted = postTraj.map((p) => {
          const scale = 1 + offset;
          return new Cesium.Cartesian3(p.x * scale, p.y * scale, p.z * scale);
        });
        const postPrim = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({ positions: shifted, width: 2.5 }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                Cesium.Color.fromCssColorString('#00E676').withAlpha(0.9)
              ),
            },
          }),
          appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
          asynchronous: false,
        });
        viewer.scene.primitives.add(postPrim);
        conjPrimitivesRef.current.push(postPrim);
      }
    }
  }, [isReady, selectedConj, showPostExecuteTrajectory, maneuverOptions]);

  const handleScrub = useCallback((t: Date | null) => setScrubTime(t), []);

  return (
    <div className="relative w-full h-full" style={{ background: '#0A0E14' }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* HUD overlay */}
      {selectedConj && (
        <div
          className="absolute top-3 left-3 px-3 py-2 rounded text-xs font-mono pointer-events-none"
          style={{
            background: 'rgba(10, 14, 20, 0.85)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-cyan)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ color: 'var(--text-tertiary)', marginBottom: 2, fontSize: 10 }}>ACTIVE CONJUNCTION</div>
          <div>{selectedConj.primary.name} ↔ {('name' in selectedConj.secondary) ? selectedConj.secondary.name : 'DEBRIS'}</div>
          <div style={{ color: 'var(--accent-red)', marginTop: 2 }}>
            TCA T-{Math.round((new Date(selectedConj.tca).getTime() - Date.now()) / 3600000)}h
          </div>
        </div>
      )}

      <div
        className="absolute top-3 right-3 px-3 py-2 rounded text-xs font-mono pointer-events-none"
        style={{
          background: 'rgba(10, 14, 20, 0.85)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ color: 'var(--accent-cyan)' }}>● {fleet.length} ARC SATELLITES</div>
        <div style={{ marginTop: 2 }}>◉ LIVE SGP4 PROPAGATION</div>
      </div>

      {selectedConj && (
        <TimeScrubBar tca={selectedConj.tca} onScrub={handleScrub} />
      )}
    </div>
  );
}
