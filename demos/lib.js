/* Tiny shared 3D helpers for the demos: camera, painter's-algorithm primitives, theme, drag. */
window.L = (function () {
  var PI = Math.PI, TAU = PI * 2, C = {}, PR = [], LB = [];
  var q = new URLSearchParams(location.search);
  if (q.get("bare")) document.documentElement.classList.add("bare");
  if (q.get("theme") === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.setAttribute("data-theme", "light");

  function colors() {
    var s = getComputedStyle(document.documentElement);
    ["bg", "panel", "ink", "muted", "rule", "triv", "sign", "rot", "mix", "sphere"].forEach(function (n) { C[n] = s.getPropertyValue("--" + n).trim(); });
    return C;
  }
  function size(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }
  function proj(w, cam) {
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var x1 = w[0] * cy + w[2] * sy, z1 = -w[0] * sy + w[2] * cy, y2 = w[1] * cp - z1 * sp, z2 = w[1] * sp + z1 * cp;
    return [cam.cx + cam.S * x1, cam.cy - cam.S * y2, z2];
  }
  function seg(a, b, col, w, al) { if (a && b) PR.push({ k: 0, a: a, b: b, col: col, w: w, al: al, z: (a[2] + b[2]) / 2 }); }
  function dot(a, col, r, al, ring) { if (a) PR.push({ k: 1, a: a, col: col, r: r, al: al, ring: ring, z: a[2] }); }
  function poly(pts, col, w, al) { for (var i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], col, w, al); }
  function fill(pts, col, al, z, stroke, lw, sal) { PR.push({ k: 2, pts: pts, col: col, al: al, z: z === undefined ? -99 : z, stroke: stroke, lw: lw, sal: sal }); }
  function label(a, text, col, px) { if (a) LB.push({ a: a, text: text, col: col, px: px || 13 }); }
  function fade(z) { return 0.4 + 0.6 * Math.min(1, Math.max(0, (z + 1.3) / 2.6)); }
  function flush(ctx, dpr) {
    PR.sort(function (p, r) { return p.z - r.z; });
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (var i = 0; i < PR.length; i++) {
      var p = PR[i];
      if (p.k === 2) { ctx.globalAlpha = p.al; ctx.fillStyle = p.col; ctx.beginPath(); p.pts.forEach(function (v, j) { if (j) ctx.lineTo(v[0], v[1]); else ctx.moveTo(v[0], v[1]); }); ctx.closePath(); ctx.fill(); if (p.stroke) { ctx.globalAlpha = (p.sal === undefined ? 0.3 : p.sal) * (0.4 + 0.6 * Math.min(1, Math.max(0, (p.z + 1.3) / 2.6))); ctx.strokeStyle = p.stroke; ctx.lineWidth = (p.lw || 1) * dpr; ctx.stroke(); } continue; }
      ctx.globalAlpha = Math.min(1, p.al * fade(p.z));
      if (p.k === 0) { ctx.strokeStyle = p.col; ctx.lineWidth = p.w * dpr; ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.a[0], p.a[1], p.r * dpr, 0, TAU); ctx.fillStyle = p.col; ctx.fill(); if (p.ring) { ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = p.ring; ctx.stroke(); } }
    }
    ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    LB.forEach(function (l) { ctx.font = (l.px * dpr) + "px 'JetBrains Mono', monospace"; ctx.fillStyle = l.col; ctx.fillText(l.text, l.a[0], l.a[1]); });
    PR = []; LB = [];
  }
  function drag(cv, cam, redraw) {
    var d = null;
    cv.addEventListener("pointerdown", function (e) { d = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cam.auto = false; });
    cv.addEventListener("pointermove", function (e) { if (!d) return; cam.yaw += (e.clientX - d.x) * 0.008; cam.pitch = Math.max(-1.4, Math.min(1.4, cam.pitch + (e.clientY - d.y) * 0.008)); d = { x: e.clientX, y: e.clientY }; redraw(); });
    cv.addEventListener("pointerup", function () { d = null; }); cv.addEventListener("pointercancel", function () { d = null; });
  }
  // continuous action path: trivial coords fixed, sign coords scale by cos(pi t), rotation pairs turn by (pi/2) t
  function path(v, t, groups) {
    var o = v.slice();
    groups.forEach(function (g) {
      if (g.t === "s") o[g.c[0]] = v[g.c[0]] * Math.cos(PI * t);
      else if (g.t === "r") { var i = g.c[0], j = g.c[1], th = PI / 2 * t, c = Math.cos(th), s = Math.sin(th); o[i] = v[i] * c - v[j] * s; o[j] = v[i] * s + v[j] * c; }
    });
    return o;
  }
  var ease = function (u) { return u * u * (3 - 2 * u); };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { PI: PI, TAU: TAU, C: C, colors: colors, size: size, proj: proj, seg: seg, dot: dot, poly: poly, fill: fill, label: label, flush: flush, drag: drag, path: path, ease: ease, reduced: reduced, q: q };
})();
