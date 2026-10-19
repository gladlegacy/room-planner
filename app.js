/* 방 배치 플래너 — 단일 파일, 빌드 불필요. 단위: cm */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'roomPlanner.v1';

  // ---------- 가구 카탈로그 ----------
  const CATALOG = [
    { cat: '침실', type: 'bed', name: '싱글 침대', w: 100, h: 200, color: '#a9c8f5' },
    { cat: '침실', type: 'bed', name: '퀸 침대', w: 150, h: 200, color: '#a9c8f5' },
    { cat: '침실', type: 'bed', name: '킹 침대', w: 180, h: 200, color: '#a9c8f5' },
    { cat: '침실', type: 'wardrobe', name: '옷장', w: 120, h: 60, color: '#d9b892' },
    { cat: '침실', type: 'box', name: '서랍장', w: 80, h: 45, color: '#d9b892' },
    { cat: '침실', type: 'box', name: '협탁', w: 45, h: 40, color: '#d9b892' },
    { cat: '거실', type: 'sofa', name: '3인 소파', w: 210, h: 90, color: '#9fb8a0' },
    { cat: '거실', type: 'sofa', name: '2인 소파', w: 160, h: 85, color: '#9fb8a0' },
    { cat: '거실', type: 'armchair', name: '1인 소파', w: 80, h: 80, color: '#9fb8a0' },
    { cat: '거실', type: 'tv', name: 'TV장', w: 180, h: 40, color: '#8d8f99' },
    { cat: '거실', type: 'table', name: '커피 테이블', w: 100, h: 50, color: '#c9a77c' },
    { cat: '거실', type: 'shelf', name: '책장', w: 80, h: 30, color: '#c9a77c' },
    { cat: '거실', type: 'rug', name: '러그', w: 200, h: 140, color: '#f1d9c8' },
    { cat: '거실', type: 'plant', name: '화분', w: 40, h: 40, color: '#7fbf7f' },
    { cat: '서재', type: 'desk', name: '책상', w: 120, h: 60, color: '#c9a77c' },
    { cat: '서재', type: 'chair', name: '의자', w: 50, h: 50, color: '#7d8bb0' },
    { cat: '주방', type: 'dining', name: '4인 식탁', w: 120, h: 80, color: '#c9a77c' },
    { cat: '주방', type: 'box', name: '냉장고', w: 90, h: 75, color: '#cfd6df' },
    { cat: '주방', type: 'washer', name: '세탁기', w: 60, h: 65, color: '#cfd6df' },
    { cat: '구조', type: 'door', name: '문', w: 90, h: 90, color: '#8d6e4f' },
    { cat: '구조', type: 'window', name: '창문', w: 120, h: 12, color: '#bfe3ff' },
    { cat: '구조', type: 'column', name: '기둥', w: 40, h: 40, color: '#9aa3b2' },
  ];
  const NO_COLLIDE = new Set(['rug', 'door', 'window']);
  const WALL_ITEMS = new Set(['door', 'window']);

  // ---------- 상태 ----------
  const defaultState = () => ({
    name: '내 방',
    room: { w: 400, h: 350, wall: 12 },
    settings: { grid: 10, snap: true, dims: true, collide: true },
    items: [],
  });
  let state = load() || sampleState();
  let selectedId = null;
  const view = { s: 1, ox: 0, oy: 0 };
  const undoStack = [], redoStack = [];
  let lastSnapshot = JSON.stringify(state);

  function sampleState() {
    const st = defaultState();
    const add = (name, x, y, rot = 0) => {
      const c = CATALOG.find(c => c.name === name);
      st.items.push({ id: uid(), type: c.type, name: c.name, w: c.w, h: c.h, color: c.color, x, y, rot });
    };
    add('러그', 255, 200);
    add('퀸 침대', 95, 100);
    add('협탁', 192.5, 20);
    add('옷장', 330, 30);
    add('책상', 340, 320);
    add('의자', 340, 265);
    add('화분', 30, 320);
    add('문', 145, 305);
    add('창문', 230, 0);
    return st;
  }

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); return validate(s) ? s : null; } catch { return null; }
  }
  function validate(s) {
    return s && s.room && Array.isArray(s.items) && typeof s.room.w === 'number' && typeof s.room.h === 'number';
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }

  // 변경 확정 → 실행취소 기록 + 저장
  function commit() {
    const snap = JSON.stringify(state);
    if (snap === lastSnapshot) return;
    undoStack.push(lastSnapshot);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    lastSnapshot = snap;
    save();
    updateButtons();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(lastSnapshot);
    lastSnapshot = undoStack.pop();
    state = JSON.parse(lastSnapshot);
    if (!getItem(selectedId)) selectedId = null;
    save(); syncForms(); render(); updateButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(lastSnapshot);
    lastSnapshot = redoStack.pop();
    state = JSON.parse(lastSnapshot);
    if (!getItem(selectedId)) selectedId = null;
    save(); syncForms(); render(); updateButtons();
  }
  function updateButtons() {
    $('[data-act="undo"]').disabled = !undoStack.length;
    $('[data-act="redo"]').disabled = !redoStack.length;
  }

  const getItem = id => state.items.find(i => i.id === id);
  const snapV = v => state.settings.snap ? Math.round(v / state.settings.grid) * state.settings.grid : Math.round(v);
  const norm = a => ((Math.round(a) % 360) + 360) % 360;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 기하 ----------
  function corners(it) {
    const r = it.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), hw = it.w / 2, hh = it.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]);
  }
  function overlap(a, b) {
    const pa = corners(a), pb = corners(b);
    for (const poly of [pa, pb]) {
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 4];
        const nx = y2 - y1, ny = x1 - x2;
        const proj = p => p.map(([x, y]) => x * nx + y * ny);
        const A = proj(pa), B = proj(pb);
        if (Math.max(...A) <= Math.min(...B) + 0.01 || Math.max(...B) <= Math.min(...A) + 0.01) return false;
      }
    }
    return true;
  }
  function problems() {
    const bad = new Map();
    if (!state.settings.collide) return bad;
    const { w, h } = state.room;
    const solid = state.items.filter(i => !NO_COLLIDE.has(i.type));
    for (const it of state.items) {
      if (WALL_ITEMS.has(it.type)) continue;
      if (corners(it).some(([x, y]) => x < -0.5 || y < -0.5 || x > w + 0.5 || y > h + 0.5)) bad.set(it.id, '방 밖으로 벗어났어요');
    }
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      if (overlap(solid[i], solid[j])) {
        if (!bad.has(solid[i].id)) bad.set(solid[i].id, `'${solid[j].name}'와(과) 겹쳐요`);
        if (!bad.has(solid[j].id)) bad.set(solid[j].id, `'${solid[i].name}'와(과) 겹쳐요`);
      }
    }
    return bad;
  }

  // ---------- 가구 모양 (로컬 좌표, 중심 0,0) ----------
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function shapeSVG(it, sw = 1.5) {
    const { w, h, color: c } = it, x = -w / 2, y = -h / 2, d = shade(c, 0.7), l = shade(c, 1.12);
    const st = `stroke="${d}" stroke-width="${sw}" vector-effect="non-scaling-stroke"`;
    const R = (rx, ry, rw, rh, f = c, r = 3, extra = '') => `<rect x="${rx}" y="${ry}" width="${Math.max(rw, 0)}" height="${Math.max(rh, 0)}" rx="${r}" fill="${f}" ${st} ${extra}/>`;
    switch (it.type) {
      case 'bed': {
        const pw = (w - 18) / 2, ph = Math.min(30, h * 0.15);
        return R(x, y, w, h, c, 4) + R(x + 6, y + 6, pw, ph, '#ffffff', 6) + R(x + 12 + pw, y + 6, pw, ph, '#ffffff', 6) +
          R(x + 3, y + h * 0.3, w - 6, h * 0.7 - 3, l, 4);
      }
      case 'sofa': {
        const bk = Math.min(22, h * 0.28), arm = Math.min(20, w * 0.12);
        return R(x, y, w, h, c, 8) + R(x, y, w, bk, d, 6) + R(x, y, arm, h, shade(c, 0.85), 6) + R(x + w - arm, y, arm, h, shade(c, 0.85), 6);
      }
      case 'armchair': {
        const bk = h * 0.25, arm = w * 0.18;
        return R(x, y, w, h, c, 10) + R(x, y, w, bk, d, 8) + R(x, y, arm, h, shade(c, 0.85), 8) + R(x + w - arm, y, arm, h, shade(c, 0.85), 8);
      }
      case 'wardrobe':
        return R(x, y, w, h, c, 2) + `<line x1="0" y1="${y}" x2="0" y2="${-y}" ${st}/>` +
          `<line x1="${x + 6}" y1="${y + h * 0.35}" x2="${-x - 6}" y2="${y + h * 0.35}" ${st} stroke-dasharray="4 3"/>`;
      case 'shelf': {
        let s = R(x, y, w, h, c, 2), n = Math.max(2, Math.round(w / 30));
        for (let i = 1; i < n; i++) s += `<line x1="${x + (w / n) * i}" y1="${y}" x2="${x + (w / n) * i}" y2="${-y}" ${st}/>`;
        return s;
      }
      case 'tv':
        return R(x, y, w, h, c, 3) + R(x + w * 0.15, y + h * 0.2, w * 0.7, Math.max(4, h * 0.18), '#2a2d36', 1);
      case 'table':
        return R(x, y, w, h, c, 10);
      case 'desk':
        return R(x, y, w, h, c, 3) + R(x + w * 0.62, y + 6, w * 0.32, h * 0.32, shade(c, 0.9), 2);
      case 'chair':
        return R(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.8, c, 8) + R(x + w * 0.1, y, w * 0.8, h * 0.22, d, 5);
      case 'dining': {
        const cw = Math.min(42, w * 0.35), ch = 16;
        return R(x + w * 0.1, y - ch, cw, ch + 4, '#d7dbe3', 5) + R(x + w * 0.9 - cw, y - ch, cw, ch + 4, '#d7dbe3', 5) +
          R(x + w * 0.1, -y - 4, cw, ch + 4, '#d7dbe3', 5) + R(x + w * 0.9 - cw, -y - 4, cw, ch + 4, '#d7dbe3', 5) + R(x, y, w, h, c, 4);
      }
      case 'washer':
        return R(x, y, w, h, c, 6) + `<circle cx="0" cy="${h * 0.06}" r="${Math.min(w, h) * 0.32}" fill="#9fb3c8" ${st}/>`;
      case 'plant':
        return `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${h / 2}" fill="${c}" ${st}/>` +
          `<ellipse cx="0" cy="0" rx="${w / 4}" ry="${h / 4}" fill="${shade(c, 0.8)}" ${st}/>`;
      case 'rug':
        return R(x, y, w, h, c, 6, 'stroke-dasharray="6 4" fill-opacity="0.85"') + R(x + 10, y + 10, w - 20, h - 20, 'none', 4, 'stroke-dasharray="2 4"');
      case 'door':
        return `<path d="M${x} ${-y} L${x} ${y} A${w} ${h} 0 0 1 ${-x} ${-y}" fill="rgba(141,110,79,0.08)" stroke="${d}" stroke-width="${sw}" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>` +
          `<rect x="${x - 2}" y="${y}" width="5" height="${h}" fill="${c}" ${st}/>`;
      case 'window':
        return R(x, y, w, h, c, 1) + `<line x1="${x}" y1="0" x2="${-x}" y2="0" ${st}/>`;
      case 'column':
        return R(x, y, w, h, c, 1) + `<path d="M${x} ${y}L${-x} ${-y}M${-x} ${y}L${x} ${-y}" ${st}/>`;
      default:
        return R(x, y, w, h, c, 3);
    }
  }

  // ---------- 렌더링 ----------
  const svg = $('#canvas'), world = $('#world');
  const roomLayer = $('#roomLayer'), itemsLayer = $('#itemsLayer'), overlay = $('#overlayLayer');

  function applyView() { world.setAttribute('transform', `translate(${view.ox} ${view.oy}) scale(${view.s})`); renderStatus(); }

  function renderRoom() {
    const { w, h, wall } = state.room, g = state.settings.grid;
    $('#gridMinor').setAttribute('width', g); $('#gridMinor').setAttribute('height', g);
    $('#gridMinor path').setAttribute('d', `M${g} 0H0V${g}`);
    const fs = 13 / view.s, off = wall + 22 / view.s;
    roomLayer.innerHTML =
      `<rect x="${-wall}" y="${-wall}" width="${w + wall * 2}" height="${h + wall * 2}" fill="#4a5163" rx="2"/>` +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="#fbfcfe"/>` +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#gridMajor)"/>` +
      dimLine(0, -off, w, -off, `${w} cm`, fs) +
      dimLine(-off, 0, -off, h, `${h} cm`, fs, true);
  }
  function dimLine(x1, y1, x2, y2, label, fs, vert) {
    const t = 5 / view.s, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const ticks = vert ? `M${x1 - t} ${y1}h${2 * t}M${x2 - t} ${y2}h${2 * t}` : `M${x1} ${y1 - t}v${2 * t}M${x2} ${y2 - t}v${2 * t}`;
    return `<path d="M${x1} ${y1}L${x2} ${y2}${ticks}" stroke="#7a8397" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/>` +
      `<g transform="translate(${mx} ${my})${vert ? ' rotate(-90)' : ''}"><rect x="${-fs * 2.6}" y="${-fs * 0.8}" width="${fs * 5.2}" height="${fs * 1.6}" fill="#eef1f6"/>` +
      `<text text-anchor="middle" dominant-baseline="central" font-size="${fs}" fill="#4d5568" font-weight="600">${label}</text></g>`;
  }

  function renderItems() {
    const bad = problems();
    const hs = 1 / view.s;
    let out = '';
    for (const it of state.items) {
      const sel = it.id === selectedId, isBad = bad.has(it.id);
      const fs = Math.max(8, Math.min(16, Math.min(it.w, it.h) * 0.2, (it.w / Math.max(it.name.length, 2)) * 0.9));
      let label = '';
      if (it.type !== 'window' && Math.min(it.w, it.h) * view.s > 18) {
        label = `<g transform="rotate(${-it.rot})"><text text-anchor="middle" dominant-baseline="central" font-size="${fs}" fill="#1d2433" font-weight="600" y="${state.settings.dims ? -fs * 0.55 : 0}">${esc(it.name)}</text>` +
          (state.settings.dims ? `<text text-anchor="middle" dominant-baseline="central" font-size="${fs * 0.8}" fill="#4d5568" y="${fs * 0.65}">${it.w}×${it.h}</text>` : '') + '</g>';
      }
      out += `<g class="item" data-id="${it.id}" transform="translate(${it.x} ${it.y}) rotate(${it.rot})">` +
        shapeSVG(it) + label +
        (isBad ? `<rect x="${-it.w / 2}" y="${-it.h / 2}" width="${it.w}" height="${it.h}" fill="rgba(229,72,77,0.18)" stroke="#e5484d" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>` : '') +
        (sel ? selectionSVG(it, hs) : '') + '</g>';
    }
    itemsLayer.innerHTML = out;
    // 선택 경고
    const warn = $('#propsWarn');
    if (selectedId && bad.has(selectedId)) { warn.hidden = false; warn.textContent = '⚠ ' + bad.get(selectedId); } else warn.hidden = true;
    renderStatus(bad);
  }
  function selectionSVG(it, hs) {
    const x = -it.w / 2, y = -it.h / 2, r = 9 * hs, rotY = y - 28 * hs;
    return `<rect x="${x}" y="${y}" width="${it.w}" height="${it.h}" fill="none" stroke="#2f6fed" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>` +
      `<line x1="0" y1="${y}" x2="0" y2="${rotY}" stroke="#2f6fed" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
      `<circle class="handle" data-handle="rotate" cx="0" cy="${rotY}" r="${r}" fill="#2f6fed" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
      `<circle data-handle="rotate" cx="0" cy="${rotY}" r="${r * 2.2}" fill="transparent"/>` +
      `<rect class="handle" data-handle="resize" x="${-x - r}" y="${-y - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.3}" fill="#fff" stroke="#2f6fed" stroke-width="2" vector-effect="non-scaling-stroke" style="cursor:nwse-resize"/>` +
      `<rect data-handle="resize" x="${-x - r * 2.2}" y="${-y - r * 2.2}" width="${r * 4.4}" height="${r * 4.4}" fill="transparent" style="cursor:nwse-resize"/>`;
  }

  function renderStatus(bad = problems()) {
    const { w, h } = state.room, area = (w * h) / 10000;
    const used = state.items.filter(i => !NO_COLLIDE.has(i.type) && i.type !== 'column').reduce((a, i) => a + i.w * i.h, 0) / 10000;
    const pct = area ? Math.round((used / area) * 100) : 0;
    const issues = bad.size;
    $('#status').textContent = `${(w / 100).toFixed(2)} × ${(h / 100).toFixed(2)} m · ${area.toFixed(1)}㎡ (${(area / 3.3058).toFixed(1)}평) · 점유 ${pct}% · ${Math.round(view.s * 100)}%` + (issues ? ` · ⚠ ${issues}` : '');
    $('#stats').innerHTML =
      `방 면적 <b>${area.toFixed(2)} ㎡ (${(area / 3.3058).toFixed(1)}평)</b><br>` +
      `가구 수 <b>${state.items.length}개</b><br>` +
      `가구 점유 면적 <b>${used.toFixed(2)} ㎡ (${pct}%)</b><br>` +
      `남은 바닥 <b>${Math.max(0, area - used).toFixed(2)} ㎡</b><br>` +
      `경고 <b style="color:${issues ? '#e5484d' : 'inherit'}">${issues ? issues + '개' : '없음'}</b>`;
  }

  function render() { renderRoom(); renderItems(); applyView(); syncProps(); renderSelBar(); }
  function renderSelBar() { $('#selBar').hidden = !selectedId; }

  // ---------- 뷰 (확대/이동) ----------
  function stageSize() { const r = svg.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; }
  function fit() {
    const { w, h } = stageSize(), pad = 60, rw = state.room.w + state.room.wall * 2 + 40, rh = state.room.h + state.room.wall * 2 + 40;
    view.s = Math.max(0.1, Math.min((w - pad) / rw, (h - pad) / rh, 4));
    view.ox = (w - state.room.w * view.s) / 2 + 10 * view.s;
    view.oy = (h - state.room.h * view.s) / 2 + 10 * view.s;
    renderRoom(); renderItems(); applyView();
  }
  function zoomAt(factor, sx, sy) {
    const ns = Math.max(0.1, Math.min(8, view.s * factor));
    const wx = (sx - view.ox) / view.s, wy = (sy - view.oy) / view.s;
    view.s = ns; view.ox = sx - wx * ns; view.oy = sy - wy * ns;
    scheduleRerender();
  }
  let rerenderPending = false;
  function scheduleRerender() {
    applyView();
    if (rerenderPending) return;
    rerenderPending = true;
    requestAnimationFrame(() => { rerenderPending = false; renderRoom(); renderItems(); });
  }
  const toWorld = (cx, cy) => { const r = stageSize(); return { x: (cx - r.left - view.ox) / view.s, y: (cy - r.top - view.oy) / view.s }; };

  // ---------- 포인터 (마우스·터치·펜 공통) ----------
  const pointers = new Map();
  let gesture = null; // {kind:'drag'|'pan'|'rotate'|'resize'|'pinch', ...}

  svg.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return;
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { startPinch(); return; }
    if (pointers.size > 2) return;
    const handle = e.target.closest('[data-handle]');
    const itemEl = e.target.closest('.item');
    const p = toWorld(e.clientX, e.clientY);
    if (handle && selectedId) {
      const it = getItem(selectedId);
      gesture = handle.dataset.handle === 'rotate'
        ? { kind: 'rotate', id: it.id }
        : { kind: 'resize', id: it.id, start: { ...it } };
    } else if (itemEl) {
      const it = getItem(itemEl.dataset.id);
      if (selectedId !== it.id) { selectedId = it.id; renderItems(); syncProps(); renderSelBar(); }
      gesture = { kind: 'drag', id: it.id, dx: p.x - it.x, dy: p.y - it.y, sx: e.clientX, sy: e.clientY, moved: false };
    } else {
      gesture = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy, moved: false };
      svg.classList.add('panning');
    }
  });

  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.kind === 'pinch') return movePinch();
    const p = toWorld(e.clientX, e.clientY);
    if (gesture.kind === 'pan') {
      const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
      if (Math.hypot(dx, dy) > 4) gesture.moved = true;
      view.ox = gesture.ox + dx; view.oy = gesture.oy + dy; applyView();
      return;
    }
    const it = getItem(gesture.id); if (!it) return;
    if (gesture.kind === 'drag') {
      if (!gesture.moved && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) < 3) return;
      gesture.moved = true;
      let nx = p.x - gesture.dx, ny = p.y - gesture.dy;
      if (state.settings.snap) {
        // 가장자리를 격자에 맞춤 (회전 0/90/180/270일 때) — 아니면 중심 기준
        const r = norm(it.rot), axis = r % 180 === 0, ew = axis ? it.w : it.h, eh = axis ? it.h : it.w;
        if (r % 90 === 0) { nx = snapV(nx - ew / 2) + ew / 2; ny = snapV(ny - eh / 2) + eh / 2; }
        else { nx = snapV(nx); ny = snapV(ny); }
        // 벽에 붙이기 (8px 이내)
        const mag = 8 / view.s;
        if (r % 90 === 0) {
          if (Math.abs(nx - ew / 2) < mag) nx = ew / 2;
          if (Math.abs(ny - eh / 2) < mag) ny = eh / 2;
          if (Math.abs(nx + ew / 2 - state.room.w) < mag) nx = state.room.w - ew / 2;
          if (Math.abs(ny + eh / 2 - state.room.h) < mag) ny = state.room.h - eh / 2;
        }
      }
      it.x = Math.round(nx * 10) / 10; it.y = Math.round(ny * 10) / 10;
    } else if (gesture.kind === 'rotate') {
      let a = Math.atan2(p.y - it.y, p.x - it.x) * 180 / Math.PI + 90;
      a = e.shiftKey || !state.settings.snap ? Math.round(a) : Math.round(a / 15) * 15;
      it.rot = norm(a);
    } else if (gesture.kind === 'resize') {
      const r = it.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), st = gesture.start;
      // 반대쪽 모서리(좌상단) 고정
      const ax = st.x + (-st.w / 2) * c - (-st.h / 2) * s, ay = st.y + (-st.w / 2) * s + (-st.h / 2) * c;
      const lx = (p.x - ax) * c + (p.y - ay) * s, ly = -(p.x - ax) * s + (p.y - ay) * c;
      const nw = Math.max(10, snapV(lx)), nh = Math.max(10, snapV(ly));
      it.w = nw; it.h = nh;
      it.x = ax + (nw / 2) * c - (nh / 2) * s; it.y = ay + (nw / 2) * s + (nh / 2) * c;
      it.x = Math.round(it.x * 10) / 10; it.y = Math.round(it.y * 10) / 10;
    }
    renderItems(); syncProps();
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture && gesture.kind === 'pinch') {
      if (pointers.size < 2) { gesture = null; renderRoom(); renderItems(); }
      return;
    }
    if (gesture) {
      if (gesture.kind === 'pan' && !gesture.moved && selectedId) { selectedId = null; renderItems(); syncProps(); renderSelBar(); }
      svg.classList.remove('panning');
      commit();
    }
    gesture = null;
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  function pinchInfo() {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
  function startPinch() {
    if (gesture && (gesture.kind === 'drag' || gesture.kind === 'rotate' || gesture.kind === 'resize')) commit();
    svg.classList.remove('panning');
    const { d, mx, my } = pinchInfo(), r = stageSize();
    gesture = { kind: 'pinch', d, s: view.s, wx: (mx - r.left - view.ox) / view.s, wy: (my - r.top - view.oy) / view.s };
  }
  function movePinch() {
    const { d, mx, my } = pinchInfo(), r = stageSize();
    view.s = Math.max(0.1, Math.min(8, gesture.s * d / gesture.d));
    view.ox = mx - r.left - gesture.wx * view.s; view.oy = my - r.top - gesture.wy * view.s;
    scheduleRerender();
  }

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stageSize();
    if (e.ctrlKey || !e.shiftKey) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    else { view.ox -= e.deltaY; applyView(); }
  }, { passive: false });
  // iOS Safari 제스처 기본 동작(페이지 확대) 막기
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault()));

  // ---------- 가구 추가 ----------
  function addItem(cat, wx, wy) {
    const it = { id: uid(), type: cat.type, name: cat.name, w: cat.w, h: cat.h, color: cat.color, rot: 0, x: 0, y: 0 };
    if (wx === undefined) {
      const r = stageSize();
      wx = (r.w / 2 - view.ox) / view.s; wy = (r.h / 2 - view.oy) / view.s;
      wx = Math.max(it.w / 2, Math.min(state.room.w - it.w / 2, wx));
      wy = Math.max(it.h / 2, Math.min(state.room.h - it.h / 2, wy));
      // 빈 자리 찾기: 화면 중심에서 가까운 순으로 겹치지 않는 위치 탐색
      if (!NO_COLLIDE.has(it.type)) {
        const solid = state.items.filter(o => !NO_COLLIDE.has(o.type)), cands = [];
        for (let y = it.h / 2; y <= state.room.h - it.h / 2 + 0.1; y += 10)
          for (let x = it.w / 2; x <= state.room.w - it.w / 2 + 0.1; x += 10) cands.push([x, y, Math.hypot(x - wx, y - wy)]);
        cands.sort((a, b) => a[2] - b[2]);
        const free = cands.find(([x, y]) => !solid.some(o => overlap({ ...it, x, y }, o)));
        if (free) { wx = free[0]; wy = free[1]; }
      }
    }
    it.x = snapV(wx - it.w / 2) + it.w / 2; it.y = snapV(wy - it.h / 2) + it.h / 2;
    if (it.type === 'rug') state.items.unshift(it); else state.items.push(it);
    selectedId = it.id;
    commit(); render();
    if (isMobile()) collapseSheet();
    toast(`'${it.name}' 추가됨`);
  }

  function renderLibrary(filter = '') {
    const q = filter.trim();
    const cats = [...new Set(CATALOG.map(c => c.cat))];
    let html = '';
    for (const cat of cats) {
      const list = CATALOG.map((c, i) => ({ ...c, i })).filter(c => c.cat === cat && (!q || c.name.includes(q) || c.cat.includes(q)));
      if (!list.length) continue;
      html += `<div class="cat-title">${cat}</div><div class="lib-grid">`;
      for (const c of list) {
        const m = Math.max(c.w, (c.h + (c.type === 'dining' ? 40 : 0)) * 4 / 3) * 1.12;
        html += `<button class="lib-item" data-cat="${c.i}" draggable="true" title="${c.name} ${c.w}×${c.h}cm">` +
          `<svg viewBox="${-m / 2} ${-m / 2 * 0.75} ${m} ${m * 0.75}">${shapeSVG({ ...c, x: 0, y: 0, rot: 0 }, 1)}</svg>` +
          `<b>${c.name}</b><small>${c.w}×${c.h}cm</small></button>`;
      }
      html += '</div>';
    }
    $('#library').innerHTML = html || '<div class="empty">검색 결과가 없어요.</div>';
  }
  $('#library').addEventListener('click', e => {
    const b = e.target.closest('.lib-item'); if (b) addItem(CATALOG[+b.dataset.cat]);
  });
  $('#library').addEventListener('dragstart', e => {
    const b = e.target.closest('.lib-item'); if (!b) return;
    e.dataTransfer.setData('text/plain', b.dataset.cat); e.dataTransfer.effectAllowed = 'copy';
  });
  $('#stage').addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  $('#stage').addEventListener('drop', e => {
    e.preventDefault();
    const i = e.dataTransfer.getData('text/plain'); if (i === '' || !CATALOG[+i]) return;
    const p = toWorld(e.clientX, e.clientY);
    addItem(CATALOG[+i], p.x, p.y);
  });
  $('#search').addEventListener('input', e => renderLibrary(e.target.value));

  // ---------- 속성 패널 ----------
  const pf = $('#propsForm');
  function syncProps() {
    const it = getItem(selectedId);
    $('#propsEmpty').hidden = !!it; pf.hidden = !it;
    if (!it) return;
    for (const k of ['name', 'w', 'h', 'x', 'y', 'rot', 'color']) {
      const el = pf.elements[k];
      if (document.activeElement === el) continue;
      el.value = k === 'x' || k === 'y' ? Math.round(it[k]) : it[k];
    }
  }
  pf.addEventListener('input', e => {
    const it = getItem(selectedId); if (!it || !e.target.name) return;
    const k = e.target.name, v = e.target.value;
    if (k === 'name' || k === 'color') it[k] = k === 'name' ? (v || '가구') : v;
    else { const n = parseFloat(v); if (!isFinite(n)) return; it[k] = k === 'rot' ? norm(n) : (k === 'w' || k === 'h') ? Math.max(5, Math.min(2000, n)) : n; }
    renderItems();
  });
  pf.addEventListener('change', () => { commit(); syncProps(); });

  // ---------- 방 설정 ----------
  const rf = $('#roomForm');
  function syncForms() {
    rf.elements.rw.value = state.room.w; rf.elements.rh.value = state.room.h; rf.elements.wall.value = state.room.wall;
    rf.elements.grid.value = state.settings.grid; rf.elements.snap.checked = state.settings.snap;
    rf.elements.dims.checked = state.settings.dims; rf.elements.collide.checked = state.settings.collide;
    $('#planName').value = state.name || '내 방';
    syncProps();
  }
  rf.addEventListener('change', () => {
    const n = (k, min, max, d) => { const v = parseFloat(rf.elements[k].value); return isFinite(v) ? Math.max(min, Math.min(max, v)) : d; };
    const sizeChanged = n('rw', 100, 3000, state.room.w) !== state.room.w || n('rh', 100, 3000, state.room.h) !== state.room.h;
    state.room.w = n('rw', 100, 3000, state.room.w); state.room.h = n('rh', 100, 3000, state.room.h); state.room.wall = n('wall', 0, 50, state.room.wall);
    state.settings.grid = +rf.elements.grid.value; state.settings.snap = rf.elements.snap.checked;
    state.settings.dims = rf.elements.dims.checked; state.settings.collide = rf.elements.collide.checked;
    commit(); syncForms();
    if (sizeChanged) fit(); else render();
  });
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const [w, h] = b.dataset.preset.split('x').map(Number);
    state.room.w = w; state.room.h = h; commit(); syncForms(); fit(); render();
    toast(`방 크기 ${w / 100}×${h / 100}m`);
  }));
  $('#planName').addEventListener('change', e => { state.name = e.target.value.trim() || '내 방'; commit(); });

  // ---------- 동작 ----------
  const actions = {
    undo, redo, fit,
    zoomIn() { const r = stageSize(); zoomAt(1.25, r.w / 2, r.h / 2); },
    zoomOut() { const r = stageSize(); zoomAt(0.8, r.w / 2, r.h / 2); },
    rotate() { const it = getItem(selectedId); if (!it) return; it.rot = norm(Math.round(it.rot / 90) * 90 + 90); commit(); render(); },
    duplicate() {
      const it = getItem(selectedId); if (!it) return;
      const c = { ...it, id: uid(), x: it.x + 20, y: it.y + 20 };
      state.items.splice(state.items.indexOf(it) + 1, 0, c); selectedId = c.id; commit(); render();
    },
    delete() {
      const i = state.items.findIndex(x => x.id === selectedId); if (i < 0) return;
      const name = state.items[i].name; state.items.splice(i, 1); selectedId = null; commit(); render(); toast(`'${name}' 삭제됨 (실행 취소 가능)`);
    },
    toFront() { const it = getItem(selectedId); if (!it) return; state.items = state.items.filter(x => x !== it).concat(it); commit(); render(); },
    toBack() { const it = getItem(selectedId); if (!it) return; state.items = [it].concat(state.items.filter(x => x !== it)); commit(); render(); },
    editProps() { switchTab('props'); expandSheet(); },
    clearAll() { if (!state.items.length || !confirm('모든 가구를 지울까요? (실행 취소 가능)')) return; state.items = []; selectedId = null; commit(); render(); },
    newPlan() {
      if (!confirm('새 도면을 시작할까요? 현재 도면은 실행 취소로 되돌릴 수 있어요. 필요하면 먼저 "저장"하세요.')) return;
      state = defaultState(); selectedId = null; commit(); syncForms(); fit(); render();
    },
    exportJson() {
      const blob = new Blob([JSON.stringify({ app: 'room-planner', version: 1, ...state }, null, 2)], { type: 'application/json' });
      deliver(blob, `${fileBase()}.json`);
    },
    importJson() { $('#fileInput').click(); },
    async exportPng() {
      try { deliver(await renderPng(), `${fileBase()}.png`); } catch (err) { toast('이미지 생성 실패: ' + err.message); }
    },
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const f = actions[b.dataset.act]; if (f) { e.preventDefault(); f(); }
  });
  $('#fileInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      if (!validate(s)) throw new Error('형식이 올바르지 않아요');
      const d = defaultState();
      state = { name: s.name || d.name, room: { ...d.room, ...s.room }, settings: { ...d.settings, ...s.settings },
        items: s.items.filter(i => i && isFinite(i.w) && isFinite(i.h)).map(i => ({ rot: 0, color: '#cccccc', name: '가구', type: 'box', ...i, id: i.id || uid() })) };
      selectedId = null; commit(); syncForms(); fit(); render(); toast('도면을 불러왔어요');
    } catch (err) { toast('불러오기 실패: ' + err.message); }
  });

  const fileBase = () => (state.name || '방').replace(/[\\/:*?"<>|]/g, '_') + '-배치도';
  async function deliver(blob, filename) {
    // 네이티브 앱(Capacitor): 캐시에 파일 저장 후 공유 시트 → 사진/드라이브/카톡 등으로 보내기
    const cap = window.Capacitor, P = cap && cap.Plugins;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share) {
      try {
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
        const { uri } = await P.Filesystem.writeFile({ path: filename, data, directory: 'CACHE' });
        await P.Share.share({ title: filename, files: [uri], dialogTitle: '배치도 공유/저장' });
      } catch (err) { if (!/cancel/i.test(String(err && err.message))) toast('공유 실패: ' + (err && err.message || err)); }
      return;
    }
    // 모바일 브라우저/PWA에서는 공유 시트, 아니면 다운로드
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (isMobile() && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
    } catch (err) { if (err && err.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`${filename} 저장됨`);
  }
  function renderPng() {
    const { w, h, wall } = state.room, pad = 70, k = 2; // 2px/cm
    const W = (w + 2 * wall) * k + pad * 2, H = (h + 2 * wall) * k + pad * 2 + 40;
    const saved = { ...view }, sel = selectedId;
    view.s = k; view.ox = pad + wall * k; view.oy = pad + wall * k + 40; selectedId = null;
    renderRoom(); renderItems();
    const inner = world.innerHTML;
    Object.assign(view, saved); selectedId = sel; render();
    const defs = svg.querySelector('defs').outerHTML;
    const title = `<text x="${pad}" y="42" font-size="26" font-weight="700" fill="#1d2433">${esc(state.name)}</text>` +
      `<text x="${W - pad}" y="42" font-size="15" text-anchor="end" fill="#6b7486">${(w / 100).toFixed(2)}×${(h / 100).toFixed(2)}m · ${((w * h) / 10000).toFixed(1)}㎡</text>`;
    const str = `<svg xmlns="${SVGNS}" width="${W}" height="${H}" font-family="Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif">${defs}<rect width="100%" height="100%" fill="#ffffff"/>${title}` +
      `<g transform="translate(${pad + wall * k} ${pad + wall * k + 40}) scale(${k})">${inner}</g></svg>`;
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        c.getContext('2d').drawImage(img, 0, 0); c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png');
      };
      img.onerror = () => rej(new Error('SVG 렌더링 오류'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
    });
  }

  // ---------- 키보드 ----------
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && k === 'd') { e.preventDefault(); actions.duplicate(); return; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); actions.delete(); return; }
    if (k === 'r' && !mod) { actions.rotate(); return; }
    if (k === 'escape') { selectedId = null; render(); return; }
    const it = getItem(selectedId);
    const step = e.shiftKey ? 10 : 1, mv = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
    if (it && mv) { e.preventDefault(); it.x += mv[0]; it.y += mv[1]; renderItems(); syncProps(); clearTimeout(keyCommitT); keyCommitT = setTimeout(commit, 400); }
  });
  let keyCommitT;

  // ---------- 탭 / 바텀시트 ----------
  const sheet = $('#sheet');
  const isMobile = () => matchMedia('(max-width: 768px)').matches;
  function switchTab(name) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  }
  const expandSheet = () => { sheet.dataset.state = 'expanded'; };
  const collapseSheet = () => { sheet.dataset.state = 'collapsed'; };
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    const same = t.classList.contains('active');
    switchTab(t.dataset.tab);
    if (isMobile()) { if (same && sheet.dataset.state === 'expanded') collapseSheet(); else expandSheet(); }
  }));
  // 핸들: 탭 → 토글, 위/아래로 스와이프 → 펼치기/접기
  (() => {
    const h = $('#sheetHandle'); let sy = null;
    h.addEventListener('pointerdown', e => { sy = e.clientY; h.setPointerCapture(e.pointerId); });
    h.addEventListener('pointerup', e => {
      if (sy === null) return; const dy = e.clientY - sy; sy = null;
      if (dy < -20) expandSheet(); else if (dy > 20) collapseSheet();
      else sheet.dataset.state = sheet.dataset.state === 'expanded' ? 'collapsed' : 'expanded';
    });
  })();
  // 캔버스를 만지면 시트 접기 (모바일)
  svg.addEventListener('pointerdown', () => { if (isMobile() && sheet.dataset.state === 'expanded') collapseSheet(); }, true);

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 1800); }

  // ---------- 시작 ----------
  let lastW = 0;
  new ResizeObserver(() => { const { w } = stageSize(); if (!lastW || Math.abs(w - lastW) > 40) fit(); lastW = w; }).observe($('#stage'));
  renderLibrary(); syncForms(); updateButtons(); fit(); render();
  window.__planner = { get state() { return state; }, select(id) { selectedId = id; render(); }, actions };

  // PWA: 서비스 워커 (Capacitor 앱 안에서는 사용 안 함)
  if ('serviceWorker' in navigator && !window.Capacitor && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
