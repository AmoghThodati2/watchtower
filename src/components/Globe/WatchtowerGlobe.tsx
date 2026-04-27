import { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import { useStore } from '../../state/store';
import { parseTLE, propagateToCartesian, getFutureTrajectory, getOrbitTrail } from '../../lib/propagation';
import { isDebrisObject } from '../../ontology/types';
import { TimeScrubBar } from './TimeScrubBar';
import { loadDebrisField } from '../../lib/debrisField';

(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium';

type SatPoint = {
  noradId: number;
  name: string;
  satrec: ReturnType<typeof parseTLE>;
  isOwned: boolean;
  primitive?: Cesium.PointPrimitive;
};

export function WatchtowerGlobe() {
  const outerRef   = useRef<HTMLDivElement>(null); // the flex cell
  const cesiumRef  = useRef<HTMLDivElement>(null); // Cesium mounts here
  const viewerRef  = useRef<Cesium.Viewer | null>(null);
  const pointCollRef = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const satPointsRef = useRef<SatPoint[]>([]);
  const rafRef     = useRef<number>(0);
  const animRafRef = useRef<number>(0);
  const conjPrimitivesRef = useRef<Cesium.Primitive[]>([]);
  const conjEntitiesRef   = useRef<Cesium.Entity[]>([]);

  // ── Debris field ────────────────────────────────────────────────────────────
  type DebrisPair = { satrec: NonNullable<ReturnType<typeof parseTLE>>; point: Cesium.PointPrimitive };
  const [debrisOn,          setDebrisOn]          = useState(false);
  const [debrisFullCatalog, setDebrisFullCatalog] = useState(false);
  const [debrisCount,       setDebrisCount]       = useState(0);
  const debrisCollRef     = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const debrisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debrisSatrecsRef  = useRef<DebrisPair[]>([]);

  const { conjunctions, selectedCdmId, fleet, showPostExecuteTrajectory, maneuverOptions } = useStore();
  const [scrubTime, setScrubTime] = useState<Date | null>(null);
  const [isReady, setIsReady] = useState(false);

  const selectedConj = conjunctions.find((c) => c.cdmId === selectedCdmId) ?? null;

  // ─── Cesium initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    // Set the Ion token inside the effect so it's definitely set before init
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string;
    console.log('[Cesium] Ion token present:', !!token, 'length:', token?.length);
    Cesium.Ion.defaultAccessToken = token;

    if (!cesiumRef.current || viewerRef.current) return;
    const container = cesiumRef.current;

    // ── Wait until the container has real pixel dimensions ──────────────────
    // Cesium measures the container synchronously at construction time.
    // If flex layout hasn't settled (width/height === 0) the canvas is tiny.
    const tryInit = () => {
      const rect = container.getBoundingClientRect();
      console.log('[Cesium] Container rect:', Math.round(rect.width), '×', Math.round(rect.height));

      if (rect.width < 10 || rect.height < 10) {
        // Not laid out yet — retry next frame
        rafRef.current = requestAnimationFrame(tryInit);
        return;
      }

      // ── Create viewer ─────────────────────────────────────────────────────
      const viewer = new Cesium.Viewer(container, {
        animation:              false,
        timeline:               false,
        baseLayerPicker:        false,
        geocoder:               false,
        homeButton:             false,
        sceneModePicker:        false,
        navigationHelpButton:   false,
        infoBox:                false,
        selectionIndicator:     false,
        fullscreenButton:       false,
        vrButton:               false,
        creditContainer:        document.createElement('div'),
        requestRenderMode:      false,
      });

      viewerRef.current = viewer;

      // Suppress render errors so a single bad frame never halts the loop
      viewer.scene.renderError.addEventListener((_scene, err) =>
        console.warn('[Cesium] render error (suppressed):', err)
      );

      // ── Globe appearance ──────────────────────────────────────────────────
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050810');
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.baseColor     = Cesium.Color.fromCssColorString('#111827'); // fallback if imagery absent
      if (viewer.scene.sun)  viewer.scene.sun.show  = false;
      if (viewer.scene.moon) viewer.scene.moon.show = false;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show             = true;
        viewer.scene.skyAtmosphere.hueShift         = -0.05;
        viewer.scene.skyAtmosphere.brightnessShift  = -0.3;
        viewer.scene.skyAtmosphere.saturationShift  = -0.15;
      }

      // ── Terrain — ellipsoid (no terrain workers needed) ───────────────────
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

      // ── Imagery — Cesium Ion hosted (free tier, asset IDs in priority order) ─
      viewer.imageryLayers.removeAll();
      // IonImageryProvider.fromAssetId is async; run in a detached IIFE so the
      // rest of init continues synchronously while tiles resolve in the background.
      (async () => {
        const assetIds = [2, 3, 3845]; // Bing Aerial, Bing Roads, Blue Marble
        for (const assetId of assetIds) {
          try {
            const provider = await Cesium.IonImageryProvider.fromAssetId(assetId);
            if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
            viewer.imageryLayers.removeAll();
            const layer = viewer.imageryLayers.addImageryProvider(provider);
            layer.brightness = 0.45;
            layer.contrast   = 1.15;
            layer.saturation = 0.35;
            console.log(`[Cesium] Ion imagery loaded successfully (asset ${assetId})`);
            return;
          } catch (err) {
            console.warn(`[Cesium] Ion asset ${assetId} failed:`, err);
          }
        }
        console.warn('[Cesium] All Ion imagery assets failed — globe shows solid baseColor');
      })();

      // ── Satellite point primitives ────────────────────────────────────────
      const pointColl = new Cesium.PointPrimitiveCollection();
      viewer.scene.primitives.add(pointColl);
      pointCollRef.current = pointColl;

      // ── Camera ────────────────────────────────────────────────────────────
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(10, 15, 22000000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      });

      // ── Force canvas to fill container before resize() measures it ───────
      // Cesium's .cesium-viewer div has no height by default; CSS in
      // globals.css sets it to 100%, but we also explicitly set the canvas
      // so clientWidth/clientHeight are correct before the first resize().
      viewer.canvas.style.width  = '100%';
      viewer.canvas.style.height = '100%';

      // ── Canvas sizing audit ───────────────────────────────────────────────
      console.log('[Cesium] Canvas dims after init:',
        viewer.canvas.width, '×', viewer.canvas.height,
        '| clientWidth:', viewer.canvas.clientWidth, '| clientHeight:', viewer.canvas.clientHeight
      );

      // Force Cesium to re-measure the canvas now that we know dimensions
      viewer.resize();
      console.log('[Cesium] Canvas dims after resize():',
        viewer.canvas.width, '×', viewer.canvas.height
      );

      // ── ResizeObserver — keeps canvas in sync if the panel opens/closes ──
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const { width, height } = e.contentRect;
          console.log('[Cesium] ResizeObserver fired:', Math.round(width), '×', Math.round(height));
        }
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.resize();
        }
      });
      ro.observe(container);

      setIsReady(true);

      // Store cleanup
      (viewer as Cesium.Viewer & { _ro?: ResizeObserver })._ro = ro;
    };

    rafRef.current = requestAnimationFrame(tryInit);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(animRafRef.current);
      if (viewerRef.current) {
        const v = viewerRef.current as Cesium.Viewer & { _ro?: ResizeObserver };
        v._ro?.disconnect();
        if (!v.isDestroyed()) v.destroy();
        viewerRef.current = null;
      }
      setIsReady(false);
    };
  }, []);

  // ─── Satellite point initialisation ────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !pointCollRef.current) return;
    const pointColl = pointCollRef.current;
    pointColl.removeAll();
    satPointsRef.current = [];

    fleet.forEach((sat) => {
      const satrec = parseTLE(sat.tle.line1, sat.tle.line2);
      if (!satrec) return;
      const point = pointColl.add({
        position:     Cesium.Cartesian3.ZERO,
        color:        Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0.9),
        pixelSize:    6,
        outlineColor: Cesium.Color.fromCssColorString('#00D4FF').withAlpha(0.25),
        outlineWidth: 3,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1.5, 2e7, 0.6),
      });
      satPointsRef.current.push({ noradId: sat.noradId, name: sat.name, satrec, isOwned: true, primitive: point });
    });
  }, [isReady, fleet]);

  // ─── Per-frame position animation ──────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;
    const animate = () => {
      const now = scrubTime ?? new Date();
      satPointsRef.current.forEach((sp) => {
        if (!sp.primitive || !sp.satrec) return;
        const pos = propagateToCartesian(sp.satrec, now);
        if (pos) sp.primitive.position = pos;
      });
      animRafRef.current = requestAnimationFrame(animate);
    };
    animRafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRafRef.current);
  }, [isReady, scrubTime]);

  // ─── Conjunction trajectory rendering ──────────────────────────────────────
  useEffect(() => {
    const clearScene = () => {
      const v = viewerRef.current;
      if (!v || v.isDestroyed()) return;
      conjPrimitivesRef.current.forEach((p) => { try { v.scene.primitives.remove(p); } catch { /**/ } });
      conjPrimitivesRef.current = [];
      conjEntitiesRef.current.forEach((e) => { try { v.entities.remove(e); } catch { /**/ } });
      conjEntitiesRef.current = [];
    };

    if (!isReady || !viewerRef.current) return clearScene;
    clearScene(); // remove anything drawn for a previous selection

    if (!selectedConj) return clearScene;

    const viewer = viewerRef.current;
    const primarySatrec   = parseTLE(selectedConj.primary.tle.line1, selectedConj.primary.tle.line2);
    const secondaryTLE    = isDebrisObject(selectedConj.secondary) ? selectedConj.secondary.tle : selectedConj.secondary.tle;
    const secondarySatrec = parseTLE(secondaryTLE.line1, secondaryTLE.line2);
    if (!primarySatrec) return clearScene;

    const now = new Date();
    const tca = new Date(selectedConj.tca);

    const primaryNow      = propagateToCartesian(primarySatrec, now);
    const primaryTcaPos   = propagateToCartesian(primarySatrec, tca);
    const secondaryTcaPos = secondarySatrec
      ? propagateToCartesian(secondarySatrec, tca)
      : null;

    // Midpoint between both objects at TCA — this is the true closest-approach
    // location. Placing the marker here means both trajectory arcs pass through it.
    const tcaPos = primaryTcaPos && secondaryTcaPos
      ? Cesium.Cartesian3.lerp(primaryTcaPos, secondaryTcaPos, 0.5, new Cesium.Cartesian3())
      : primaryTcaPos;

    // ── Camera fly-to ────────────────────────────────────────────────────────
    // Position ~4× Earth radius above the TCA midpoint so Earth + both arcs fit.
    const flyTarget = tcaPos ?? primaryNow;
    if (flyTarget) {
      const dir     = Cesium.Cartesian3.normalize(flyTarget, new Cesium.Cartesian3());
      const camDist = Cesium.Ellipsoid.WGS84.maximumRadius * 4.0;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.multiplyByScalar(dir, camDist, new Cesium.Cartesian3()),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
        duration: 2.2,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    }

    const addLine = (positions: Cesium.Cartesian3[], color: string, alpha: number, width: number) => {
      if (positions.length < 2) return;
      const prim = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.PolylineGeometry({ positions, width }),
          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString(color).withAlpha(alpha)) },
        }),
        appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
      });
      viewer.scene.primitives.add(prim);
      conjPrimitivesRef.current.push(prim);
    };

    // ── Trajectory window: −30 min → +5 min, dense near TCA ─────────────────
    // Outside ±5 min: 60 s steps (coarse, ~25 pts). Inside ±5 min: 10 s steps
    // (~60 pts) so the convergence geometry is clearly resolved at the marker.
    const approachStart = new Date(tca.getTime() - 30 * 60 * 1000);
    const approachEnd   = new Date(tca.getTime() +  5 * 60 * 1000);
    const tcaMinus5     = new Date(tca.getTime() -  5 * 60 * 1000);

    addLine(getOrbitTrail(primarySatrec, now, 30, 60), '#00D4FF', 0.2, 1);
    addLine([
      ...getFutureTrajectory(primarySatrec, approachStart, tcaMinus5, 60),
      ...getFutureTrajectory(primarySatrec, tcaMinus5, approachEnd, 10),
    ], '#00D4FF', 0.8, 2.5);
    if (secondarySatrec) {
      addLine([
        ...getFutureTrajectory(secondarySatrec, approachStart, tcaMinus5, 60),
        ...getFutureTrajectory(secondarySatrec, tcaMinus5, approachEnd, 10),
      ], '#FF3838', 0.75, 2);
    }

    // ── Miss-distance indicator ───────────────────────────────────────────────
    // The actual separation at TCA (e.g. 280 m) is invisible at globe scale,
    // so we draw an exaggerated 50 km line in the miss direction and label it.
    if (primaryTcaPos && secondaryTcaPos && tcaPos) {
      const missVec  = Cesium.Cartesian3.subtract(secondaryTcaPos, primaryTcaPos, new Cesium.Cartesian3());
      const missNorm = Cesium.Cartesian3.normalize(missVec, new Cesium.Cartesian3());
      const halfExag = 25000; // half of 50 000 m

      const exagA = Cesium.Cartesian3.subtract(
        tcaPos,
        Cesium.Cartesian3.multiplyByScalar(missNorm, halfExag, new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      );
      const exagB = Cesium.Cartesian3.add(
        tcaPos,
        Cesium.Cartesian3.multiplyByScalar(missNorm, halfExag, new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      );

      // Dashed white line along miss vector
      conjEntitiesRef.current.push(viewer.entities.add({
        polyline: {
          positions: [exagA, exagB],
          width: 1.5,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.WHITE.withAlpha(0.7),
            dashLength: 16.0,
            gapColor: Cesium.Color.TRANSPARENT,
          }),
        },
      }));

      // Actual miss distance
      conjEntitiesRef.current.push(viewer.entities.add({
        position: tcaPos,
        label: {
          text: `${Math.round(selectedConj.missDistanceM)} m`,
          font: '11px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, 28),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: false,
        },
      }));

      // Scale note
      conjEntitiesRef.current.push(viewer.entities.add({
        position: tcaPos,
        label: {
          text: '(not to scale)',
          font: '9px sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#9CA3AF'),
          style: Cesium.LabelStyle.FILL,
          pixelOffset: new Cesium.Cartesian2(0, 42),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: false,
        },
      }));
    }

    // ── TCA marker ───────────────────────────────────────────────────────────
    if (tcaPos) {
      // Pulse: scale 1.0 → 1.4 → 1.0 over 1.5 s using wall-clock time so it
      // runs independently of Cesium's simulation clock.
      const pulseRadii = new Cesium.CallbackProperty(() => {
        const t = (performance.now() / 1500) % 1; // 0→1 over 1.5 s
        const scale = 1.0 + 0.4 * Math.sin(t * Math.PI);
        const r = 80000 * scale; // 80 km base radius
        return new Cesium.Cartesian3(r, r, r);
      }, false);

      // Inner pulsing sphere + "TCA" label on the same entity
      conjEntitiesRef.current.push(viewer.entities.add({
        position: tcaPos,
        ellipsoid: {
          radii: pulseRadii,
          material: Cesium.Color.fromCssColorString('#FF3838').withAlpha(0.65),
          outline: false,
        },
        label: {
          text: 'CLOSEST APPROACH',
          font: '11px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(20, -22),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: false,
        },
      }));

      // Outer glow ring — static, faint
      conjEntitiesRef.current.push(viewer.entities.add({
        position: tcaPos,
        ellipsoid: {
          radii: new Cesium.Cartesian3(200000, 200000, 200000),
          material: Cesium.Color.fromCssColorString('#FF3838').withAlpha(0.12),
          outline: false,
        },
      }));
    }

    // ── Post-maneuver diverging path (same ±90 min window, offset radially) ─
    const postExecute = showPostExecuteTrajectory[selectedConj.cdmId];
    if (postExecute && primarySatrec) {
      const opts   = maneuverOptions[selectedConj.cdmId] ?? [];
      const opt    = opts.find((o) => o.label === 'B') ?? opts[1];
      const offset = opt ? opt.deltaVMs * 0.0003 : 0.0002;
      const postEnd   = new Date(tca.getTime() + 30 * 60 * 1000);
      const postTraj = getFutureTrajectory(primarySatrec, approachStart, postEnd, 30)
        .map((p) => new Cesium.Cartesian3(p.x * (1 + offset), p.y * (1 + offset), p.z * (1 + offset)));
      addLine(postTraj, '#00E676', 0.9, 2.5);
    }

    return clearScene;
  // selectedCdmId (string) is a stable dep; selectedConj is read from the render
  // closure and is always current when the effect fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, selectedCdmId, showPostExecuteTrajectory[selectedCdmId ?? ''], !!selectedCdmId]);

  // ─── Debris field propagation ───────────────────────────────────────────────
  useEffect(() => {
    const clearDebris = () => {
      if (debrisIntervalRef.current !== null) {
        clearInterval(debrisIntervalRef.current);
        debrisIntervalRef.current = null;
      }
      const v = viewerRef.current;
      if (debrisCollRef.current) {
        if (v && !v.isDestroyed()) {
          try { v.scene.primitives.remove(debrisCollRef.current); } catch { /**/ }
        }
        debrisCollRef.current = null;
      }
      debrisSatrecsRef.current = [];
    };

    clearDebris(); // remove any collection from a previous render
    if (!isReady || !viewerRef.current || !debrisOn) return clearDebris;

    let active = true;
    const cap = debrisFullCatalog ? 5000 : 3000;

    loadDebrisField(cap)
      .then((entries) => {
        if (!active || !viewerRef.current || viewerRef.current.isDestroyed()) return;
        const viewer = viewerRef.current;

        const coll = new Cesium.PointPrimitiveCollection();
        viewer.scene.primitives.add(coll);
        debrisCollRef.current = coll;

        const red = Cesium.Color.fromCssColorString('#FF3838').withAlpha(0.55);
        const now = new Date();
        const pairs: DebrisPair[] = [];

        entries.forEach(({ line1, line2 }) => {
          const satrec = parseTLE(line1, line2);
          if (!satrec) return;
          const pos = propagateToCartesian(satrec, now) ?? Cesium.Cartesian3.ZERO;
          const point = coll.add({ position: pos, color: red, pixelSize: 2 });
          pairs.push({ satrec, point });
        });

        debrisSatrecsRef.current = pairs;
        setDebrisCount(pairs.length);

        // Batch re-propagate every 8 s — debris cloud is too dense for the eye
        // to track individual motion, so this cadence reads as continuous.
        debrisIntervalRef.current = setInterval(() => {
          const t = new Date();
          debrisSatrecsRef.current.forEach(({ satrec, point }) => {
            const pos = propagateToCartesian(satrec, t);
            if (pos) point.position = pos;
          });
        }, 8000);
      })
      .catch((err) => { if (active) console.error('[Debris] load failed:', err); });

    return () => { active = false; clearDebris(); };
  }, [isReady, debrisOn, debrisFullCatalog]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrub = useCallback((t: Date | null) => setScrubTime(t), []);

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0 }}>
      {/* Cesium container — must be position:relative so Cesium's internal
          absolutely-positioned canvas anchors inside it */}
      <div
        ref={cesiumRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          overflow: 'hidden',
        }}
      />

      {/* ── HUD overlays ─────────────────────────────────────────────────── */}
      {selectedConj && (
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          padding: '8px 12px', borderRadius: 6,
          background: 'rgba(10,14,20,0.85)', border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
          color: 'var(--accent-cyan)', pointerEvents: 'none',
        }}>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginBottom: 2 }}>ACTIVE CONJUNCTION</div>
          <div>{selectedConj.primary.name} ↔ {('name' in selectedConj.secondary) ? selectedConj.secondary.name : 'DEBRIS'}</div>
          <div style={{ color: 'var(--accent-red)', marginTop: 2 }}>
            TCA T-{Math.round((new Date(selectedConj.tca).getTime() - Date.now()) / 3600000)}h
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 10,
        padding: '8px 12px', borderRadius: 6,
        background: 'rgba(10,14,20,0.85)', border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(8px)',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        color: 'var(--text-tertiary)', pointerEvents: 'none',
      }}>
        <div style={{ color: 'var(--accent-cyan)' }}>● {fleet.length} ARC SATELLITES</div>
        <div style={{ marginTop: 2 }}>◉ LIVE SGP4 PROPAGATION</div>

        {/* Debris toggle — interactive children override pointer-events */}
        <div
          style={{
            marginTop: 6, cursor: 'pointer', pointerEvents: 'auto',
            color: debrisOn ? 'var(--accent-red)' : 'var(--text-tertiary)',
            userSelect: 'none',
          }}
          onClick={() => setDebrisOn((v) => !v)}
        >
          {debrisOn ? '●' : '○'} DEBRIS FIELD [{debrisOn ? 'ON' : 'OFF'}]
        </div>

        {debrisOn && (
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            <div>{debrisCount.toLocaleString()} TRACKED FRAGMENTS</div>
            <div style={{ opacity: 0.7 }}>IRIDIUM-33 · COSMOS-2251 · FY-1C · COSMOS-1408</div>
            <div
              style={{
                marginTop: 2, cursor: 'pointer', pointerEvents: 'auto',
                color: 'var(--accent-cyan)', textDecoration: 'underline',
                userSelect: 'none',
              }}
              onClick={(e) => { e.stopPropagation(); setDebrisFullCatalog((v) => !v); }}
            >
              {debrisFullCatalog ? '[DEFAULT CAP]' : '[FULL CATALOG]'}
            </div>
          </div>
        )}
      </div>

      {selectedConj && <TimeScrubBar tca={selectedConj.tca} onScrub={handleScrub} />}
    </div>
  );
}
