/* 轻量化世界地图渲染器（Canvas，无第三方依赖）
   · 底图：本地缓存的 Natural Earth 110m 国界几何，离线可用，按访问来源分域配置
   · 要素：站点点，支持视口裁剪、按类型/状态着色、聚合显示
   · 交互：平移、缩放、框选（空间检索）、悬停提示、点选
   与架构要求一致：底图仅更换渲染样式，不改变要素坐标。 */

const MERC = 180 / Math.PI;

const PALETTE = {
  type: {
    "Land (fixed)": "#38d6d0",
    "Land (mobile)": "#7bd389",
    "Land (on ice)": "#9fd8ff",
    "Sea (fixed)": "#4f8cff",
    "Sea (mobile)": "#6ea8ff",
    "Sea (on ice)": "#8fd0ff",
    "Lake/River (fixed)": "#5ad1e6",
    "Lake/River (mobile)": "#7ee0f2",
    "Air (fixed)": "#a78bfa",
    "Air (mobile)": "#c4b5fd",
    "Underwater (fixed)": "#f5b544",
    "Underwater (mobile)": "#f7c96b",
  },
  status: {
    Operational: "#42d392",
    "Partly operational": "#f5b544",
    "Not operational": "#ff6f6f",
    Closed: "#7b8ba6",
    Seasonal: "#4f8cff",
    Intermittent: "#a78bfa",
    Unknown: "#5c6f8a",
  },
};

const DEFAULT_COLOR = "#8ea3c4";

function mercY(lat) {
  const clamped = Math.max(-85, Math.min(85, lat));
  return MERC * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}
function invMercY(y) {
  return ((Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 4) * 2 * 180) / Math.PI;
}

export function createMap(container, opts = {}) {
  const canvas = document.createElement("canvas");
  const tip = document.createElement("div");
  tip.className = "map-tip";
  tip.hidden = true;
  container.appendChild(canvas);
  container.appendChild(tip);
  const ctx = canvas.getContext("2d");

  const state = {
    basemap: null,
    points: [],
    colorMode: "type",
    basemapStyle: "intl",
    mode: "pan",
    selected: null,
    bbox: null,
    cx: 0, cy: 0, k: 1,
    fitK: 1,
    hover: null,
    drag: null,
    rect: null,
  };
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = container.getBoundingClientRect();
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(240, Math.round(rect.height || rect.width * 0.5));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = "100%";
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.fitK = W / 360;
    if (!state.k || state.k === 1) state.k = state.fitK;
    clampView();
    render();
  }

  function sx(wx) { return (wx - state.cx) * state.k + W / 2; }
  function sy(wy) { return H / 2 - (wy - state.cy) * state.k; }
  function wx(px) { return (px - W / 2) / state.k + state.cx; }
  function wy(py) { return (H / 2 - py) / state.k + state.cy; }

  function clampView() {
    state.k = Math.max(state.fitK * 0.6, Math.min(state.fitK * 60, state.k));
    const halfW = W / (2 * state.k);
    const halfH = H / (2 * state.k);
    if (halfW >= 180) state.cx = 0;
    else state.cx = Math.max(-180 + halfW, Math.min(180 - halfW, state.cx));
    if (halfH >= 180) state.cy = 0;
    else state.cy = Math.max(-180 + halfH, Math.min(180 - halfH, state.cy));
  }

  function isDark() { return document.body.dataset.theme !== "light"; }

  function colorOf(p) {
    const table = PALETTE[state.colorMode] || PALETTE.type;
    // 上游枚举偶含尾随空格（如 "Land (on ice) "），去空白后再匹配配色
    const key = state.colorMode === "type"
      ? String(p.type || "").trim()
      : String(p.decl || p.status || "Unknown").trim();
    return table[key] || DEFAULT_COLOR;
  }

  function render() {
    const dark = isDark();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = dark ? "#070d1c" : "#e9eff8";
    ctx.fillRect(0, 0, W, H);

    // 经纬网
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? "rgba(120,160,220,.10)" : "rgba(30,60,110,.10)";
    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = sx(lon);
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let lat = -80; lat <= 80; lat += 20) {
      const y = sy(mercY(lat));
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();

    // 赤道与本初子午线
    ctx.strokeStyle = dark ? "rgba(120,160,220,.24)" : "rgba(30,60,110,.22)";
    ctx.beginPath();
    ctx.moveTo(0, sy(0)); ctx.lineTo(W, sy(0));
    ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), H);
    ctx.stroke();

    // 国界
    if (state.basemap) {
      const cn = state.basemapStyle === "cn";
      ctx.fillStyle = dark ? (cn ? "rgba(56,120,110,.18)" : "rgba(40,72,120,.22)")
        : (cn ? "rgba(200,225,222,.9)" : "rgba(255,255,255,.85)");
      ctx.strokeStyle = dark ? (cn ? "rgba(90,200,190,.45)" : "rgba(120,170,230,.35)")
        : (cn ? "rgba(60,140,130,.55)" : "rgba(70,110,160,.45)");
      ctx.lineWidth = 0.7;
      for (const f of state.basemap.features) {
        // 底图几何存在两种嵌套深度：Polygon 为「环列表」(2 层)，
        // MultiPolygon 为「多边形列表 → 环列表」(3 层)。须按深度判别，
        // 否则Polygon 会被当成多边形逐点拆开而整体渲染失败。
        const g = f.g || [];
        const isMulti = Array.isArray(g[0]) && Array.isArray(g[0][0]) && Array.isArray(g[0][0][0]);
        const polys = isMulti ? g : [g];
        for (const rings of polys) {
          if (!rings || !rings.length) continue;
          ctx.beginPath();
          for (const ring of rings) {
            for (let i = 0; i < ring.length; i++) {
              const px = sx(ring[i][0]), py = sy(mercY(ring[i][1]));
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
          }
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 站点
    const r = Math.min(4.2, 1.6 + Math.log2(Math.max(1, state.k / state.fitK)) * 0.9);
    let visible = 0;
    for (const p of state.points) {
      if (p.lat == null || p.lon == null) continue;
      const px = sx(p.lon), py = sy(mercY(p.lat));
      if (px < -8 || px > W + 8 || py < -8 || py > H + 8) continue;
      visible++;
      const selected = state.selected != null && String(p.id) === String(state.selected);
      ctx.beginPath();
      ctx.arc(px, py, selected ? r + 3 : r, 0, Math.PI * 2);
      ctx.fillStyle = colorOf(p);
      ctx.globalAlpha = selected ? 1 : 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (selected) {
        ctx.beginPath();
        ctx.arc(px, py, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = colorOf(p);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    state.visible = visible;

    // 框选矩形
    if (state.rect) {
      const { x0, y0, x1, y1 } = state.rect;
      ctx.strokeStyle = "#38d6d0";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.fillStyle = "rgba(56,214,208,.10)";
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.setLineDash([]);
    }

    if (opts.onView) opts.onView({ visible, zoom: state.k / state.fitK });
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; render(); });
  }

  function pick(px, py) {
    let best = null, bestD = 10;
    for (const p of state.points) {
      if (p.lat == null || p.lon == null) continue;
      const d = Math.hypot(sx(p.lon) - px, sy(mercY(p.lat)) - py);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function localPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (ev) => {
    const { x, y } = localPos(ev);
    state.drag = { x, y, moved: 0, startX: x, startY: y, cx: state.cx, cy: state.cy };
    if (state.mode === "bbox") state.rect = { x0: x, y0: y, x1: x, y1: y };
    else container.classList.add("canvas-drag");
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", (ev) => {
    const { x, y } = localPos(ev);
    if (state.drag) {
      const dx = x - state.drag.startX, dy = y - state.drag.startY;
      state.drag.moved = Math.max(state.drag.moved, Math.hypot(dx, dy));
      if (state.mode === "bbox") {
        state.rect = { x0: state.drag.startX, y0: state.drag.startY, x1: x, y1: y };
      } else {
        state.cx = state.drag.cx - dx / state.k;
        state.cy = state.drag.cy + dy / state.k;
        clampView();
      }
      schedule();
      return;
    }
    if (state.mode === "pan") {
      const hit = pick(x, y);
      state.hover = hit;
      if (hit) {
        tip.hidden = false;
        tip.innerHTML = `<b>${hit.name || "—"}</b><span>${hit.wigos || ""}</span>`
          + `<span>${hit.type || ""} · ${hit.decl || ""}</span>`;
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = `${Math.min(W - tw - 6, x + 12)}px`;
        tip.style.top = `${Math.max(6, y - th - 10)}px`;
      } else {
        tip.hidden = true;
      }
    }
  });

  canvas.addEventListener("pointerup", (ev) => {
    const { x, y } = localPos(ev);
    container.classList.remove("canvas-drag");
    const drag = state.drag;
    state.drag = null;
    if (state.mode === "bbox" && state.rect) {
      const { x0, y0, x1, y1 } = state.rect;
      state.rect = null;
      if (Math.abs(x1 - x0) > 6 && Math.abs(y1 - y0) > 6) {
        const a = { lon: wx(Math.min(x0, x1)), lat: invMercY(wy(Math.max(y0, y1))) };
        const b = { lon: wx(Math.max(x0, x1)), lat: invMercY(wy(Math.min(y0, y1))) };
        const bbox = [
          Math.max(-180, Math.min(a.lon, b.lon)), Math.max(-85, Math.min(a.lat, b.lat)),
          Math.min(180, Math.max(a.lon, b.lon)), Math.min(85, Math.max(a.lat, b.lat)),
        ].map((n) => Number(n.toFixed(3)));
        state.bbox = bbox;
        if (opts.onBbox) opts.onBbox(bbox);
      }
      schedule();
      return;
    }
    if (drag && drag.moved < 5) {
      const hit = pick(x, y);
      if (hit && opts.onPointClick) opts.onPointClick(hit);
    }
  });

  canvas.addEventListener("pointerleave", () => { tip.hidden = true; });

  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const { x, y } = localPos(ev);
    const before = { wx: wx(x), wy: wy(y) };
    const factor = Math.exp(-ev.deltaY * 0.0016);
    state.k *= factor;
    clampView();
    // 保持光标下的地理点不动
    state.cx = before.wx - (x - W / 2) / state.k;
    state.cy = before.wy + (y - H / 2) / state.k;
    clampView();
    schedule();
  }, { passive: false });

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  return {
    setBasemap(bm) { state.basemap = bm; schedule(); },
    setPoints(points) { state.points = points || []; schedule(); },
    setColorMode(m) { state.colorMode = m; schedule(); },
    setBasemapStyle(s) { state.basemapStyle = s; schedule(); },
    setMode(m) {
      state.mode = m;
      container.classList.toggle("mode-bbox", m === "bbox");
      if (m === "pan") state.rect = null;
      schedule();
    },
    setSelected(id) { state.selected = id; schedule(); },
    setBBox(bbox) { state.bbox = bbox; schedule(); },
    clearBBox() { state.bbox = null; state.rect = null; schedule(); },
    focus(lon, lat, zoom = 8) {
      if (lon == null || lat == null) return;
      state.cx = lon; state.cy = mercY(lat); state.k = state.fitK * zoom;
      clampView();
      schedule();
    },
    reset() { state.cx = 0; state.cy = 0; state.k = state.fitK; state.bbox = null; clampView(); schedule(); },
    getZoom() { return state.k / state.fitK; },
    setZoom(z) { state.k = state.fitK * z; clampView(); schedule(); },
    visibleCount() { return state.visible || 0; },
    legend() {
      const table = PALETTE[state.colorMode] || PALETTE.type;
      return Object.entries(table);
    },
    resize,
    render: schedule,
    destroy() { ro.disconnect(); canvas.remove(); tip.remove(); },
  };
}
