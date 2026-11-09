/* Native scenes for the talk. Each [data-scene] slide gets a full-slide canvas.
   Fragments (arrow keys) set the scene's step; clicks and drags are free play. */
(function () {
  var PI = Math.PI, TAU = PI * 2, W = 1920, H = 1080, DPR = 1.5, SC = {}, scenes = [], active = null;
  var SUPD = ["", "¹", "²", "³"], FS = function (n) { return n === 0 ? "0" : n === 1 ? "𝔽₂" : "𝔽₂<sup>" + n + "</sup>"; };
  var sub = ["₀", "₁", "₂"];
  var rotY = function (v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
  var ease = function (u) { return u * u * (3 - 2 * u); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  var curve = function (f, n) { var p = []; for (var i = 0; i <= n; i++) p.push(f(i / n)); return p; };
  var sph = function (a, b) { return [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)]; };
  var torus = function (u, v, R, r) { return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]; };
  var ring = function (cx, cy, cz, r, n) { return curve(function (t) { var a = t * TAU; return [cx + r * Math.cos(a), cy, cz + r * Math.sin(a)]; }, n); };
  function hex(c) { c = c.trim(); if (c[0] === "#") { if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; } var m = c.match(/\d+/g); return [m[0] | 0, m[1] | 0, m[2] | 0]; }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return "rgb(" + A.map(function (x, i) { return Math.round(x + (B[i] - x) * t); }).join(",") + ")"; }
  function refreshShow(sec, n) { sec.querySelectorAll("[data-show-from]").forEach(function (el) { el.classList.toggle("on", n >= +el.dataset.showFrom && (el.dataset.showUntil === undefined || n < +el.dataset.showUntil)); }); }
  function newCam(o) { return Object.assign({ yaw: 0.6, pitch: 0.3, cx: W / 2, cy: H / 2, S: 300 }, o || {}); }

  /* ---------- 1. a donut is pushed down into a cup, then bent around into a handle ----------
     Four signed-distance keyframes on a coarse grid. A set of low-poly frames is baked once (marching tetrahedra) and played back. */
  SC.morph = function (sec, cv) {
    var cam = newCam({ yaw: 0.42, pitch: 0.46, cx: W * 0.64, cy: H * 0.6, S: 330 }), s = 0, target = 0, hl = false, auto = true, me = {};
    var slider = sec.querySelector(".js-morph"), play = sec.querySelector(".js-play");
    var NX = 52, NY = 38, NZ = 30, X0 = -0.8, X1 = 1.75, Y0 = -0.85, Y1 = 0.95, Z0 = -0.65, Z1 = 0.65, NF = 40;
    var DX = (X1 - X0) / (NX - 1), DY = (Y1 - Y0) / (NY - 1), DZ = (Z1 - Z0) / (NZ - 1), NN = NX * NY * NZ;
    var F0 = new Float32Array(NN), FA = new Float32Array(NN), F1 = new Float32Array(NN), F2 = new Float32Array(NN), F = new Float32Array(NN), KN = [0, 0.25, 0.55, 1], FS = [F0, FA, F1, F2];
    var idx = function (i, j, k) { return (k * NY + j) * NX + i; };
    var smin = function (a, b, k) { var h = Math.max(k - Math.abs(a - b), 0); return Math.min(a, b) - h * h / (4 * k); };
    var torusXY = function (x, y, z, cx, cy, R, r) { return Math.hypot(Math.hypot(x - cx, y - cy) - R, z) - r; };
    function puck(x, y, z) { var rad = Math.hypot(x, z), rr = 0.09, qx = rad - (0.62 - rr), qy = Math.abs(y) - (0.62 - rr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; }
    function body(x, y, z) { return Math.max(puck(x, y, z), Math.min(0.5 - Math.hypot(x, z), y + 0.46)); }
    var handle = function (x, y, z, R, r) { return Math.max(torusXY(x, y, z, 0.82, 0.05, R, r), 0.54 - Math.hypot(x, z)); };
    (function () {
      for (var k = 0; k < NZ; k++) for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
        var x = X0 + i * DX, y = Y0 + j * DY, z = Z0 + k * DZ, n = idx(i, j, k), b = body(x, y, z);
        F0[n] = torusXY(x, y, z, 0.82, 0.05, 0.55, 0.22);
        FA[n] = smin(puck(x, y, z), F0[n], 0.08);
        F1[n] = smin(b, handle(x, y, z, 0.55, 0.22), 0.08);
        F2[n] = smin(b, handle(x, y, z, 0.42, 0.12), 0.08);
      }
    })();
    var KR = [[0.55, 0.22], [0.55, 0.22], [0.55, 0.22], [0.42, 0.12]];
    function seg(t) { var q = 0; while (q < 2 && t > KN[q + 1]) q++; return [q, Math.min(1, Math.max(0, (t - KN[q]) / (KN[q + 1] - KN[q])))]; }
    function params(t) { var g = seg(t), A = KR[g[0]], B = KR[g[0] + 1]; return [A[0] + (B[0] - A[0]) * g[1], A[1] + (B[1] - A[1]) * g[1]]; }
    // surface nets: one smooth vertex per surface cell, one quad per grid edge that crosses the surface (about 5k quads)
    var CX = NX - 1, CY = NY - 1, CZ = NZ - 1, NC = CX * CY * CZ, VP = new Float32Array(NC * 3), VNm = new Float32Array(NC * 3), VF = new Uint8Array(NC);
    var cid = function (i, j, k) { return (k * CY + j) * CX + i; };
    var CORN = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    var EDG = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    function mesh(t) {
      var g = seg(t), FP = FS[g[0]], FQ = FS[g[0] + 1], u = g[1], n, c, e;
      for (n = 0; n < NN; n++) F[n] = FP[n] + (FQ[n] - FP[n]) * u;
      VF.fill(0);
      var v = new Float32Array(8);
      for (var k = 0; k < CZ; k++) for (var j = 0; j < CY; j++) for (var i = 0; i < CX; i++) {
        var neg = 0;
        for (c = 0; c < 8; c++) { v[c] = F[idx(i + CORN[c][0], j + CORN[c][1], k + CORN[c][2])]; if (v[c] < 0) neg++; }
        if (neg === 0 || neg === 8) continue;
        var sx = 0, sy = 0, sz = 0, cnt = 0;
        for (e = 0; e < 12; e++) {
          var a = EDG[e][0], b = EDG[e][1];
          if ((v[a] < 0) === (v[b] < 0)) continue;
          var tt = v[a] / (v[a] - v[b]);
          sx += CORN[a][0] + (CORN[b][0] - CORN[a][0]) * tt; sy += CORN[a][1] + (CORN[b][1] - CORN[a][1]) * tt; sz += CORN[a][2] + (CORN[b][2] - CORN[a][2]) * tt; cnt++;
        }
        var id = cid(i, j, k) * 3;
        VP[id] = X0 + (i + sx / cnt) * DX; VP[id + 1] = Y0 + (j + sy / cnt) * DY; VP[id + 2] = Z0 + (k + sz / cnt) * DZ;
        var gx = ((v[1] + v[2] + v[5] + v[6]) - (v[0] + v[3] + v[4] + v[7])) / DX, gy = ((v[2] + v[3] + v[6] + v[7]) - (v[0] + v[1] + v[4] + v[5])) / DY, gz = ((v[4] + v[5] + v[6] + v[7]) - (v[0] + v[1] + v[2] + v[3])) / DZ, gl = Math.hypot(gx, gy, gz) || 1;
        VNm[id] = gx / gl; VNm[id + 1] = gy / gl; VNm[id + 2] = gz / gl; VF[cid(i, j, k)] = 1;
      }
      var P = [], Nn = [];
      var quad = function (a, b, c2, d) {
        if (!(VF[a] && VF[b] && VF[c2] && VF[d])) return;
        var q = [a, b, c2, d], nx = 0, ny = 0, nz = 0;
        q.forEach(function (m) { P.push(VP[3 * m], VP[3 * m + 1], VP[3 * m + 2]); nx += VNm[3 * m]; ny += VNm[3 * m + 1]; nz += VNm[3 * m + 2]; });
        var l = Math.hypot(nx, ny, nz) || 1; Nn.push(nx / l, ny / l, nz / l);
      };
      for (k = 0; k < NZ; k++) for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        var f0 = F[idx(i, j, k)] < 0;
        if (i < NX - 1 && j >= 1 && k >= 1 && j < NY - 1 && k < NZ - 1 && f0 !== (F[idx(i + 1, j, k)] < 0)) quad(cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k));
        if (j < NY - 1 && i >= 1 && k >= 1 && i < NX - 1 && k < NZ - 1 && f0 !== (F[idx(i, j + 1, k)] < 0)) quad(cid(i - 1, j, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i - 1, j, k));
        if (k < NZ - 1 && i >= 1 && j >= 1 && i < NX - 1 && j < NY - 1 && f0 !== (F[idx(i, j, k + 1)] < 0)) quad(cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k));
      }
      return { P: new Float32Array(P), N: new Float32Array(Nn), n: Nn.length / 3 };
    }
    // bake the frames in the background so playback never has to build a mesh
    var FR = new Array(NF + 1), nextF = 0;
    function frame(i) { if (!FR[i]) FR[i] = mesh(i / NF); return FR[i]; }
    (function warm() { var t0 = performance.now(); while (nextF <= NF && performance.now() - t0 < 10) { frame(nextF); nextF++; } if (nextF <= NF) setTimeout(warm, 0); })();
    var LD = (function () { var v = [0.35, 0.65, 0.7], l = Math.hypot(v[0], v[1], v[2]); return v.map(function (x) { return x / l; }); })();
    var rgb = function (a, b, t) { return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }).join(",") + ")"; };
    function render(ctx, C) {
      var T0 = performance.now(), fr = frame(Math.round(s * NF)), cxs = 0.82 - 0.42 * s, cyc = Math.cos(cam.yaw), syc = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var P = function (x, y, z) { return L.proj([x - cxs, y, z], cam); };
      var e = Math.min(1, Math.max(0, (s - 0.35) / 0.6)), lightC = [236 + (250 - 236) * e, 190 + (251 - 190) * e, 120 + (254 - 120) * e], darkC = [150 + (140 - 150) * e, 95 + (152 - 95) * e, 45 + (178 - 45) * e];
      for (var t = 0; t < fr.n; t++) {
        var nx = fr.N[3 * t], ny = fr.N[3 * t + 1], nz = fr.N[3 * t + 2], x1 = nx * cyc + nz * syc, z1 = -nx * syc + nz * cyc, y2 = ny * cp - z1 * sp, z2 = ny * sp + z1 * cp;
        var lam = Math.max(0, x1 * LD[0] + y2 * LD[1] + z2 * LD[2]), col = rgb(darkC, lightC, 0.25 + 0.75 * lam), o = 12 * t;
        var pa = P(fr.P[o], fr.P[o + 1], fr.P[o + 2]), pb = P(fr.P[o + 3], fr.P[o + 4], fr.P[o + 5]), pc = P(fr.P[o + 6], fr.P[o + 7], fr.P[o + 8]), pd = P(fr.P[o + 9], fr.P[o + 10], fr.P[o + 11]);
        L.fill([pa, pb, pc, pd], col, 1, (pa[2] + pb[2] + pc[2] + pd[2]) / 4, col, 0.8, 1);
      }
      if (s > 0.55) {
        var cf = []; for (var i = 0; i < 32; i++) { var a = i / 32 * TAU; cf.push(P(0.47 * Math.cos(a), 0.3, 0.47 * Math.sin(a))); }
        L.fill(cf, "rgb(92,58,36)", Math.min(1, (s - 0.55) / 0.2), P(0, 0.3, 0)[2] + 0.02, "rgb(60,36,22)", 1, 1);
      }
      if (hl) { var pr = params(s), loop = curve(function (u) { var a = u * TAU, rho = pr[1] + 0.08; return [0.82 + pr[0] + rho * Math.cos(a), 0.05, rho * Math.sin(a)]; }, 36).map(function (p) { return P(p[0], p[1], p[2]); }); L.poly(loop, C.sign, 12, 1); }
      var T1 = performance.now(); L.flush(ctx, DPR); me.stats = { quads: fr.n, build: Math.round(T1 - T0), draw: Math.round(performance.now() - T1) };
    }
    me.cv = cv; me.render = render;
    me.step = function (n) { target = n >= 2 ? 1 : n >= 1 ? 0.55 : 0; hl = n >= 3; me.dirty = true; };
    me.tick = function () {
      var moved = false;
      if (Math.abs(target - s) > 0.003) { s += (target - s) * 0.04 + Math.sign(target - s) * 0.0016; moved = true; } else if (s !== target) { s = target; moved = true; }
      if (auto) { var nw = performance.now(); if (nw - (me.lastRot || 0) > 50) { cam.yaw += 0.0018 * 3; me.lastRot = nw; moved = true; } }
      if (moved && slider) slider.value = Math.round(s * 100);
      return moved;
    };
    if (slider) slider.addEventListener("input", function () { s = target = +slider.value / 100; me.dirty = true; });
    if (play) play.addEventListener("click", function () { target = target > 0.5 ? 0 : 1; });
    L.drag(cv, cam, function () { auto = false; me.dirty = true; });
    return me;
  };

  /* ---------- 2. algebraic invariants: sphere vs torus ---------- */
  SC.invariants = function (sec, cv) {
    var cam = newCam({ yaw: 0.4, pitch: 0.35, S: 215, cy: H * 0.54 }), step = 0, me = {}, tt = 0;
    function render(ctx, C) {
      var P = function (v, dx) { var q = L.proj(v, cam); return [q[0] + dx * cam.S, q[1], q[2]]; };
      var sw = [];
      for (var i = 0; i < 14; i++) sw.push(curve(function (t) { return sph(i / 14 * TAU, -PI / 2 + t * PI); }, 36));
      for (var j = 1; j < 7; j++) sw.push(curve(function (t) { return sph(t * TAU, -PI / 2 + j / 7 * PI); }, 60));
      sw.forEach(function (p) { L.poly(p.map(function (v) { return P(v, -2.1); }), C.muted, 1, 0.5); });
      var tw = [];
      for (i = 0; i < 20; i++) tw.push(curve(function (t) { return torus(i / 20 * TAU, t * TAU, 1, 0.42); }, 36));
      for (j = 0; j < 10; j++) tw.push(curve(function (t) { return torus(t * TAU, j / 10 * TAU, 1, 0.42); }, 72));
      tw.forEach(function (p) { L.poly(p.map(function (v) { return P(v, 2.1); }), C.muted, 1, 0.5); });
      if (step >= 1) {
        var lat = 0.15 + 1.2 * (0.5 + 0.5 * Math.cos(tt)), r = Math.cos(lat > 1.45 ? 1.45 : lat), y = Math.sin(lat > 1.45 ? 1.45 : lat);
        L.poly(curve(function (t) { var a = t * TAU; return [r * Math.cos(a), y, r * Math.sin(a)]; }, 60).map(function (v) { return P(v, -2.1); }), C.rot, 8, 1);
        L.poly(curve(function (t) { return torus(0.0, t * TAU, 1, 0.42); }, 48).map(function (v) { return P(v, 2.1); }), C.rot, 8, 1);
      }
      L.flush(ctx, DPR);
    }
    me.cv = cv; me.render = render; me.step = function (n) { step = n; me.dirty = true; };
    me.tick = function () { cam.yaw += 0.003; tt += 0.025; return true; };
    L.drag(cv, cam, function () { me.dirty = true; });
    return me;
  };

  /* ---------- 3. holes and homology ---------- */
  SC.holes = function (sec, cv) {
    var SH = { circle: [1, 1, 0], sphere: [1, 0, 1], torus: [1, 2, 1], two: [2, 2, 0], disk: [1, 0, 0] }, cam = newCam({ yaw: 0.6, pitch: 0.45, cx: W * 0.37, cy: H * 0.55, S: 300 });
    var st = { shape: "circle", hl: null }, me = {}, auto = true, CL = ["triv", "rot", "sign"], SHAPES = ["circle", "sphere", "torus", "two", "disk"];
    function geom() {
      var s = st.shape, Wr = [], K = [[], [], []], i, j;
      if (s === "circle") { var c = ring(0, 0, 0, 1.2, 80); Wr.push(c); K[1].push(c); K[0].push([1.2, 0, 0]); }
      else if (s === "disk") { [0.3, 0.6, 0.9, 1.2].forEach(function (rr) { Wr.push(ring(0, 0, 0, rr, 60)); }); for (i = 0; i < 8; i++) Wr.push([[0, 0, 0], [1.2 * Math.cos(i * PI / 4), 0, 1.2 * Math.sin(i * PI / 4)]]); K[0].push([0, 0, 0]); }
      else if (s === "two") { var a = ring(-1.25, 0, 0, 0.95, 70), b = ring(1.25, 0, 0, 0.95, 70); Wr.push(a, b); K[1].push(a, b); K[0].push([-0.3, 0, 0], [2.2, 0, 0]); }
      else if (s === "sphere") { for (i = 0; i < 12; i++) Wr.push(curve(function (t) { return sph(i / 12 * TAU, -PI / 2 + t * PI); }, 40)); for (j = 1; j < 6; j++) Wr.push(curve(function (t) { return sph(t * TAU, -PI / 2 + j / 6 * PI); }, 60)); K[2] = Wr.slice(); K[0].push(sph(0.4, 0.5)); }
      else { for (i = 0; i < 18; i++) Wr.push(curve(function (t) { return torus(i / 18 * TAU, t * TAU, 1, 0.42); }, 36)); for (j = 0; j < 10; j++) Wr.push(curve(function (t) { return torus(t * TAU, j / 10 * TAU, 1, 0.42); }, 72)); K[1].push(curve(function (t) { return torus(0, t * TAU, 1, 0.42); }, 48), curve(function (t) { return torus(t * TAU, 0, 1, 0.42); }, 80)); K[2] = Wr.slice(); K[0].push(torus(1.1, 0.3, 1, 0.42)); }
      return { W: Wr, K: K };
    }
    function render(ctx, C) {
      var cm = Object.assign({}, cam, { S: st.shape === "two" ? 230 : 300 }), G = geom(), P = function (v) { return L.proj(v, cm); }, hl = st.hl;
      var dim = function (d) { return hl === null ? 1 : (hl === d ? 1 : 0.16); };
      G.W.forEach(function (p) { L.poly(p.map(P), C.muted, st.shape === "circle" || st.shape === "two" ? 2 : 1, 0.45); });
      for (var d = 0; d < 3; d++) {
        var col = C[CL[d]], al = dim(d);
        if (d === 0) G.K[0].forEach(function (v) { L.dot(P(v), col, 11, al, C.panel); });
        else if (d === 1) G.K[1].forEach(function (p) { L.poly(p.map(P), col, 8, al); });
        else if (G.K[2].length && (hl === 2 || hl === null)) G.K[2].forEach(function (p) { L.poly(p.map(P), col, hl === 2 ? 3.2 : 1.6, hl === 2 ? 0.95 : 0.35); });
      }
      L.flush(ctx, DPR);
    }
    function ui() {
      var B = SH[st.shape];
      [0, 1, 2].forEach(function (d) {
        var row = sec.querySelector(".js-h" + d); if (!row) return;
        row.querySelector(".v").textContent = String(B[d]);
        row.classList.toggle("sel", st.hl === d); row.classList.toggle("zero", !B[d]);
      });
      sec.querySelectorAll(".js-shape").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.shape === st.shape)); });
      var hn = sec.querySelector(".js-hnote"); if (hn) hn.textContent = st.shape === "disk" ? "A disk is contractible, so it is acyclic: its homology is that of a point." : "";
      me.dirty = true;
    }
    sec.querySelectorAll(".js-shape").forEach(function (b) { b.addEventListener("click", function () { st.shape = b.dataset.shape; st.hl = null; ui(); }); });
    [0, 1, 2].forEach(function (d) { var row = sec.querySelector(".js-h" + d); if (row) row.addEventListener("click", function () { st.hl = st.hl === d ? null : d; ui(); }); });
    me.cv = cv; me.render = render;
    me.step = function (n) { st.shape = SHAPES[Math.min(Math.max(n, 0), 4)]; st.hl = null; ui(); };
    me.tick = function () { if (auto) { cam.yaw += 0.0035; return true; } return false; };
    L.drag(cv, cam, function () { auto = false; me.dirty = true; });
    ui(); return me;
  };


  /* ---------- 3b. chains on the torus: cycles and boundaries, interactively ---------- */
  SC.chains = function (sec, cv) {
    var N = +(sec.dataset.n || 12), M = +(sec.dataset.m || 8), RK = sec.dataset.mode === "rank", R = 1, r = 0.42, me = {}, cam = newCam({ yaw: 0.4, pitch: 0.8, cx: W * (sec.dataset.mode === "rank" ? 0.3 : 0.35), cy: H * (sec.dataset.mode === "rank" ? 0.46 : 0.57), S: sec.dataset.mode === "rank" ? 262 : 335 });
    var xu, xv, mode = "edge", hover = null, items = { e: [], f: [], v: [] }, selc = null, rk = null;
    var dimSel = null, cnt = { t: 0, anim: null }, lastShown = -3, TOT = [N * M, 2 * N * M, N * M], DCOL = ["triv", "rot", "sign"];
    var mod = function (a, n) { return ((a % n) + n) % n; };
    var TT = function (u, v) { return torus(u / N * TAU, v / M * TAU, R, r); };
    var nrm = function (u, v) { var a = u / N * TAU, b = v / M * TAU; return [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)]; };
    function clear() { xu = []; xv = []; for (var i = 0; i < N; i++) { xu.push(new Array(M).fill(0)); xv.push(new Array(M).fill(0)); } }
    function addFace(i, j) { xu[i][j] ^= 1; xu[i][mod(j + 1, M)] ^= 1; xv[i][j] ^= 1; xv[mod(i + 1, N)][j] ^= 1; }
    function preset(p) {
      clear();
      if (p === "path") { xu[3][1] = xu[4][1] = xu[5][1] = 1; }
      else if (p === "loop") { addFace(6, 1); addFace(7, 1); addFace(6, 2); addFace(7, 2); }
      else if (p === "meridian") { for (var j = 0; j < M; j++) xv[4][j] = 1; }
      else if (p === "longitude") { for (var i = 0; i < N; i++) xu[i][2] = 1; }
      else if (p === "moved") { for (j = 0; j < M; j++) xv[4][j] = 1; addFace(4, 1); addFace(4, 2); addFace(3, 2); addFace(4, 0); }
      ui();
    }
    function gf2rank(rows, cols) {
      var rk2 = 0, c, r, k, m = rows.map(function (x) { return Uint8Array.from(x); });
      for (c = 0; c < cols && rk2 < m.length; c++) {
        var p = -1; for (r = rk2; r < m.length; r++) if (m[r][c]) { p = r; break; }
        if (p < 0) continue; var t = m[rk2]; m[rk2] = m[p]; m[p] = t;
        for (r = 0; r < m.length; r++) if (r !== rk2 && m[r][c]) for (k = c; k < cols; k++) m[r][k] ^= m[rk2][k];
        rk2++;
      }
      return rk2;
    }
    function ranks() {
      var nv = N * M, ne = 2 * N * M, nf = N * M, d1 = [], d2 = [], i, j, row;
      var vi = function (a, b) { return mod(a, N) * M + mod(b, M); }, ei = function (kind, a, b) { return (kind === "u" ? 0 : nv) + mod(a, N) * M + mod(b, M); };
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) { row = new Uint8Array(nv); row[vi(i, j)] ^= 1; row[vi(i + 1, j)] ^= 1; d1.push(row); }
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) { row = new Uint8Array(nv); row[vi(i, j)] ^= 1; row[vi(i, j + 1)] ^= 1; d1.push(row); }
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) { row = new Uint8Array(ne); row[ei("u", i, j)] ^= 1; row[ei("u", i, j + 1)] ^= 1; row[ei("v", i, j)] ^= 1; row[ei("v", i + 1, j)] ^= 1; d2.push(row); }
      var r1 = gf2rank(d1, nv), r2 = gf2rank(d2, ne);
      return { c: [nv, ne, nf], r1: r1, r2: r2, H: [nv - r1, ne - r1 - r2, nf - r2] };
    }
    function applySel() {
      clear();
      if (selc && selc.d === 2) addFace(selc.i, selc.j);
      else if (selc && selc.d === 1) (selc.k === "u" ? xu : xv)[selc.i][selc.j] = 1;
    }
    function analyze() {
      var odd = [], n = 0, i, j;
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) {
        n += xu[i][j] + xv[i][j];
        if ((xu[i][j] + xu[mod(i - 1, N)][j] + xv[i][j] + xv[i][mod(j - 1, M)]) % 2) odd.push([i, j]);
      }
      var res = { n: n, odd: odd, cycle: odd.length === 0 && n > 0, a: 0, b: 0, D: null };
      if (!res.cycle) return res;
      for (j = 0; j < M; j++) res.a ^= xu[0][j]; for (i = 0; i < N; i++) res.b ^= xv[i][0];
      if (res.a === 0 && res.b === 0) {
        var f = []; for (i = 0; i < N; i++) f.push(new Array(M).fill(-1));
        f[0][0] = 0; var q = [[0, 0]];
        while (q.length) {
          var c = q.shift(), ci = c[0], cj = c[1], v = f[ci][cj];
          [[ci, mod(cj - 1, M), xu[ci][cj]], [ci, mod(cj + 1, M), xu[ci][mod(cj + 1, M)]], [mod(ci - 1, N), cj, xv[ci][cj]], [mod(ci + 1, N), cj, xv[mod(ci + 1, N)][cj]]].forEach(function (nb) { if (f[nb[0]][nb[1]] < 0) { f[nb[0]][nb[1]] = v ^ nb[2]; q.push([nb[0], nb[1]]); } });
        }
        var cnt = 0; for (i = 0; i < N; i++) for (j = 0; j < M; j++) cnt += f[i][j];
        if (cnt > N * M / 2) for (i = 0; i < N; i++) for (j = 0; j < M; j++) f[i][j] ^= 1;
        res.D = f;
      }
      return res;
    }

    // ===== rank mode: the boundary maps as matrices over F2, row reduction, then kernel and image drawn on the torus =====
    var NV = N * M, NE = 2 * N * M, NF = N * M, MAT = null, RED = null, KER = null, IMG = null, CLS = null, CHK = 0;
    var zoom = { open: false, mode: null, which: "d1" }, rr = null, cyc = null;
    function vidx(a, b) { return mod(a, N) * M + mod(b, M); }
    function buildMats() {
      var d1 = [], d2 = [], i, j, r;
      for (r = 0; r < NV; r++) d1.push(new Uint8Array(NE));
      for (r = 0; r < NE; r++) d2.push(new Uint8Array(NF));
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) {
        var eu = i * M + j, ev = NV + i * M + j, f = i * M + j;
        d1[vidx(i, j)][eu] ^= 1; d1[vidx(i + 1, j)][eu] ^= 1; d1[vidx(i, j)][ev] ^= 1; d1[vidx(i, j + 1)][ev] ^= 1;
        d2[eu][f] ^= 1; d2[i * M + mod(j + 1, M)][f] ^= 1; d2[ev][f] ^= 1; d2[NV + mod(i + 1, N) * M + j][f] ^= 1;
      }
      return { d1: d1, d2: d2 };
    }
    function reduce(A0, rows, cols) {
      var A = A0.map(function (x) { return Uint8Array.from(x); }), steps = [], r = 0, c, k, m, copy = function () { return A.map(function (x) { return Uint8Array.from(x); }); };
      // T tracks the row operations: row i of the reduced matrix is the sum of the original rows j with T[i][j] = 1
      var T = []; for (k = 0; k < rows; k++) { var t0 = new Uint8Array(rows); t0[k] = 1; T.push(t0); }
      var copyT = function () { return T.map(function (x) { return Uint8Array.from(x); }); };
      for (c = 0; c < cols && r < rows; c++) {
        var p = -1; for (k = r; k < rows; k++) if (A[k][c]) { p = k; break; }
        if (p < 0) continue;
        if (p !== r) { var tmp = A[r]; A[r] = A[p]; A[p] = tmp; var tt0 = T[r]; T[r] = T[p]; T[p] = tt0; }
        var mid = copy(), tmid = copyT(), xr = [];
        for (k = 0; k < rows; k++) if (k !== r && A[k][c]) { xr.push(k); for (m = 0; m < cols; m++) A[k][m] ^= A[r][m]; for (m = 0; m < rows; m++) T[k][m] ^= T[r][m]; }
        steps.push({ c: c, r: r, xr: xr, mid: mid, snap: copy(), tmid: tmid, tsnap: copyT() }); r++;
      }
      return { A0: A0, steps: steps, final: A, T: T, rank: r, piv: steps.map(function (x) { return x.c; }), rows: rows, cols: cols };
    }
    function rankVecs(vs) {
      var piv = {}, rk2 = 0;
      vs.forEach(function (v0) { var v = Uint8Array.from(v0); for (;;) { var p = -1, k; for (k = 0; k < v.length; k++) if (v[k]) { p = k; break; } if (p < 0) break; if (piv[p]) { var w = piv[p]; for (k = 0; k < v.length; k++) v[k] ^= w[k]; } else { piv[p] = v; rk2++; break; } } });
      return rk2;
    }
    function initMats() {
      MAT = buildMats(); RED = { d1: reduce(MAT.d1, NV, NE), d2: reduce(MAT.d2, NE, NF) };
      var free = [], isP = {}; RED.d1.piv.forEach(function (c) { isP[c] = 1; }); for (var c = 0; c < NE; c++) if (!isP[c]) free.push(c);
      KER = { free: free, basis: free.map(function (f) { var x = new Uint8Array(NE); x[f] = 1; RED.d1.piv.forEach(function (pc, i) { x[pc] = RED.d1.final[i][f]; }); return x; }) };
      IMG = RED.d2.piv.map(function (j) { var x = new Uint8Array(NE); for (var r = 0; r < NE; r++) x[r] = MAT.d2[r][j]; return x; });
      var a = new Uint8Array(NE), b = new Uint8Array(NE), i, j;
      for (j = 0; j < M; j++) a[NV + 0 * M + j] = 1;
      for (i = 0; i < N; i++) b[i * M + 0] = 1;
      CLS = [a, b]; CHK = rankVecs(IMG.concat([a, b]));
    }
    function setVec(x) { clear(); for (var i = 0; i < N; i++) for (var j = 0; j < M; j++) { xu[i][j] = x[i * M + j]; xv[i][j] = x[NV + i * M + j]; } me.dirty = true; }
    function panelEl() { return sec.querySelector(".js-zoom"); }
    function rrFrame() {
      var res = rr.res, st = res.steps, k = rr.k;
      if (k < 0) return { A: res.A0, hl: {}, T: null };
      var s2 = st[k];
      return rr.ph === 0 ? { A: s2.mid, hl: { pivCol: s2.c, pivRow: s2.r, xr: s2.xr }, T: s2.tmid } : { A: s2.snap, hl: {}, T: s2.tsnap };
    }
    var DN = { d1: false, d2: false, q: false };
    function rrDone() { return rr && rr.k === rr.res.steps.length - 1 && rr.ph === 1; }
    function rrRank() { return rr.k < 0 ? 0 : rr.k + (rr.ph === 1 ? 1 : 0); }
    function startReduce(which, auto) { DN[which] = false; DN.q = false; rr = { which: which, res: RED[which], k: -1, ph: 0, playing: !!auto && !L.reduced, t0: performance.now() }; }
    function finishReduce(which) { var res = RED[which]; DN[which] = true; rr = { which: which, res: res, k: res.steps.length - 1, ph: 1, playing: false, t0: 0 }; }
    function advanceRR() { if (rrDone()) { rr.playing = false; return; } if (rr.k >= 0 && rr.ph === 0) rr.ph = 1; else { rr.k++; rr.ph = 0; } if (rrDone()) rr.playing = false; }
    var HV = null, HL = null;
    function curT() { var m = zoom.mode; if (m === "matrix") return rr ? rrFrame().T : null; if (m === "kernel") return RED.d1.T; if (m === "image") return RED.d2.T; return null; }
    function rowSet(r0) { var T = curT(), out = [], k; if (!T) return [r0]; for (k = 0; k < T[r0].length; k++) if (T[r0][k]) out.push(k); return out; }
    function setHV(h) {
      var same = (!h && !HV) || (h && HV && h.r === HV.r && h.c === HV.c); if (same) return;
      HV = h; HL = null;
      if (h) { var d1 = zoom.which === "d1"; HL = { src: { d: d1 ? 1 : 2, idx: h.c }, tgt: rowSet(h.r).map(function (x) { return { d: d1 ? 0 : 1, idx: x }; }) }; }
      drawPanel(); me.dirty = true;
    }
    function hovCaption() {
      var d1 = zoom.which === "d1", sn = d1 ? "edge" : "face", tn = d1 ? "vertex" : "edge", T = curT(), rows = rowSet(HV.r), A = MAT[zoom.which], s = "<span class='hs'>" + sn + " " + (HV.c + 1) + "</span>";
      if (!T) { var v = A[HV.r][HV.c]; return "Column " + (HV.c + 1) + " is " + s + ", row " + (HV.r + 1) + " is <span class='ht'>" + tn + " " + (HV.r + 1) + "</span>. Entry " + v + ": the " + tn + " " + (v ? "is" : "is not") + " " + (d1 ? "an endpoint of the edge." : "on the boundary of the face."); }
      return "Column " + (HV.c + 1) + " is still " + s + ". Row " + (HV.r + 1) + " is now " + (rows.length === 1 ? "<span class='ht'>" + tn + " " + (rows[0] + 1) + "</span>" : "the sum of <span class='ht'>" + rows.length + " original " + (d1 ? "vertices" : "edges") + "</span>") + ".";
    }
    function drawMat(cvs, A, rows, cols, cell, o) {
      var dpr = 2, w = cols * cell, h = rows * cell, g = cvs.getContext("2d"), Cc = L.colors(), r, c;
      cvs.width = w * dpr; cvs.height = h * dpr; cvs.style.width = w + "px"; cvs.style.height = h + "px"; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      o = o || {};
      // column bands (pivot, free, current column) are left out of the PDF, where they read as stray stripes
      if (!window.TalkPdfMode) (o.pivSet || []).forEach(function (cc) { g.globalAlpha = 0.13; g.fillStyle = Cc.triv; g.fillRect(cc * cell, 0, cell, h); });
      if (!window.TalkPdfMode) (o.freeSet || []).forEach(function (cc) { g.globalAlpha = 0.13; g.fillStyle = Cc.rot; g.fillRect(cc * cell, 0, cell, h); });
      if (!window.TalkPdfMode && o.col != null && o.col >= 0) { g.globalAlpha = 0.3; g.fillStyle = o.colColor || Cc.rot; g.fillRect(o.col * cell, 0, cell, h); }
      if (o.pivCol != null) { g.globalAlpha = 0.28; g.fillStyle = Cc.triv; g.fillRect(o.pivCol * cell, 0, cell, h); }
      if (o.pivRow != null) { g.globalAlpha = 0.28; g.fillStyle = Cc.sign; g.fillRect(0, o.pivRow * cell, w, cell); }
      (o.xr || []).forEach(function (rr2) { g.globalAlpha = 0.25; g.fillStyle = Cc.mix; g.fillRect(0, rr2 * cell, w, cell); });
      if (HV && !o.thumb) { g.globalAlpha = 0.2; g.fillStyle = Cc.rot; g.fillRect(HV.c * cell, 0, cell, h); g.fillStyle = Cc.triv; g.fillRect(0, HV.r * cell, w, cell); g.globalAlpha = 1; g.lineWidth = 2; g.strokeStyle = Cc.ink; g.strokeRect(HV.c * cell + 1, HV.r * cell + 1, cell - 2, cell - 2); }
      g.globalAlpha = 1; g.strokeStyle = Cc.rule; g.lineWidth = 0.5;
      if (!o.thumb) for (r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * cell); g.lineTo(w, r * cell); g.stroke(); }
      if (!o.thumb) for (c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(c * cell, 0); g.lineTo(c * cell, h); g.stroke(); }
      var pivSet = {}; (o.pivEntries || []).forEach(function (pe) { pivSet[pe[0] + "," + pe[1]] = 1; });
      for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) if (A[r][c]) { g.fillStyle = pivSet[r + "," + c] ? Cc.triv : Cc.ink; g.beginPath(); if (o.thumb) g.rect(c * cell, r * cell, cell, cell); else g.roundRect(c * cell + 1.2, r * cell + 1.2, cell - 2.4, cell - 2.4, 1.5); g.fill(); }
    }
    function drawThumbs() {
      sec.querySelectorAll(".js-th").forEach(function (b) {
        var cvs = b.querySelector("canvas"), w = b.dataset.w, A = MAT[w], rows = w === "d1" ? NV : NE, cols = w === "d1" ? NE : NF, cell = 3;
        drawMat(cvs, A, rows, cols, cell, { thumb: true });
      });
    }
    var bdLast = null;
    function drawBD() {
      var el = sec.querySelector(".js-bd"); if (!el || !RED) return;
      var r1 = RED.d1.rank, r2 = RED.d2.rank, d1 = DN.d1, d2 = DN.d2, q = DN.q, H = q ? "h" : "z";
      function bar(n, parts) {
        return "<div class='bdbar'>" + (parts || [[n, "u"]]).map(function (p) { return p[0] > 0 ? "<i class='" + p[1] + "' style='flex:" + p[0] + "'>" + (p[0] / n > 0.1 && p[1] !== "u" ? p[0] : "") + "</i>" : ""; }).join("") + "</div>";
      }
      var c2 = d2 ? [[r2, "g"], [NF - r2, H]] : null;
      var c1 = d1 && d2 ? [[r1, "g"], [r2, "b"], [NE - r1 - r2, H]] : d1 ? [[r1, "g"], [NE - r1, "z"]] : d2 ? [[r2, "b"], [NE - r2, "u"]] : null;
      var c0 = d1 ? [[r1, "b"], [NV - r1, H]] : null;
      var t2 = d2 ? NF + " = " + r2 + " + " + (NF - r2) : "", t1 = d1 ? NE + " = " + r1 + " + " + (NE - r1) : "", t0 = d1 ? "all " + NV + " are cycles" : "";
      var h2 = q ? "H₂ = " + (NF - r2) + " − 0 = " + (NF - r2) : "", h1 = q ? "H₁ = " + (NE - r1) + " − " + r2 + " = " + (NE - r1 - r2) : "", h0 = q ? "H₀ = " + NV + " − " + r1 + " = " + (NV - r1) : "";
      var html = "<div class='bdg'>"
        + "<div class='bh'><b>C₂</b> <small>" + NF + "</small></div><span class='bar2'></span><div class='bh'><b>C₁</b> <small>" + NE + "</small></div><span class='bar2'></span><div class='bh'><b>C₀</b> <small>" + NV + "</small></div>"
        + bar(NF, c2) + "<span class='ba" + (d2 ? " on" : "") + "'>∂₂ →</span>" + bar(NE, c1) + "<span class='ba" + (d1 ? " on" : "") + "'>∂₁ →</span>" + bar(NV, c0)
        + "<div class='bt'>" + t2 + "</div><span></span><div class='bt'>" + t1 + "</div><span></span><div class='bt'>" + t0 + "</div>"
        + "<div class='bt hh'>" + h2 + "</div><span></span><div class='bt hh'>" + h1 + "</div><span></span><div class='bt hh'>" + h0 + "</div></div>"
        + "<div class='bl'><span><i class='g'></i>not cycles</span><span><i class='z'></i>cycles</span><span><i class='b'></i>boundaries</span><span><i class='h'></i>homology</span></div>";
      if (html !== bdLast) { bdLast = html; el.innerHTML = html; }
    }
    function panelTitle() { return zoom.which === "d1" ? "∂₁ : C₁ → C₀, a " + NV + " × " + NE + " matrix over 𝔽₂" : "∂₂ : C₂ → C₁, a " + NE + " × " + NF + " matrix over 𝔽₂"; }
    function dimsRow() { var r1 = RED.d1.rank, r2 = RED.d2.rank; return { Z: [NV, NE - r1, NF - r2], B: [r1, r2, 0] }; }
    function renderPanel() {
      var P = panelEl(); if (!P) return; HV = null; HL = null;
      P.style.display = zoom.open ? "block" : "none"; if (!zoom.open) return;
      var m = zoom.mode, h = "<div class='mz-head'><div><b>" + (m === "quotient" ? "Cycles modulo boundaries" : m === "summary" ? "Putting it together" : panelTitle()) + "</b><div class='mz-sub'></div></div><button class='mz-x' data-act='close' type='button' aria-label='Close'>✕</button></div>";
      if (m === "matrix" || m === "kernel" || m === "image") h += "<div class='mz-body'><canvas class='mz-cv'></canvas></div>";
      if (m === "matrix") h += "<div class='mz-ctl'><button class='btn' data-act='play' type='button'>Row Reduce</button><button class='btn ghost' data-act='step' type='button'>Step</button><button class='btn ghost' data-act='skip' type='button'>Result</button><button class='btn ghost' data-act='reset' type='button'>Reset</button></div>";
      if (m === "kernel" || m === "image" || m === "quotient") h += "<div class='mz-ctl'><button class='btn ghost' data-act='prev' type='button'>◀ Prev</button><button class='btn ghost' data-act='next' type='button'>Next ▶</button><button class='btn' data-act='auto' type='button'>Pause</button></div>";
      h += "<div class='mz-info'></div>";
      P.innerHTML = h; drawPanel();
    }
    function drawPanel() {
      var P = panelEl(); if (!P || !zoom.open) return; var m = zoom.mode, info = P.querySelector(".mz-info"), sub = P.querySelector(".mz-sub"), cv2 = P.querySelector(".mz-cv"), dm = dimsRow();
      var d = zoom.which === "d1" ? { r: NV, c: NE, cell: 10, res: RED.d1 } : { r: NE, c: NF, cell: 8, res: RED.d2 };
      if (m === "matrix" && rr) {
        var fr = rrFrame(), done = rrDone(); if (done) DN[rr.which] = true; drawBD();
        drawMat(cv2, fr.A, d.r, d.c, d.cell, { pivCol: fr.hl.pivCol, pivRow: fr.hl.pivRow, xr: fr.hl.xr, pivSet: done ? d.res.piv : null, pivEntries: done ? d.res.piv.map(function (pc, i) { return [i, pc]; }) : null });
        sub.textContent = zoom.which === "d1" ? "Maps each edge to its two endpoints. Columns are edges, rows are points." : "Maps each face to its four edges. Columns are faces, rows are edges.";
        info.innerHTML = rr.k < 0 ? "<div class='how'>We can calculate the dimensions of the cycles and boundaries using elementary linear algebra, by row reduction.</div>"
          : "<span class='rk'>rank = <b>" + rrRank() + "</b></span>" + (done ? "<div class='fin'>Done: rank <b>" + d.res.rank + "</b>. " + (zoom.which === "d1" ? "The " + (NE - d.res.rank) + " free columns give the kernel." : "The " + d.res.rank + " pivot columns span the image.") + "</div>" : "");
        var pb = P.querySelector("[data-act=play]"); if (pb) pb.textContent = rr.playing ? "Pause" : "Row Reduce";
      } else if (m === "kernel") {
        var k = cyc ? cyc.idx : 0;
        drawMat(cv2, RED.d1.final, NV, NE, 10, { freeSet: KER.free, pivEntries: RED.d1.piv.map(function (pc, i) { return [i, pc]; }), col: KER.free[k], colColor: L.colors().rot });
        sub.textContent = "Each free column gives one vector x with ∂₁x = 0: a cycle.";
        info.innerHTML = "<div class='big3'><b>" + KER.basis.length + "</b> free columns = <b>" + KER.basis.length + "</b> basis cycles</div><div class='cap'>cycles: " + NE + " − " + RED.d1.rank + " = " + dm.Z[1] + ". Showing cycle <b>" + (k + 1) + "</b> of " + KER.basis.length + " on the torus.</div>";
      } else if (m === "image") {
        var k2 = cyc ? cyc.idx : 0;
        drawMat(cv2, RED.d2.final, NE, NF, 8, { pivSet: RED.d2.piv, pivEntries: RED.d2.piv.map(function (pc, i) { return [i, pc]; }), col: RED.d2.piv[k2], colColor: L.colors().sign });
        sub.textContent = "The pivot columns of ∂₂ are independent boundaries: each is the edge of a face.";
        info.innerHTML = "<div class='big3'><b>" + IMG.length + "</b> pivot columns = <b>" + IMG.length + "</b> independent boundaries</div><div class='cap'>boundaries: rank ∂₂ = " + dm.B[1] + ". Showing the boundary of face <b>" + (RED.d2.piv[k2] + 1) + "</b> on the torus.</div>";
      } else if (m === "quotient") {
        var k3 = cyc ? cyc.idx : 0, bw = Math.round(100 * dm.B[1] / dm.Z[1]);
        sub.textContent = "Cycles are the kernel, boundaries the image. What is left over is homology.";
        info.innerHTML = "<div class='bars'><div class='bz' style='width:" + bw + "%'><span>" + dm.B[1] + " boundaries</span></div><div class='bc' style='width:" + (100 - bw) + "%'><span>" + (dm.Z[1] - dm.B[1]) + "</span></div></div>"
          + "<div class='big3'>" + dm.Z[1] + " cycles − " + dm.B[1] + " boundaries = <b>" + (dm.Z[1] - dm.B[1]) + "</b></div>"
          + "<div class='cap'>The boundaries together with the two loops <b>a</b> (around the tube) and <b>b</b> (around the hole) span all " + CHK + " cycles. Row reduction confirms it: rank " + CHK + " = " + dm.Z[1] + ". Showing loop <b>" + ["a", "b"][k3] + "</b>. So H₁ = 𝔽₂².</div>";
      } else if (m === "summary") {
        sub.textContent = "Every number in the diagram below comes from row reducing the two matrices.";
        info.innerHTML = [["dim H₀(X)", "h0", "pieces"], ["dim H₁(X)", "h1", "loops"], ["dim H₂(X)", "h2", "voids"]].map(function (r, q2) { return "<div class='hrow " + r[1] + "' style='cursor:default'><span class='hn'>" + r[0] + "</span><span class='eqs'>=</span><span class='v'>" + (dm.Z[q2] - dm.B[q2]) + "</span><span class='hd'>" + r[2] + "</span></div>"; }).join("") + "<div class='cap' style='margin-top:12px'>dim H<sub>k</sub> = cycles − boundaries: one piece, two independent loops, one void. This is the torus.</div>";
      }
      if (HV && sub && (m === "matrix" || m === "kernel" || m === "image")) sub.innerHTML = hovCaption();
      var ab = P.querySelector("[data-act=auto]"); if (ab && cyc) ab.textContent = cyc.auto ? "Pause" : "Auto-play";
    }
    function applyCyc() {
      if (!cyc) return;
      if (cyc.kind === "ker") setVec(KER.basis[cyc.idx]); else if (cyc.kind === "img") setVec(IMG[cyc.idx]); else setVec(CLS[cyc.idx]);
      drawPanel();
    }
    function startCyc(kind) { cyc = { kind: kind, idx: 0, auto: !L.reduced, last: performance.now(), period: kind === "cls" ? 1600 : 520, n: kind === "ker" ? KER.basis.length : kind === "img" ? IMG.length : 2 }; applyCyc(); }
    function openPanel(mode, which) { zoom.open = true; zoom.mode = mode; if (which) zoom.which = which; renderPanel(); }
    function closePanel() { zoom.open = false; zoom.mode = null; cyc = null; rr = null; clear(); renderPanel(); me.dirty = true; ui(); }
    function panelStep(n) {
      DN.d1 = n >= 8; DN.d2 = n >= 10; DN.q = n >= 11;
      if (n < 7) { if (zoom.open) closePanel(); drawBD(); return; }
      if (n === 7) { startReduce("d1", false); cyc = null; clear(); openPanel("matrix", "d1"); }
      else if (n === 8) { finishReduce("d1"); openPanel("kernel", "d1"); startCyc("ker"); }
      else if (n === 9) { startReduce("d2", false); cyc = null; clear(); openPanel("matrix", "d2"); }
      else if (n === 10) { finishReduce("d2"); openPanel("image", "d2"); startCyc("img"); }
      else if (n === 11) { openPanel("quotient"); startCyc("cls"); }
      else { cyc = null; clear(); openPanel("summary"); }
      drawBD();
    }
    function panelTick(now) {
      var moved = false;
      if (rr && rr.playing && zoom.open && zoom.mode === "matrix" && now - rr.t0 > 110) { rr.t0 = now; advanceRR(); drawPanel(); moved = true; }
      if (cyc && cyc.auto && zoom.open && now - cyc.last > cyc.period) { cyc.last = now; cyc.idx = (cyc.idx + 1) % cyc.n; applyCyc(); moved = true; }
      return moved;
    }
    function wirePanel() {
      var P = panelEl(); if (!P) return;
      P.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return; var a = b.dataset.act;
        if (a === "close") closePanel();
        else if (a === "play" && rr) { if (rrDone()) startReduce(rr.which, true); else rr.playing = !rr.playing; rr.t0 = performance.now(); drawPanel(); }
        else if (a === "step" && rr) { rr.playing = false; advanceRR(); drawPanel(); }
        else if (a === "skip" && rr) { finishReduce(rr.which); drawPanel(); }
        else if (a === "reset" && rr) { startReduce(rr.which, false); drawPanel(); }
        else if (cyc && (a === "prev" || a === "next")) { cyc.auto = false; cyc.idx = (cyc.idx + (a === "next" ? 1 : cyc.n - 1)) % cyc.n; applyCyc(); }
        else if (cyc && a === "auto") { cyc.auto = !cyc.auto; cyc.last = performance.now(); drawPanel(); }
        me.dirty = true;
      });
      var hv = function (e) {
        var cv2 = P.querySelector(".mz-cv"); if (!cv2 || e.target !== cv2 || !(zoom.mode === "matrix" || zoom.mode === "kernel" || zoom.mode === "image")) return setHV(null);
        var rc = cv2.getBoundingClientRect(), dims = zoom.which === "d1" ? [NV, NE] : [NE, NF], c = Math.floor((e.clientX - rc.left) / rc.width * dims[1]), r0 = Math.floor((e.clientY - rc.top) / rc.height * dims[0]);
        setHV(r0 < 0 || c < 0 || r0 >= dims[0] || c >= dims[1] ? null : { r: r0, c: c });
      };
      P.addEventListener("pointermove", hv); P.addEventListener("pointerdown", hv); P.addEventListener("pointerleave", function () { setHV(null); });
      sec.querySelectorAll(".js-th").forEach(function (b) { b.addEventListener("click", function () { var w = b.dataset.w; startReduce(w, false); cyc = null; clear(); dimSel = null; selc = null; openPanel("matrix", w); ui(); }); });
    }
    function render(ctx, C) {
      var A = analyze(), P = function (v) { return L.proj(v, cam); }, ld = [0.3, 0.8, 0.5], i, j, bias = function (q, b) { return q ? [q[0], q[1], q[2] + b] : q; };
      items = { e: [], f: [], v: [] };
      var CM = RK && dimSel !== null, shown = CM ? Math.min(TOT[dimSel], Math.floor(cnt.t * TOT[dimSel] + 1e-9)) : 0;
      var front = function (pos, n) { var a = P(pos), b = P([pos[0] + 0.05 * n[0], pos[1] + 0.05 * n[1], pos[2] + 0.05 * n[2]]); return b[2] > a[2]; };
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) {
        var inD = A.D && A.D[i][j], SB = 3, fIdx = i * M + j, cf = CM && dimSel === 2 && fIdx < shown;
        for (var sa = 0; sa < SB; sa++) for (var sb = 0; sb < SB; sb++) {
          var u0 = i + sa / SB, u1 = i + (sa + 1) / SB, v0 = j + sb / SB, v1 = j + (sb + 1) / SB;
          if (cf) { var uc = i + 0.5, vc = j + 0.5, kk = 0.86; u0 = uc + (u0 - uc) * kk; u1 = uc + (u1 - uc) * kk; v0 = vc + (v0 - vc) * kk; v1 = vc + (v1 - vc) * kk; }
          var n = nrm((u0 + u1) / 2, (v0 + v1) / 2);
          var lam = Math.abs(n[0] * ld[0] + n[1] * ld[1] + n[2] * ld[2]) / Math.hypot(ld[0], ld[1], ld[2]);
          var pq = [TT(u0, v0), TT(u1, v0), TT(u1, v1), TT(u0, v1)].map(P), z = (pq[0][2] + pq[1][2] + pq[2][2] + pq[3][2]) / 4, base = mix(C.muted, C.panel, 0.45 + 0.5 * lam);
          if (inD) base = mix(base, C.sign, 0.6);
          if (cf) base = mix(base, C.sign, 0.8);
          L.fill(pq, base, CM ? (cf ? 0.8 : 0.3) : 1, z, CM ? undefined : base, 0.8, 0.9);
        }
        if (cf && fIdx === shown - 1) L.poly([TT(i, j), TT(i + 1, j), TT(i + 1, j + 1), TT(i, j + 1), TT(i, j)].map(P).map(function (p) { return bias(p, 0.3); }), C.sign, 9, 1);
        n = nrm(i + 0.5, j + 0.5);
        var cp = TT(i + 0.5, j + 0.5); items.f.push({ i: i, j: j, p: P(cp), front: front(cp, n) });
      }
      var edge = function (kind, i, j) {
        var pts = [], k; for (k = 0; k <= 6; k++) pts.push(kind === "u" ? torus((i + k / 6) / N * TAU, j / M * TAU, R, r) : torus(i / N * TAU, (j + k / 6) / M * TAU, R, r));
        var mid = kind === "u" ? [i + 0.5, j] : [i, j + 0.5], pos = TT(mid[0], mid[1]), n = nrm(mid[0], mid[1]), fr = front(pos, n), on = (kind === "u" ? xu[i][j] : xv[i][j]) === 1;
        var hv = hover && hover.kind === "e" && hover.k === kind && hover.i === i && hover.j === j;
        var eIdx = 2 * (i * M + j) + (kind === "u" ? 0 : 1), ce = CM && dimSel === 1 && eIdx < shown;
        if (ce) { var tp = []; for (k = 0; k <= 6; k++) { var tt = 0.1 + 0.8 * k / 6; tp.push(kind === "u" ? torus((i + tt) / N * TAU, j / M * TAU, R, r) : torus(i / N * TAU, (j + tt) / M * TAU, R, r)); } L.poly(tp.map(P).map(function (p) { return bias(p, 0.25); }), C.rot, eIdx === shown - 1 ? 15 : 9, fr ? 1 : 0.6); }
        else if (fr) { var pp = pts.map(P).map(function (p) { return bias(p, on ? 0.35 : 0.2); }); L.poly(pp, on ? C.rot : C.ink, on ? 10 : hv ? 6 : 1.4, on ? 1 : hv ? 0.9 : 0.42); }
        items.e.push({ k: kind, i: i, j: j, p: P(pos), front: fr });
      };
      for (i = 0; i < N; i++) for (j = 0; j < M; j++) { edge("u", i, j); edge("v", i, j); }
      if (hover && hover.kind === "f") { var ff = hover; L.poly([TT(ff.i, ff.j), TT(ff.i + 1, ff.j), TT(ff.i + 1, ff.j + 1), TT(ff.i, ff.j + 1), TT(ff.i, ff.j)].map(P).map(function (p) { return bias(p, 0.3); }), C.sign, 7, 1); }
      A.odd.forEach(function (o) { var p = TT(o[0], o[1]), nn = nrm(o[0], o[1]); if (front(p, nn)) L.dot(bias(P(p), 0.45), C.mix, 13, 1, C.panel); });
      if (RK) for (i = 0; i < N; i++) for (j = 0; j < M; j++) { var vp = TT(i, j), vn = nrm(i, j), vf = front(vp, vn); items.v.push({ i: i, j: j, p: P(vp), front: vf }); if (CM && dimSel === 0 && i * M + j < shown) L.dot(bias(P(vp), 0.45), C.triv, i * M + j === shown - 1 ? 17 : (vf ? 12 : 10), vf ? 1 : 0.75, C.panel); if (selc && selc.d === 0 && selc.i === i && selc.j === j && vf) L.dot(bias(P(vp), 0.45), C.triv, 14, 1, C.panel); }
      if (RK && HL) {
        var one = function (d, idx, col) {
          var i2, j2, k, a, fr, pts, p;
          if (d === 0) { i2 = Math.floor(idx / M); j2 = idx % M; p = TT(i2, j2); fr = front(p, nrm(i2, j2)); a = fr ? 1 : 0.55; L.dot(bias(P(p), 0.6), col, 34, 0.25 * a); L.dot(bias(P(p), 0.65), col, 18, a, C.panel); }
          else if (d === 1) {
            var kind = idx < NV ? "u" : "v", q = idx < NV ? idx : idx - NV; i2 = Math.floor(q / M); j2 = q % M; pts = [];
            for (k = 0; k <= 8; k++) pts.push(kind === "u" ? torus((i2 + k / 8) / N * TAU, j2 / M * TAU, R, r) : torus(i2 / N * TAU, (j2 + k / 8) / M * TAU, R, r));
            var mid = kind === "u" ? [i2 + 0.5, j2] : [i2, j2 + 0.5]; fr = front(TT(mid[0], mid[1]), nrm(mid[0], mid[1])); a = fr ? 1 : 0.55;
            var pp = pts.map(P).map(function (z) { return bias(z, 0.6); }); L.poly(pp, col, 26, 0.25 * a); L.poly(pp, col, 12, a);
          } else {
            i2 = Math.floor(idx / M); j2 = idx % M; fr = front(TT(i2 + 0.5, j2 + 0.5), nrm(i2 + 0.5, j2 + 0.5)); a = fr ? 1 : 0.55; pts = [];
            for (k = 0; k < 6; k++) pts.push(TT(i2 + k / 6, j2)); for (k = 0; k < 6; k++) pts.push(TT(i2 + 1, j2 + k / 6)); for (k = 0; k < 6; k++) pts.push(TT(i2 + 1 - k / 6, j2 + 1)); for (k = 0; k < 6; k++) pts.push(TT(i2, j2 + 1 - k / 6)); pts.push(TT(i2, j2));
            var pq2 = pts.map(P), zm = -9; pq2.forEach(function (z) { zm = Math.max(zm, z[2]); });
            L.fill(pq2.map(function (z) { return [z[0], z[1], z[2]]; }), col, 0.3 * a, zm + 0.05); var ob = pq2.map(function (z) { return bias(z, 0.6); }); L.poly(ob, col, 26, 0.25 * a); L.poly(ob, col, 12, a);
          }
        };
        HL.tgt.forEach(function (t) { one(t.d, t.idx, C.triv); }); one(HL.src.d, HL.src.idx, C.rot);
      }
      L.flush(ctx, DPR);
    }
    function ui() {
      if (RK) return uiRank();
      var A = analyze(), el = sec.querySelector(".js-status"), msg, dcol;
      if (A.n === 0) { dcol = "var(--muted)"; msg = "A chain of edges on the torus. Each edge is counted mod 2."; }
      else if (!A.cycle) { dcol = "var(--mix)"; msg = "<b>Not a cycle.</b> The chain has <b>" + A.odd.length + "</b> loose ends, shown in red, so ∂c ≠ 0."; }
      else if (A.D) { dcol = "var(--sign)"; msg = "<b>A cycle, and a boundary.</b> It is the edge of the shaded patch, so it is zero in homology: [c] = 0."; }
      else { dcol = "var(--rot)"; msg = "<b>A cycle that is not a boundary.</b> Nothing fills it in, so it is a nonzero class [c] in H₁(T²)."; }
      var cls = A.cycle ? (A.a ? (A.b ? 3 : 1) : (A.b ? 2 : 0)) : -1, names = ["0", "a", "b", "a + b"], sub = ["bounds", "around the hole", "around the tube", "both"];
      el.innerHTML = "<div class='stmsg' style='border-left:4px solid " + dcol + "'>" + msg + "</div><div class='eq' style='margin:16px 0 10px;min-height:0;padding-left:14px'>∂c = " + (A.n === 0 ? "?" : A.cycle ? "0" : "{" + A.odd.length + " points}") + "</div>"
        + "<div class='dim note' style='margin-bottom:6px'>Where [c] lands in H₁(T²) = 𝔽₂²:</div><div>" + names.map(function (nm, k) { return "<span class='cls" + (k === cls ? " on" : "") + "'>" + nm + "<small>" + sub[k] + "</small></span>"; }).join("") + "</div>";
      sec.querySelectorAll(".js-mode button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === mode)); });
      me.dirty = true;
    }
    function uiRank() {
      var el = sec.querySelector(".js-status"), msg = "We calculate the chain complex explicitly using the cell structure on the left.", col = "rot";
      if (dimSel === 0) { col = "triv"; msg = "<b>0-cells: points.</b> One at every corner of the grid: " + N + " × " + M + " = " + TOT[0] + "."; }
      else if (dimSel === 1) { col = "rot"; msg = "<b>1-cells: edges.</b> " + TOT[0] + " run around the hole and " + TOT[0] + " run around the tube: " + TOT[1] + " in all."; }
      else if (dimSel === 2) { col = "sign"; msg = "<b>2-cells: faces.</b> One square for each grid cell: " + N + " × " + M + " = " + TOT[2] + "."; }
      else if (selc) {
        if (selc.d === 2) msg = "<b>A face.</b> ∂(face) = its <b>4 edges</b>, drawn in violet.";
        else if (selc.d === 1) msg = "<b>An edge.</b> ∂(edge) = its <b>2 endpoints</b>, in red.";
        else msg = "<b>A vertex.</b> ∂(vertex) = 0.";
      }
      el.innerHTML = "<div class='stmsg' style='border-left:4px solid var(--" + col + ")'>" + msg + "</div>";
      sec.querySelectorAll(".js-dim button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.d === dimSel)); });
      lastShown = -3; updCount(); refreshShow(sec, stepNow); me.dirty = true;
    }
    function updCount() {
      var el = sec.querySelector(".js-count"); if (!el) return;
      if (dimSel === null) { if (lastShown !== -2) { el.innerHTML = ""; lastShown = -2; } return; }
      var sh = Math.min(TOT[dimSel], Math.floor(cnt.t * TOT[dimSel] + 1e-9));
      if (sh === lastShown) return; lastShown = sh;
      el.innerHTML = "<span class='cnum' style='color:var(--" + DCOL[dimSel] + ")'>" + sh + "</span><span class='clab'>" + ["points", "edges", "faces"][dimSel] + " <span class='dim'>(" + dimSel + "-cells)</span></span>";
    }
    function startCount() { cnt.t = 0; cnt.anim = { t0: performance.now(), dur: 1500 }; if (L.reduced) { cnt.t = 1; cnt.anim = null; } lastShown = -3; }
    function names2() { return null; }
    var stepNow = 0;
    function pick(ev) {
      if (RK) {
        var rc2 = cv.getBoundingClientRect(), kk = W / rc2.width, px = (ev.clientX - rc2.left) * kk, py = (ev.clientY - rc2.top) * kk, bestR = null, bs = 1;
        [["v", items.v, 24], ["e", items.e, 30], ["f", items.f, 60]].forEach(function (g) { g[1].forEach(function (it) { if (!it.front) return; var sc = Math.hypot(it.p[0] - px, it.p[1] - py) / g[2]; if (sc < bs) { bs = sc; bestR = { t: g[0], it: it }; } }); });
        return bestR;
      }
      var rc = cv.getBoundingClientRect(), k = W / rc.width, x = (ev.clientX - rc.left) * k, y = (ev.clientY - rc.top) * k, best = null, bd = 1e9;
      var list = mode === "edge" ? items.e : items.f, lim = mode === "edge" ? 28 : 55;
      list.forEach(function (it) { if (!it.front) return; var d = Math.hypot(it.p[0] - x, it.p[1] - y); if (d < bd) { bd = d; best = it; } });
      return bd < lim ? best : null;
    }
    var down = null;
    cv.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", function (e) {
      if (down) { var dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 4) down.moved = true; if (down.moved) { cam.yaw += dx * 0.008; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + dy * 0.008)); down.x = e.clientX; down.y = e.clientY; me.dirty = true; } return; }
      if (RK) { return; }
      var h = pick(e), nh = h ? (mode === "edge" ? { kind: "e", k: h.k, i: h.i, j: h.j } : { kind: "f", i: h.i, j: h.j }) : null;
      if (JSON.stringify(nh) !== JSON.stringify(hover)) { hover = nh; me.dirty = true; }
    });
    cv.addEventListener("pointerup", function (e) {
      if (down && !down.moved && RK) { var hr = pick(e); dimSel = null; if (cyc) cyc.auto = false; selc = hr ? (hr.t === "f" ? { d: 2, i: hr.it.i, j: hr.it.j } : hr.t === "e" ? { d: 1, k: hr.it.k, i: hr.it.i, j: hr.it.j } : { d: 0, i: hr.it.i, j: hr.it.j }) : null; applySel(); ui(); down = null; return; }
      if (down && !down.moved) { var h = pick(e); if (h) { if (mode === "edge") { (h.k === "u" ? xu : xv)[h.i][h.j] ^= 1; } else addFace(h.i, h.j); ui(); } }
      down = null;
    });
    cv.addEventListener("pointerleave", function () { hover = null; me.dirty = true; });
    sec.querySelectorAll(".js-mode button").forEach(function (b) { b.addEventListener("click", function () { mode = b.dataset.v; hover = null; ui(); }); });
    sec.querySelectorAll(".js-pre").forEach(function (b) { b.addEventListener("click", function () { preset(b.dataset.p); }); });
    sec.querySelectorAll(".js-dim button").forEach(function (b) { b.addEventListener("click", function () { var d = +b.dataset.d; if (dimSel === d) dimSel = null; else { dimSel = d; selc = null; applySel(); startCount(); } ui(); }); });
    me.cv = cv; me.render = render;
    // PDF hook: show the open matrix after its row reduction has run
    me.pdf = function (a) { if (RK && a === "reduced" && zoom.open && zoom.mode === "matrix" && rr) { finishReduce(rr.which); drawPanel(); drawBD(); me.dirty = true; } };
    me.step = function (n) {
      stepNow = n;
      if (RK) { var nd = n >= 1 && n <= 3 ? n - 1 : null; if (nd !== dimSel) { dimSel = nd; if (nd !== null) startCount(); } selc = n === 4 ? { d: 1, k: "u", i: 3, j: 1 } : n === 5 ? { d: 2, i: 2, j: 0 } : null; applySel(); panelStep(n); ui(); return; }
      preset(["clear", "path", "loop", "meridian", "moved"][Math.min(n, 4)]);
    };
    me.tick = function (now) { var moved = false; if (cnt.anim) { var u = (now - cnt.anim.t0) / cnt.anim.dur; if (u >= 1) { cnt.t = 1; cnt.anim = null; } else cnt.t = u; updCount(); moved = true; } if (RK && panelTick(now)) moved = true; return moved; };
    clear(); if (RK) { rk = ranks(); initMats(); drawThumbs(); wirePanel(); drawBD(); } ui(); return me;
  };

  /* ---------- 4. cell complex of the sphere: chain complex and orbits ---------- */
  SC.cells = function (sec, cv) {
    var mode = sec.dataset.mode || "chain", K = 4, cam = newCam({ yaw: 0.5, pitch: 0.32, cx: W * 0.36, cy: H * 0.55, S: 330 }), me = {};
    var st = { t: 0, sel: null, anim: null }, names = { 2: ["L0", "L1", "L2", "L3"], 1: ["e0", "e1", "e2", "e3"], 0: ["N", "S"] }, step = 0;
    var bd = function (dim, i) { return dim === 2 ? [i, (i + 1) % K] : dim === 1 ? [0, 1] : []; };
    var pt = function (lat, lon) { return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]; };
    function render(ctx, C) {
      var S = cam.S, P = function (v) { return L.proj(rotY(v, st.t * PI / 2), cam); };
      var g = ctx.createRadialGradient(cam.cx - S * 0.3, cam.cy - S * 0.3, S * 0.1, cam.cx, cam.cy, S);
      g.addColorStop(0, C.panel); g.addColorStop(1, C.sphere); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.cx, cam.cy, S, 0, TAU); ctx.fill();
      var sel = st.sel, bset = {}, k, i;
      if (sel) bd(sel.d, sel.i).forEach(function (j) { bset[(sel.d - 1) + ":" + j] = 1; });
      for (k = 0; k < K; k++) {
        var a0 = k * PI / 2, a1 = a0 + PI / 2, pts = [];
        for (i = 0; i <= 20; i++) pts.push(P(pt(-PI / 2 + i / 20 * PI, a0))); for (i = 20; i >= 0; i--) pts.push(P(pt(-PI / 2 + i / 20 * PI, a1)));
        var cen = P(pt(0, a0 + PI / 4)), isSel = sel && sel.d === 2 && sel.i === k, isB = bset["2:" + k];
        L.fill(pts, C.sign, (isSel ? 0.55 : isB ? 0.45 : 0.14) * (0.45 + 0.55 * Math.min(1, Math.max(0, (cen[2] + 1) / 2))), cen[2] - 0.02);
      }
      for (k = 0; k < K; k++) {
        var e = []; for (i = 0; i <= 30; i++) e.push(P(pt(-PI / 2 + i / 30 * PI, k * PI / 2)));
        var on = sel && sel.d === 1 && sel.i === k, isB2 = bset["1:" + k];
        L.poly(e, C.rot, on ? 10 : isB2 ? 8 : 5, on || isB2 ? 1 : 0.9); L.label(P(pt(0.28, k * PI / 2)), "e" + k, C.ink, 20);
      }
      [[0, 1, 0], [0, -1, 0]].forEach(function (v, j) {
        var on = sel && sel.d === 0 && sel.i === j, isB3 = bset["0:" + j];
        L.dot(P(v), C.triv, on || isB3 ? 14 : 11, 1, C.panel); L.label(P([v[0], v[1] * 1.12, v[2]]), j ? "S" : "N", C.ink, 22);
      });
      for (k = 0; k < K; k++) L.label(P(pt(0, k * PI / 2 + PI / 4)), "L" + k, C.sign, 20);
      L.flush(ctx, DPR);
    }
    function cellBtn(dim, i, col) {
      var on = st.sel && st.sel.d === dim && st.sel.i === i, bdy = st.sel && st.sel.d === dim + 1 && bd(dim + 1, st.sel.i).indexOf(i) >= 0;
      return "<button type='button' class='cell " + col + (on ? " on" : "") + (bdy ? " bd" : "") + "' data-d='" + dim + "' data-i='" + i + "'><span>" + names[dim][i] + "</span></button>";
    }
    function ui() {
      var el = sec.querySelector(".js-panel"), html = "";
      if (mode === "chain") {
        html += "<div class='row'><span class='lab'>C₂</span>" + [0, 1, 2, 3].map(function (i) { return cellBtn(2, i, "sg"); }).join("") + "</div>"
          + "<div class='row'><span class='lab'>C₁</span>" + [0, 1, 2, 3].map(function (i) { return cellBtn(1, i, "rt"); }).join("") + "</div>"
          + "<div class='row'><span class='lab'>C₀</span>" + [0, 1].map(function (i) { return cellBtn(0, i, "tv"); }).join("") + "</div>";
        var msg = "<span class='dim'>Each cell is counted mod 2.</span>";
        if (st.sel) { var b = bd(st.sel.d, st.sel.i); msg = "∂" + names[st.sel.d][st.sel.i] + (b.length ? " = " + b.map(function (j) { return names[st.sel.d - 1][j]; }).join(" + ") : " = 0"); }
        html += "<div class='eq'>" + msg + "</div>";
        html += "<table class='tab' data-show-from='3'><tr><th></th><th>cells</th><th>∂ in</th><th>∂ out</th><th>H</th></tr>"
          + [["H₀", 2, 1, 0, 1], ["H₁", 4, 3, 1, 0], ["H₂", 4, 0, 3, 1]].map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td><td><b>" + FS(r[4]) + "</b></td></tr>"; }).join("") + "</table>";
      } else {
        html += "<table class='tab' data-show-from='2'><tr><th>cells</th><th>how many</th><th>orbit size</th></tr>"
          + "<tr><td class='tv'>● poles N, S</td><td>2</td><td>1 (fixed)</td></tr><tr><td class='rt'>▬ arcs e0 to e3</td><td>4</td><td>4 (free)</td></tr><tr><td class='sg'>◢ lunes L0 to L3</td><td>4</td><td>4 (free)</td></tr></table>"
          + "<div class='eq' data-show-from='3'>χ(X) = <span class='tv'>2</span> − <span class='rt'>4</span> + <span class='sg'>4</span> = 2<br>χ(X<sup>G</sup>) = <span class='tv'>2</span></div>";
      }
      el.innerHTML = html; refreshShow(sec, step); me.dirty = true;
      el.querySelectorAll(".cell").forEach(function (b) { b.addEventListener("click", function () { var d = +b.dataset.d, i = +b.dataset.i; st.sel = (st.sel && st.sel.d === d && st.sel.i === i) ? null : { d: d, i: i }; ui(); }); });
    }
    function apply() { if (st.anim) return; st.anim = { from: st.t, to: st.t + 1, t0: performance.now(), dur: 1100 }; }
    var ab = sec.querySelector(".js-apply"); if (ab) ab.addEventListener("click", apply);
    var rb = sec.querySelector(".js-reset"); if (rb) rb.addEventListener("click", function () { st.t = 0; st.anim = null; me.dirty = true; });
    me.cv = cv; me.render = render;
    me.step = function (n) {
      var prev = step; step = n;
      if (mode === "chain") st.sel = n === 1 ? { d: 2, i: 0 } : n === 2 ? { d: 1, i: 0 } : null;
      else if (n > prev && n === 1) apply();
      ui();
    };
    me.tick = function (now) { if (st.anim) { var u = (now - st.anim.t0) / st.anim.dur; if (u >= 1) { st.t = st.anim.to % 4; st.anim = null; } else st.t = st.anim.from + (st.anim.to - st.anim.from) * ease(Math.max(0, u)); return true; } return false; };
    L.drag(cv, cam, function () { me.dirty = true; });
    ui(); return me;
  };

  /* ---------- 5. sphere with a C4 action: act / fix / smith ---------- */
  SC.sphere = function (sec, cv) {
    var T = function (i) { return { t: "t", c: [i] }; }, Sg = function (i) { return { t: "s", c: [i] }; }, Rr = function (i, j) { return { t: "r", c: [i, j] }; };
    var PRE = [
      { g: [Rr(0, 1), T(2)], plain: "Quarter turn", lab: "<span class='rt'>ℂ</span> ⊕ <span class='tv'>1</span>", note: "A quarter turn about the vertical axis." },
      { g: [T(0), T(1), Sg(2)], plain: "Reflection", lab: "<span class='tv'>1</span> ⊕ <span class='tv'>1</span> ⊕ <span class='sg'>σ</span>", note: "A reflection across the equator." },
      { g: [Rr(0, 1), Sg(2)], plain: "Turn and flip", lab: "<span class='rt'>ℂ</span> ⊕ <span class='sg'>σ</span>", note: "A quarter turn and a flip." },
      { g: [Sg(0), Sg(1), Sg(2)], plain: "Antipodal map", lab: "<span class='sg'>σ</span> ⊕ <span class='sg'>σ</span> ⊕ <span class='sg'>σ</span>", note: "Every point goes to its antipode." }
    ];
    var view = sec.dataset.view, me = {}, step = 0, cam = newCam({ yaw: 0.65, pitch: 0.35, cx: W * (sec.dataset.view === "smith" ? 0.29 : 0.36), cy: H * 0.57, S: sec.dataset.view === "smith" ? 290 : 330 });
    var st = { p: +(sec.dataset.preset || 0), sub: "g", t: 0, anim: null };
    var fib = []; for (var i = 0; i < 170; i++) { var z = 1 - 2 * (i + 0.5) / 170, r = Math.sqrt(1 - z * z), ph = i * 2.39996; fib.push([r * Math.cos(ph), r * Math.sin(ph), z]); }
    var probe = (function () { var v = [0.62, 0.3, 0.72], l = Math.hypot(v[0], v[1], v[2]); return v.map(function (x) { return x / l; }); })();
    var w3 = function (v) { return [v[0], v[2], v[1]]; };
    var touched = false;
    var showFix = function () { return view === "smith" || (view === "fix" && (step >= 1 || touched)); };
    function fixedSet(sb) { var A = [], s2 = sb || st.sub; PRE[st.p].g.forEach(function (g) { if (g.t === "t" || (g.t === "s" && s2 === "g2")) A.push.apply(A, g.c); }); return A.sort(); }
    var betti = function (a) { return a === 3 ? [1, 0, 1] : a === 2 ? [1, 1, 0] : a === 1 ? [2, 0, 0] : [0, 0, 0]; };
    function render(ctx, C) {
      var S = cam.S, P = function (v) { return L.proj(w3(v), cam); };
      var g = ctx.createRadialGradient(cam.cx - S * 0.3, cam.cy - S * 0.3, S * 0.1, cam.cx, cam.cy, S);
      g.addColorStop(0, C.panel); g.addColorStop(1, C.sphere); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.cx, cam.cy, S, 0, TAU); ctx.fill();
      [-0.5, 0, 0.5].forEach(function (zc) { var rr = Math.sqrt(1 - zc * zc); L.poly(curve(function (t) { var a = t * TAU; return [rr * Math.cos(a), rr * Math.sin(a), zc]; }, 72).map(P), C.rule, zc === 0 ? 2 : 1.2, 0.9); });
      var A = showFix() ? fixedSet() : [], grp = PRE[st.p].g, all = A.length === 3, e = function (i) { var v = [0, 0, 0]; v[i] = 1; return v; };
      if (A.length === 2) { var ringPts = curve(function (t) { var a = t * TAU, v = [0, 0, 0]; v[A[0]] = Math.cos(a); v[A[1]] = Math.sin(a); return v; }, 120).map(P); if (view === "fix") L.poly(ringPts, C.triv, 26, 0.22); L.poly(ringPts, C.triv, view === "fix" ? 12 : 9, 0.95); }
      if (A.length === 1) [1, -1].forEach(function (s) { var pp = P(e(A[0]).map(function (x) { return s * x; })); if (view === "fix") L.dot(pp, C.triv, 32, 0.25); L.dot(pp, C.triv, view === "fix" ? 20 : 15, 1, C.panel); });
      fib.forEach(function (v0) { L.dot(P(L.path(v0, st.t, grp)), all ? C.triv : C.muted, 4.2, 0.85); });
      var seen = [];
      for (var i = 0; i < 4; i++) {
        var w = L.path(probe, i, grp), dup = seen.some(function (s) { return Math.hypot(s[0] - w[0], s[1] - w[1], s[2] - w[2]) < 1e-6; });
        if (dup) continue; seen.push(w); L.dot(P(w), C.panel, 11, 1, C.ink); L.label(P(w.map(function (x) { return x * 1.2; })), i === 0 ? "1" : "g" + SUPD[i], C.ink, 22);
      }
      L.dot(P(L.path(probe, st.t, grp)), C.ink, 10, 1, C.panel);
      L.flush(ctx, DPR);
    }
    var auto = sec.hasAttribute("data-autoapply");
    function ui() {
      var chips = sec.querySelector(".js-chips");
      if (chips) { chips.innerHTML = ""; PRE.forEach(function (p, i) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", String(i === st.p)); if (sec.dataset.plain) b.textContent = p.plain; else b.innerHTML = p.lab; b.onclick = function () { st.p = i; st.t = 0; st.anim = null; touched = true; ui(); if (auto) go(); }; chips.appendChild(b); }); }
      sec.querySelectorAll(".js-sub button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === st.sub)); });
      var ap = sec.querySelector(".js-apply"); if (ap) ap.textContent = st.sub === "g" ? "Apply g" : "Apply g²";
      var note = sec.querySelector(".js-note"); if (note) note.textContent = PRE[st.p].note;
      var sn = sec.querySelector(".js-subnote"), fh = sec.querySelector(".js-fxh"), fx = sec.querySelector(".js-fx");
      if (sn && fh && fx) {
        var nm = ["∅", "the two poles", "the equator, a circle", "all of S²"], DS = [
          ["Every point except the two poles is moved. The poles sit on the rotation axis.", "Every point except the equator is moved.", "Every point moves. Even the poles are moved: the flip swaps them.", "Every point goes to its opposite. No point stays put."],], fa = fixedSet("g").length, fb = fixedSet("g2").length, cur = fixedSet().length, G2 = st.sub === "g2";
        var intro = step === 3 && !touched, lab = G2 ? "X<sup>C₂</sup>" : "X<sup>G</sup>";
        fx.className = "fxbig js-fx" + (intro ? " intro" : cur === 0 ? " none" : "") + (step >= 1 || touched ? " on" : "");
        if (intro) { fh.innerHTML = "C₂ = {1, g²} ⊂ C₄"; sn.textContent = "The group C₂ lives inside C₄ as a subgroup, generated by g² (g done twice). It has fewer elements, so fewer conditions: it can fix more. What does C₂ alone fix?"; }
        else {
          fh.innerHTML = lab + " = " + (cur === 0 ? "∅" : nm[cur]) + (cur === 0 ? "<span class='fxs'>nothing is fixed</span>" : "");
          sn.textContent = !G2 ? DS[0][st.p]
            : fa === fb ? "No change: g² fixes exactly the same points as g (" + nm[fa] + ")."
            : "Fewer conditions, so more fixed points: the fixed set grows from " + (fa === 0 ? "nothing" : nm[fa]) + " to " + nm[fb] + ".";
        }
      }
      var a = fixedSet().length, bx = betti(3), bf = betti(a), name = a === 0 ? "∅" : "S" + ["", "⁰", "¹", "²"][a];
      var X = sec.querySelector(".js-HX"), F = sec.querySelector(".js-HF");
      var cells = function (b) { return b.map(function (n, d) { return "<span class='hc'><i>H" + sub[d] + "</i> " + FS(n) + "</span>"; }).join(""); };
      if (X) X.innerHTML = "<span class='nm'>X = S²</span>" + cells(bx);
      if (F) F.innerHTML = "<span class='nm'>X<sup>" + (st.sub === "g" ? "G" : "H") + "</sup> = " + name + "</span>" + cells(bf);
      var sm = sec.querySelector(".js-smith");
            if (sm) sm.textContent = a === 0 ? "The fixed set is ∅, which counts as a sphere of dimension −1." : a === 3 ? "Here g² is the identity, so every point is fixed and the fixed set is S² itself." : "The fixed set is again a sphere: dimension " + (a - 1) + " instead of 2.";
      me.dirty = true;
    }
    function go() { if (st.anim) return; var n = st.sub === "g" ? 1 : 2; st.anim = { from: st.t, to: st.t + n, t0: performance.now(), dur: 1200 * n }; }
    sec.querySelectorAll(".js-sub button").forEach(function (b) { b.addEventListener("click", function () { st.sub = b.dataset.v; touched = true; if (auto) { st.t = 0; st.anim = null; } ui(); if (auto) go(); }); });
    var ap = sec.querySelector(".js-apply"); if (ap) ap.addEventListener("click", go);
    var rs = sec.querySelector(".js-reset"); if (rs) rs.addEventListener("click", function () { st.t = 0; st.anim = null; me.dirty = true; });
    me.cv = cv; me.render = render;
    me.step = function (n) {
      var prev = step; step = n;
      if (view === "fix" && auto) {
        touched = false; st.t = 0; st.anim = null;
        if (n >= 4) { st.p = Math.min(1, n - 4); st.sub = "g2"; } else { st.p = n >= 1 && n <= 2 ? n - 1 : 0; st.sub = "g"; }
        ui(); if (n >= 1 && n !== 3) go(); return;
      }
      if (view === "act") { var pa = Math.min(1, Math.max(0, n - 1)); if (pa !== st.p || n !== prev) { st.p = pa; st.t = 0; st.anim = null; } ui(); if (n >= 1 && n !== prev) go(); return; }
      if (view === "smith") {
        var ps = n >= 4 ? Math.floor((n - 4) / 2) : 1, ss = n >= 4 && (n - 4) % 2 === 1 ? "g2" : "g";
        if (ps !== st.p || ss !== st.sub || n !== prev) { st.p = ps; st.sub = ss; st.t = 0; st.anim = null; }
        ui(); if (n >= 4 && n !== prev) go(); return;
      }
      ui();
    };
    me.tick = function (now) { if (st.anim) { var u = (now - st.anim.t0) / st.anim.dur; if (u >= 1) { st.t = st.anim.to % 4; st.anim = null; } else st.t = st.anim.from + (st.anim.to - st.anim.from) * ease(Math.max(0, u)); return true; } return false; };
    L.drag(cv, cam, function () { me.dirty = true; });
    ui(); return me;
  };


  /* ---------- groups: C4 as rotations of a square ---------- */
  SC.square = function (sec, cv) {
    var me = {}, ang = 0, anim = null, gk = 0, step = 0;
    function render(ctx, C) {
      var cx = W * 0.71, cy = H * 0.56, s = 190, R = 330;
      ctx.setLineDash([6, 16]); ctx.lineWidth = 3; ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = C.sphere; ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.fillRect(-s, -s, 2 * s, 2 * s); ctx.strokeRect(-s, -s, 2 * s, 2 * s);
      [[-s, -s, "1", C.rot], [s, -s, "2", C.muted], [s, s, "3", C.muted], [-s, s, "4", C.muted]].forEach(function (c) {
        ctx.fillStyle = c[3]; ctx.beginPath(); ctx.arc(c[0], c[1], 30, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "600 30px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(c[2], c[0], c[1] + 2);
      });
      ctx.restore();
    }
    function ui() {
      var j = ((gk % 4) + 4) % 4, ro = sec.querySelector(".js-ro"); if (ro) ro.innerHTML = "<b>" + ["1", "g", "g²", "g³"][j] + "</b> = " + ["no turn", "quarter turn", "half turn", "three-quarter turn"][j];
      sec.querySelectorAll(".js-g").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.k === j)); });
    }
    function go(n) { if (anim) return; anim = { from: ang, to: ang + n * PI / 2, t0: performance.now(), dur: 700 * Math.max(1, n) }; gk += n; ui(); }
    sec.querySelectorAll(".js-g").forEach(function (b) { b.addEventListener("click", function () { var j = ((gk % 4) + 4) % 4; go((+b.dataset.k - j + 4) % 4 || 0); }); });
    var ap = sec.querySelector(".js-apply"); if (ap) ap.addEventListener("click", function () { go(1); });
    me.cv = cv; me.render = render;
    me.step = function (n) { var prev = step; step = n; if (n > prev && n === 1) go(1); };
    me.tick = function (now) { if (anim) { var u = (now - anim.t0) / anim.dur; if (u >= 1) { ang = anim.to; anim = null; } else ang = anim.from + (anim.to - anim.from) * ease(Math.max(0, u)); return true; } return false; };
    ui(); return me;
  };

  /* ---------- group action on a circle ---------- */
  SC.circleAct = function (sec, cv) {
    var me = {}, step = 0, st = { p: 0, t: 0, anim: null }, th0 = 0.62;
    var ACTS = [
      { lab: "Quarter turns", map: function (th, t) { return [Math.cos(th + t * PI / 2), Math.sin(th + t * PI / 2)]; } },
      { lab: "Reflection", map: function (th, t) { return [Math.cos(th), Math.sin(th) * Math.cos(PI * t)]; } }
    ];
    function render(ctx, C) {
      var cx = W * 0.7, cy = H * 0.61, R = 255, A = ACTS[st.p], P = function (v) { return [cx + R * v[0], cy - R * v[1]]; }, i;
      ctx.lineWidth = 7; ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      for (i = 0; i < 36; i++) { var p = P(A.map(i * TAU / 36, st.t)); ctx.fillStyle = C.muted; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (step >= 1) {
        var seen = [], names = ["1", "g", "g²", "g³"];
        for (i = 0; i < 4; i++) { var q = A.map(th0, i), hit = seen.filter(function (s) { return Math.hypot(s.q[0] - q[0], s.q[1] - q[1]) < 1e-6; })[0]; if (hit) hit.n.push(names[i]); else seen.push({ q: q, n: [names[i]] }); }
        seen.forEach(function (s) { var p = P(s.q); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.fillStyle = C.panel; ctx.beginPath(); ctx.arc(p[0], p[1], 20, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.ink; ctx.font = "500 30px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; var lp = [cx + (p[0] - cx) * 1.2, cy + (p[1] - cy) * 1.2]; ctx.fillText(s.n.join(", "), lp[0], lp[1]); });
      }
      var pp = P(A.map(th0, st.t)); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(pp[0], pp[1], 14, 0, TAU); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.panel; ctx.stroke();
    }
    function ui() {
      var chips = sec.querySelector(".js-chips"); if (!chips) return; chips.innerHTML = "";
      ACTS.forEach(function (a, i) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = a.lab; b.setAttribute("aria-pressed", String(i === st.p)); b.onclick = function () { st.p = i; st.t = 0; st.anim = null; ui(); go(); me.dirty = true; }; chips.appendChild(b); });
      me.dirty = true;
    }
    function go() { if (st.anim) return; st.anim = { from: st.t, to: st.t + 1, t0: performance.now(), dur: 1000 }; }
    var ap = sec.querySelector(".js-apply"); if (ap) ap.addEventListener("click", go);
    var rs = sec.querySelector(".js-reset"); if (rs) rs.addEventListener("click", function () { st.t = 0; st.anim = null; me.dirty = true; });
    me.cv = cv; me.render = render;
    me.step = function (n) { var prev = step; step = n; var p = n >= 3 ? 1 : 0; if (p !== st.p) { st.p = p; st.t = 0; st.anim = null; ui(); } if (n > prev && (n === 2 || n === 3)) go(); me.dirty = true; };
    me.tick = function (now) { if (st.anim) { var u = (now - st.anim.t0) / st.anim.dur; if (u >= 1) { st.t = st.anim.to % 4; st.anim = null; } else st.t = st.anim.from + (st.anim.to - st.anim.from) * ease(Math.max(0, u)); return true; } return false; };
    ui(); return me;
  };


  /* ---------- Smith for acyclic spaces: C4 acting on a disk ---------- */
  SC.diskAct = function (sec, cv) {
    var me = {}, step = 0, st = { p: 0, t: 0, anim: null };
    var ACTS = [
      { lab: "Quarter turn", fix: "pt", name: "a single point, the center", map: function (v, t) { var c = Math.cos(t * PI / 2), s = Math.sin(t * PI / 2); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; } },
      { lab: "Reflection", fix: "seg", name: "a segment, a diameter", map: function (v, t) { return [v[0], v[1] * Math.cos(PI * t)]; } }
    ];
    var dots = []; (function () { for (var k = 0; k < 3; k++) { var n = 7 + 3 * k, r = 0.35 + 0.27 * k; for (var i = 0; i < n; i++) dots.push([r * Math.cos(i * TAU / n + k * 0.4), r * Math.sin(i * TAU / n + k * 0.4)]); } })();
    var flag = [0.62, 0.28];
    function render(ctx, C) {
      var cx = W * 0.72, cy = H * 0.62, R = 255, A = ACTS[st.p], P = function (v) { return [cx + R * v[0], cy - R * v[1]]; }, i;
      ctx.fillStyle = C.sphere; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.rule; ctx.lineWidth = 3;
      [0.33, 0.66].forEach(function (rr) { ctx.beginPath(); ctx.arc(cx, cy, R * rr, 0, TAU); ctx.stroke(); });
      for (i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(i * PI / 4), cy - R * Math.sin(i * PI / 4)); ctx.stroke(); }
      ctx.strokeStyle = C.muted; ctx.lineWidth = 6; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      if (step >= 1) {
        ctx.strokeStyle = C.triv; ctx.fillStyle = C.triv;
        if (A.fix === "pt") { ctx.beginPath(); ctx.arc(cx, cy, 20, 0, TAU); ctx.fill(); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.stroke(); }
        else { ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); }
      }
      dots.forEach(function (d, k) { var p = P(A.map(d, st.t)); ctx.fillStyle = k % 2 ? C.muted : C.ink; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1; var fp = P(A.map(flag, st.t)); ctx.fillStyle = C.rot; ctx.beginPath(); ctx.arc(fp[0], fp[1], 15, 0, TAU); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.panel; ctx.stroke();
    }
    function ui() {
      var chips = sec.querySelector(".js-chips"); if (chips) { chips.innerHTML = ""; ACTS.forEach(function (a, i) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = a.lab; b.setAttribute("aria-pressed", String(i === st.p)); b.onclick = function () { st.p = i; st.t = 0; st.anim = null; ui(); go(); }; chips.appendChild(b); }); }
      var nm = sec.querySelector(".js-fixname"); if (nm) nm.textContent = ACTS[st.p].name;
      me.dirty = true;
    }
    function go() { if (st.anim) return; st.anim = { from: st.t, to: st.t + 1, t0: performance.now(), dur: 1100 }; }
    var ap = sec.querySelector(".js-apply"); if (ap) ap.addEventListener("click", go);
    var rs = sec.querySelector(".js-reset"); if (rs) rs.addEventListener("click", function () { st.t = 0; st.anim = null; me.dirty = true; });
    me.cv = cv; me.render = render;
    me.step = function (n) { var prev = step; step = n; var p = n >= 4 ? 1 : 0; if (p !== st.p) { st.p = p; st.t = 0; st.anim = null; ui(); } if (n > prev && (n === 3 || n === 4)) go(); me.dirty = true; };
    me.tick = function (now) { if (st.anim) { var u = (now - st.anim.t0) / st.anim.dur; if (u >= 1) { st.t = st.anim.to % 4; st.anim = null; } else st.t = st.anim.from + (st.anim.to - st.anim.from) * ease(Math.max(0, u)); return true; } return false; };
    ui(); return me;
  };


  /* ---------- backup: the bridges of Königsberg ---------- */
  SC.bridges = function (sec, cv) {
    var me = {}, step = 0, g = 0, gT = 0;
    // land masses: map rectangle (cx, cy, w, h) and graph node (same centre, small disc)
    var LAND = [
      { n: "A", cx: 410, cy: 290, w: 580, h: 120 },
      { n: "B", cx: 410, cy: 600, w: 300, h: 170 },
      { n: "C", cx: 410, cy: 920, w: 580, h: 120 },
      { n: "D", cx: 845, cy: 600, w: 170, h: 360 }
    ];
    // bridges: land indices, map anchor points, and the bow of the curve in graph form
    var BR = [
      { a: 0, b: 1, p: [330, 350], q: [350, 518], bow: -70 },
      { a: 0, b: 1, p: [490, 350], q: [470, 518], bow: 70 },
      { a: 1, b: 2, p: [350, 682], q: [330, 860], bow: -70 },
      { a: 1, b: 2, p: [470, 682], q: [490, 860], bow: 70 },
      { a: 0, b: 3, p: [700, 300], q: [760, 460], bow: 0 },
      { a: 1, b: 3, p: [560, 600], q: [760, 600], bow: 0 },
      { a: 2, b: 3, p: [700, 910], q: [760, 740], bow: 0 }
    ];
    var DEG = [0, 0, 0, 0]; BR.forEach(function (b) { DEG[b.a]++; DEG[b.b]++; });
    var st = { pos: null, used: [], hover: -1 };
    var lerp = function (a, b, t) { return a + (b - a) * t; };
    function curveAt(b, t) {
      var A = LAND[b.a], B = LAND[b.b], p0 = [lerp(b.p[0], A.cx, g), lerp(b.p[1], A.cy, g)], p1 = [lerp(b.q[0], B.cx, g), lerp(b.q[1], B.cy, g)];
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1, ox = -dy / l * b.bow * g * 2, oy = dx / l * b.bow * g * 2;
      var c = [(p0[0] + p1[0]) / 2 + ox, (p0[1] + p1[1]) / 2 + oy], u = 1 - t;
      return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
    }
    function rect(l) { var w = lerp(l.w, 74, g), h = lerp(l.h, 74, g); return { x: l.cx - w / 2, y: l.cy - h / 2, w: w, h: h, r: lerp(26, 37, g) }; }
    function rr(ctx, R) { ctx.beginPath(); ctx.moveTo(R.x + R.r, R.y); ctx.arcTo(R.x + R.w, R.y, R.x + R.w, R.y + R.h, R.r); ctx.arcTo(R.x + R.w, R.y + R.h, R.x, R.y + R.h, R.r); ctx.arcTo(R.x, R.y + R.h, R.x, R.y, R.r); ctx.arcTo(R.x, R.y, R.x + R.w, R.y, R.r); ctx.closePath(); }
    function render(ctx, C) {
      ctx.save();
      if (g < 1) { ctx.globalAlpha = 1 - g; ctx.fillStyle = C.triv; ctx.globalAlpha = 0.13 * (1 - g); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(70, 200, 920, 820, 40) : ctx.rect(70, 200, 920, 820); ctx.fill(); ctx.globalAlpha = 1; }
      BR.forEach(function (b, i) {
        var used = st.used.indexOf(i) >= 0, ok = st.pos !== null && !used && (b.a === st.pos || b.b === st.pos), pts = [], k;
        for (k = 0; k <= 24; k++) pts.push(curveAt(b, k / 24));
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        var w = lerp(22, 9, g);
        if (g < 1) { ctx.globalAlpha = 1 - g; ctx.strokeStyle = C.ink; ctx.lineWidth = w + 6; ctx.beginPath(); pts.forEach(function (q, m) { if (m) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.strokeStyle = used ? C.rot : (ok || st.hover === i) ? C.sign : (g > 0.5 ? C.ink : C.sign); ctx.globalAlpha = used || ok || st.hover === i ? 1 : (g > 0.5 ? 0.75 : 0.85);
        ctx.lineWidth = used ? w + 4 : w; ctx.beginPath(); pts.forEach(function (q, m) { if (m) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.globalAlpha = 1;
      });
      LAND.forEach(function (l, i) {
        var R = rect(l); rr(ctx, R); ctx.fillStyle = C.sphere; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = st.pos === i ? C.rot : C.rule; if (st.pos === i) ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = C.ink; ctx.font = "600 " + Math.round(lerp(40, 34, g)) + "px 'STIX Two Text', serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(l.n, l.cx, l.cy + 2);
        if (step >= 2 && g > 0.9) {
          var odd = DEG[i] % 2 === 1, off = [[-52, -52], [-84, 0], [-52, 52], [58, -58]][i], bx = l.cx + off[0], by = l.cy + off[1];
          ctx.beginPath(); ctx.arc(bx, by, 26, 0, TAU); ctx.fillStyle = odd ? C.mix : C.triv; ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "600 32px 'JetBrains Mono', monospace"; ctx.fillText(String(DEG[i]), bx, by + 2);
        }
      });
      ctx.restore();
    }
    function text() {
      var t = sec.querySelector(".js-btext"); if (!t) return;
      var s = [
        "<p><b class='rt'>Königsberg, 1736.</b> Seven bridges join four parts of the city across the river Pregel. Can you take a walk that crosses every bridge exactly once?</p>",
        "<p><b class='rt'>Euler's idea:</b> forget the shape of the map. Only which bridges join which land masses matters. The map becomes a <b>graph</b>.</p>",
        "<p>Count the bridges at each land mass, its <b>degree</b>: <b class='mx'>3, 5, 3, 3</b>. All four are odd.</p>",
        "<p>Each land mass you pass through uses bridges in pairs: one to arrive, one to leave. So only the start and end of a walk can have odd degree.</p><div class='thm' style='margin-top:12px'><span class='name'>Euler, 1736</span>Four odd land masses, so <b>no such walk exists</b>.</div><p class='small' style='margin-top:10px'>Often called the first theorem of graph theory: the “geometry of position”.</p>"
      ];
      t.innerHTML = s[Math.min(step, 3)];
    }
    function status() {
      var el = sec.querySelector(".js-bst"); if (!el) return;
      var n = st.used.length, msg;
      if (st.pos === null) msg = "A walk can start at any land mass.";
      else {
        var stuck = n < 7 && !BR.some(function (b, i) { return st.used.indexOf(i) < 0 && (b.a === st.pos || b.b === st.pos); });
        msg = n === 7 ? "<b>All seven crossed!</b>" : stuck ? "<b>Stuck at " + LAND[st.pos].n + ".</b> Every bridge here is used, and only " + n + " of 7 have been crossed." : "At " + LAND[st.pos].n + ". " + n + " of 7 bridges crossed.";
      }
      el.innerHTML = msg;
    }
    function hit(ev) {
      var rc = cv.getBoundingClientRect(), k = W / rc.width, x = (ev.clientX - rc.left) * k, y = (ev.clientY - rc.top) * k, bi = -1, bd = 34;
      BR.forEach(function (b, i) { for (var m = 0; m <= 24; m++) { var q = curveAt(b, m / 24), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; bi = i; } } });
      if (bi >= 0) return { b: bi };
      for (var i = 0; i < LAND.length; i++) { var R = rect(LAND[i]); if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h) return { l: i }; }
      return null;
    }
    var down = null;
    cv.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener("pointerup", function (e) {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; } down = null;
      var h = hit(e); if (!h) return;
      if (h.l !== undefined) { if (st.used.length === 0) st.pos = h.l; }
      else if (st.pos !== null && st.used.indexOf(h.b) < 0) { var b = BR[h.b]; if (b.a === st.pos) { st.pos = b.b; st.used.push(h.b); } else if (b.b === st.pos) { st.pos = b.a; st.used.push(h.b); } }
      status(); me.dirty = true;
    });
    cv.addEventListener("pointermove", function (e) { var h = hit(e), i = h && h.b !== undefined ? h.b : -1; if (i !== st.hover) { st.hover = i; me.dirty = true; } });
    var rs = sec.querySelector(".js-reset"); if (rs) rs.addEventListener("click", function () { st.pos = null; st.used = []; status(); me.dirty = true; });
    me.cv = cv; me.render = render;
    me.step = function (n) { step = n; gT = n >= 1 ? 1 : 0; if (L.reduced) g = gT; text(); me.dirty = true; };
    me.tick = function () { if (Math.abs(g - gT) > 0.002) { g += (gT - g) * 0.12; if (Math.abs(g - gT) <= 0.002) g = gT; return true; } return false; };
    text(); status(); return me;
  };

  /* ---------- backup: real projective space as lines through the origin ---------- */
  SC.rp = function (sec, cv) {
    var me = {}, step = 0, cam = newCam({ yaw: 0.5, pitch: 0.35, cx: W * 0.31, cy: H * 0.58, S: 330 }), tt = 0, auto = true;
    var TXT = [
      "<p>$\\mathbb{RP}^n$ is the space of <b>lines through the origin</b> in $\\mathbb R^{n+1}$.</p><p class='small' style='margin-top:10px'>Here $n=2$.</p>",
      "<p>Each line meets the unit sphere in two <b>antipodal</b> points, $v$ and $-v$.</p><p style='margin-top:10px'>So $\\mathbb{RP}^2$ is the sphere with $v$ identified with $-v$.</p>",
      "<p><b class='tv'>Cells.</b> The lines in a plane form $\\mathbb{RP}^1$, a circle. What is left is one open 2-cell.</p><p style='margin-top:10px'>One point, one 1-cell, one 2-cell: one cell in each dimension up to $n$.</p>",
      "<p><b class='rt'>Cohomology.</b></p><p>$H^*(\\mathbb{RP}^n)=\\mathbb F_2[x]/(x^{n+1})$ with $|x|=1$.</p><p style='margin-top:10px'>One class in each degree $0,\\dots,n$.</p>"
    ];
    var fib = []; for (var i = 0; i < 150; i++) { var z = 1 - 2 * (i + 0.5) / 150, r = Math.sqrt(1 - z * z), ph = i * 2.39996; fib.push([r * Math.cos(ph), r * Math.sin(ph), z]); }
    var w3 = function (v) { return [v[0], v[2], v[1]]; };
    function vec() { var a = tt, b = 0.6 * Math.sin(tt * 0.7) + 0.2; return [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)]; }
    function render(ctx, C) {
      var S = cam.S, P = function (v) { return L.proj(w3(v), cam); };
      var g = ctx.createRadialGradient(cam.cx - S * 0.3, cam.cy - S * 0.3, S * 0.1, cam.cx, cam.cy, S);
      g.addColorStop(0, C.panel); g.addColorStop(1, C.sphere); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.cx, cam.cy, S, 0, TAU); ctx.fill();
      [-0.5, 0.5].forEach(function (zc) { var rr = Math.sqrt(1 - zc * zc); L.poly(curve(function (t) { var a = t * TAU; return [rr * Math.cos(a), rr * Math.sin(a), zc]; }, 72).map(P), C.rule, 1.2, 0.9); });
      if (step >= 2) { L.poly(curve(function (t) { var a = t * TAU; return [Math.cos(a), Math.sin(a), 0]; }, 96).map(P), C.triv, 10, 0.95); L.label(P([1.28, 0, 0]), "RP¹", C.triv, 26); }
      else L.poly(curve(function (t) { var a = t * TAU; return [Math.cos(a), Math.sin(a), 0]; }, 96).map(P), C.rule, 2, 0.9);
      fib.forEach(function (v0) { L.dot(P(v0), C.muted, 3.4, 0.5); });
      var v = vec(), nv = v.map(function (x) { return -x; });
      L.seg(P(v.map(function (x) { return x * 1.35; })), P(nv.map(function (x) { return x * 1.35; })), C.ink, 5, 1);
      L.dot(P(v), C.rot, 16, 1, C.panel); L.dot(P(nv), C.rot, 16, 1, C.panel);
      if (step >= 1) { L.label(P(v.map(function (x) { return x * 1.18; })), "v", C.rot, 30); L.label(P(nv.map(function (x) { return x * 1.18; })), "−v", C.rot, 30); }
      L.flush(ctx, DPR);
    }
    function text() { var t = sec.querySelector(".js-rtext"); if (!t) return; t.innerHTML = TXT[Math.min(step, 3)]; if (window.renderMathInElement) renderMathInElement(t, { delimiters: [{ left: "$", right: "$", display: false }], throwOnError: false }); }
    me.cv = cv; me.render = render;
    me.step = function (n) { step = n; text(); me.dirty = true; };
    me.tick = function () { if (auto) { tt += 0.012; return true; } return false; };
    L.drag(cv, cam, function () { me.dirty = true; });
    text(); return me;
  };

  /* ---------- backup: the Atiyah-Hirzebruch spectral sequence for K(n)*(RP^m), as a grid with diagonal differentials ---------- */
  SC.sseq = function (sec, cv) {
    var me = {}, step = 0, st = { n: 1, r: 2, play: false, last: 0 }, fade = {};
    var MS = { 1: 6, 2: 10, 3: 16 }, SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹", SUB = "₀₁₂₃₄₅₆₇₈₉";
    var sup = function (k) { var s = String(Math.abs(k)).split("").map(function (c) { return SUP[+c]; }).join(""); return (k < 0 ? "⁻" : "") + s; };
    var Q = function () { return Math.pow(2, st.n + 1) - 1; }, V = function () { return Q() - 1; }, RMAX = function () { return Q() + 3; }, MAXS = function () { return MS[st.n]; };
    // Q_n x^s = s x^(s+Q): odd s with s + Q <= m is a source, and s + Q is its target
    function role(s) { var q = Q(); if (s % 2 === 1 && s + q <= MAXS()) return "src"; if (s >= q && (s - q) % 2 === 1) return "tgt"; return "stay"; }
    function dead(s, r) { return r > Q() && role(s) !== "stay"; }
    function surv(r) { var c = 0; for (var s = 0; s <= MAXS(); s++) if (!dead(s, r)) c++; return c; }
    function geom() { var cols = MAXS() + 1, sp = Math.min(200, 1500 / (cols - 1)), tot = sp * (cols - 1), x0 = 270 + (1500 - tot) / 2; return { sp: sp, x0: x0, X: function (s) { return x0 + s * sp; }, Y: function (rk) { return 520 + rk * 100; } }; }
    function label(rk, s) { var k = rk - 2, vn = "v" + SUB[st.n], p = k === 0 ? "" : vn + (k === 1 ? "" : sup(k)), a = s === 0 ? (k === 0 ? "1" : "") : "α" + (s > 1 ? sup(s) : ""); return p + a; }
    function render(ctx, C) {
      var G = geom(), r = st.r, infty = r === RMAX(), q = Q(), v = V(), s, rk;
      ctx.textBaseline = "middle"; ctx.lineCap = "round";
      // axes
      ctx.strokeStyle = C.rule; ctx.lineWidth = 3; ctx.strokeRect(G.x0 - 60, G.Y(0) - 58, G.sp * MAXS() + 120, 100 * 4 + 116);
      ctx.fillStyle = C.muted; ctx.font = "500 30px 'JetBrains Mono', monospace"; ctx.textAlign = "right";
      for (rk = 0; rk < 5; rk++) ctx.fillText(String(-(rk - 2) * v), G.x0 - 78, G.Y(rk));
      ctx.textAlign = "center"; for (s = 0; s <= MAXS(); s++) ctx.fillText(String(s), G.X(s), G.Y(4) + 82);
      ctx.font = "500 30px 'Instrument Sans', sans-serif"; ctx.fillText("s: degree in H*(RP" + sup(MAXS()) + ")", G.x0 + G.sp * MAXS() / 2, G.Y(4) + 120);
      ctx.textAlign = "right"; ctx.fillText("t", G.x0 - 78, G.Y(0) - 80);
      // arrows
      if (!infty && r === q) {
        for (s = 0; s <= MAXS(); s++) if (role(s) === "src") for (rk = 0; rk < 4; rk++) arrow(ctx, G.X(s), G.Y(rk), G.X(s + q), G.Y(rk + 1), C.sign, 5, 1);
      } else if (!infty && r <= MAXS() && (r - 1) / v <= 4) {
        arrow(ctx, G.X(0), G.Y(0), G.X(r), G.Y(0) + (r - 1) / v * 100, C.muted, 3, 0.55, true);
      }
      // dots
      for (rk = 0; rk < 5; rk++) for (s = 0; s <= MAXS(); s++) {
        var key = s, d = dead(s, r), tg = d ? 0 : 1; if (fade[key] === undefined) fade[key] = 1; if (rk === 0) fade[key] += (tg - fade[key]) * 0.16;
        var hot = !infty && r === q && role(s) !== "stay", rad = G.sp > 120 ? 15 : 12;
        ctx.globalAlpha = 0.14 + 0.86 * fade[key]; ctx.beginPath(); ctx.arc(G.X(s), G.Y(rk), rad, 0, TAU); ctx.fillStyle = hot ? C.sign : (infty && !d ? C.triv : C.rot); ctx.fill(); ctx.globalAlpha = 1;
        if (d) { ctx.setLineDash([5, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = C.muted; ctx.beginPath(); ctx.arc(G.X(s), G.Y(rk), rad, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        if (G.sp >= 150 && st.n === 1) { ctx.globalAlpha = 0.25 + 0.75 * fade[key]; ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.font = "500 27px 'STIX Two Text', serif"; ctx.fillText(label(rk, s), G.X(s), G.Y(rk) + 36); ctx.globalAlpha = 1; }
      }
      ctx.fillStyle = C.muted; ctx.font = "600 34px 'STIX Two Text', serif"; ctx.textAlign = "center"; ctx.fillText("⋮", G.x0 - 36, G.Y(0) - 36); ctx.fillText("⋮", G.x0 - 36, G.Y(4) + 36);
    }
    function arrow(ctx, x0, y0, x1, y1, col, w, al, dashed) {
      var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, ax = x0 + ux * 20, ay = y0 + uy * 20, bx = x1 - ux * 22, by = y1 - uy * 22;
      ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; if (dashed) ctx.setLineDash([10, 9]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(bx + ux * 12, by + uy * 12); ctx.lineTo(bx - uy * 8, by + ux * 8); ctx.lineTo(bx + uy * 8, by - ux * 8); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    function ui() {
      var q = Q(), r = st.r, infty = r === RMAX(), el = sec.querySelector(".js-sstext"), pg = sec.querySelector(".js-sspage"), rg = sec.querySelector(".js-ssrange"), pb = sec.querySelector(".js-ssplay"), n = st.n, m = MAXS();
      if (rg) { rg.min = 2; rg.max = RMAX(); rg.value = r; }
      if (pg) pg.innerHTML = infty ? "E<sub>∞</sub>" : "E<sub>" + r + "</sub>";
      if (pb) pb.textContent = st.play ? "Pause" : (infty ? "Replay" : "Play");
      sec.querySelectorAll(".js-sschips button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.n === n)); });
      var d = "d<sub>" + r + "</sub>", X = "RP<sup>" + m + "</sup>", html, k = surv(infty ? 999 : r);
      if (infty) html = "<b class='tv'>E<sub>∞</sub>:</b> " + k + " classes survive in each row, the Margolis homology of Q<sub>" + n + "</sub>. So k<sub>" + n + "</sub>(" + X + ") ≤ " + k + ".";
      else if (r < q) html = "<b>" + d + " = 0.</b> A differential drops " + (r - 1) + " in t, but rows are " + V() + " apart: nothing can happen before <b>d<sub>" + q + "</sub></b>.";
      else if (r === q) html = "<b class='sg'>" + d + " = Q<sub>" + n + "</sub>·v<sub>" + n + "</sub>.</b> Its degree is |Q<sub>" + n + "</sub>| = 2<sup>" + (n + 1) + "</sup> − 1 = " + q + ": each odd class x<sup>s</sup> goes to s·x<sup>s+" + q + "</sup> one row down.";
      else html = "<b>" + d + " = 0.</b> Every remaining class already survives, so the pages do not change from here on.";
      if (el) el.innerHTML = html;
      me.dirty = true;
    }
    var chips = sec.querySelector(".js-sschips");
    if (chips) [1, 2, 3].forEach(function (n) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.n = n; b.innerHTML = "K(" + n + ") on RP<sup>" + MS[n] + "</sup> · |Q<sub>" + n + "</sub>| = " + (Math.pow(2, n + 1) - 1); b.onclick = function () { st.n = n; st.r = 2; st.play = true; st.last = performance.now(); fade = {}; ui(); }; chips.appendChild(b); });
    var rg0 = sec.querySelector(".js-ssrange"); if (rg0) rg0.addEventListener("input", function () { st.r = +rg0.value; st.play = false; ui(); });
    var pb0 = sec.querySelector(".js-ssplay"); if (pb0) pb0.addEventListener("click", function () { if (st.r === RMAX()) { st.r = 2; st.play = true; } else st.play = !st.play; st.last = performance.now(); ui(); });
    me.cv = cv; me.render = render;
    me.pdf = function (a) { var parts = String(a).split(":"), r0 = parts[parts.length - 1]; if (parts.length === 2 && +parts[0] !== st.n) { st.n = +parts[0]; fade = {}; } st.play = false; st.r = r0 === "end" ? RMAX() : +r0; ui(); };
    me.step = function (n) { var prev = step; step = n; if (n >= 1 && n !== prev) { st.n = Math.min(3, n); fade = {}; st.r = 2; st.play = !L.reduced; st.last = performance.now(); } else if (n < 1) { st.n = 1; fade = {}; st.r = 2; st.play = false; } ui(); };
    me.tick = function (now) {
      var moved = false, s;
      for (s = 0; s <= MAXS(); s++) { var tg = dead(s, st.r) ? 0 : 1; if (fade[s] !== undefined && Math.abs(fade[s] - tg) > 0.01) moved = true; }
      if (st.play && now - st.last > (st.r === Q() - 1 ? 1300 : 750)) { st.last = now; if (st.r < RMAX()) st.r++; else st.play = false; ui(); moved = true; }
      return moved;
    };
    ui(); return me;
  };

  /* ---------- the ladder of invariants: k_0, k_1, ..., k_infinity for a few spaces ---------- */
  SC.bars = function (sec, cv) {
    var SP = {
      s2: { lab: "S²", k: [2, 2, 2], d: "A sphere has no torsion, so every height agrees." },
      t2: { lab: "Torus", k: [4, 4, 4], d: "The torus has no torsion either: every height sees all four classes." },
      rp2: { lab: "RP²", k: [1, 3, 3], d: "Rationally RP² looks like a point. K(1) and mod 2 homology see all three classes." },
      rp4: { lab: "RP⁴", k: [1, 3, 5], d: "Rationally RP⁴ looks like a point. K(1) sees three classes. Mod 2 homology sees all five." }
    };
    var order = ["s2", "t2", "rp2", "rp4"], me = {}, step = 0, cur = "s2", shown = [0, 0, 0], target = [0, 0, 0];
    var cols = [{ t: "K(0)", s: "rational homology" }, { t: "K(1)", s: "K-theory of vector bundles" }, { t: "K(∞)", s: "mod 2 homology" }];
    function render(ctx, C) {
      var base = H * 0.82, x0 = W * 0.1, gap = 470, bw = 190, unit = 98, S = SP[cur], i;
      ctx.lineCap = "round"; ctx.textAlign = "center";
      ctx.strokeStyle = C.rule; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 40, base); ctx.lineTo(x0 + gap * 2 + bw + 160, base); ctx.stroke();
      // dashed band for n = 2, 3, ...
      var bx = x0 + gap + bw + 20, bx2 = x0 + gap * 2 - 20;
      ctx.setLineDash([8, 12]); ctx.strokeStyle = C.muted; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, base - 60); ctx.lineTo(bx2, base - 60); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.muted; ctx.font = "500 26px 'Instrument Sans', sans-serif"; ctx.fillText("K(2), K(3), …", (bx + bx2) / 2, base - 84); ctx.fillText("in between", (bx + bx2) / 2, base - 34);
      for (i = 0; i < 3; i++) {
        var x = x0 + gap * i, h = shown[i] * unit, hot = i === 0 ? C.triv : i === 1 ? C.rot : C.sign;
        ctx.fillStyle = hot; ctx.globalAlpha = target[i] ? 1 : 0.15; ctx.beginPath(); ctx.roundRect(x, base - h, bw, Math.max(h, 2), 8); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink; ctx.font = "600 44px 'JetBrains Mono', monospace"; if (target[i]) ctx.fillText(String(S.k[i]), x + bw / 2, base - h - 26);
        ctx.font = "600 34px 'STIX Two Text', serif"; ctx.fillText(cols[i].t, x + bw / 2, base + 46);
        ctx.fillStyle = C.muted; ctx.font = "500 24px 'Instrument Sans', sans-serif"; ctx.fillText(cols[i].s, x + bw / 2, base + 80);
      }
    }
    function ui() {
      var chips = sec.querySelector(".js-chips"); if (chips) { chips.innerHTML = ""; order.forEach(function (k) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = SP[k].lab; b.setAttribute("aria-pressed", String(k === cur)); b.onclick = function () { cur = k; ui(); }; chips.appendChild(b); }); }
      var d = sec.querySelector(".js-desc"); if (d) d.textContent = SP[cur].d;
      me.dirty = true;
    }
    me.cv = cv; me.render = render;
    me.step = function (n) { step = n; target = [n >= 1 ? 1 : 0, n >= 2 ? 1 : 0, n >= 3 ? 1 : 0]; var want = n <= 3 ? "s2" : order[Math.min(3, n - 3)]; if (want !== cur) { cur = want; ui(); } me.dirty = true; };
    me.tick = function () {
      var moved = false, S = SP[cur];
      for (var i = 0; i < 3; i++) { var t = target[i] ? S.k[i] : 0; if (Math.abs(shown[i] - t) > 0.02) { shown[i] += (t - shown[i]) * 0.14; moved = true; } else if (shown[i] !== t) { shown[i] = t; moved = true; } }
      return moved;
    };
    ui(); return me;
  };


  /* ---------- aviation: an aircraft in a holding pattern, and what its radar track looks like ---------- */
  SC.holding = function (sec, cv) {
    var mode = sec.dataset.mode || "fly", me = {}, step = 0;
    var xf = 1620, y0 = 420, Lg = 400, R = 150, ax = 1000, segs = [], total = 0;
    function line(x1, y1, x2, y2) { segs.push({ t: "l", x1: x1, y1: y1, x2: x2, y2: y2, len: Math.hypot(x2 - x1, y2 - y1) }); }
    function arc(cx, cy, a0, a1) { segs.push({ t: "a", cx: cx, cy: cy, a0: a0, a1: a1, len: R * Math.abs(a1 - a0) }); }
    line(ax, y0, xf - Lg, y0); line(xf - Lg, y0, xf, y0);
    for (var k = 0; k < 3; k++) { arc(xf, y0 + R, -PI / 2, PI / 2); line(xf, y0 + 2 * R, xf - Lg, y0 + 2 * R); arc(xf - Lg, y0 + R, PI / 2, 3 * PI / 2); line(xf - Lg, y0, xf, y0); }
    line(xf, y0, xf + 280, y0);
    segs.forEach(function (g) { total += g.len; });
    function at(s) {
      s = Math.max(0, Math.min(total, s));
      for (var i = 0; i < segs.length; i++) {
        var g = segs[i];
        if (s <= g.len || i === segs.length - 1) {
          var u = g.len ? Math.min(1, s / g.len) : 0;
          if (g.t === "l") return { x: g.x1 + (g.x2 - g.x1) * u, y: g.y1 + (g.y2 - g.y1) * u, h: Math.atan2(g.y2 - g.y1, g.x2 - g.x1) };
          var ph = g.a0 + (g.a1 - g.a0) * u; return { x: g.cx + R * Math.cos(ph), y: g.cy + R * Math.sin(ph), h: Math.atan2(Math.cos(ph), -Math.sin(ph)) };
        }
        s -= g.len;
      }
    }
    // radar tracks for the "how would we detect it" slide
    var rng = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(11);
    var jit = function (p) { return [p[0] + (rng() - 0.5) * 12, p[1] + (rng() - 0.5) * 12]; };
    var TRACKS = { straight: [], uturn: [], hold: [] }, i;
    for (i = 0; i <= 24; i++) TRACKS.straight.push(jit([1000 + i * 36, 590 - i * 3.2]));
    for (i = 0; i <= 13; i++) TRACKS.uturn.push(jit([1000 + i * 38, 420]));
    for (i = 1; i <= 11; i++) { var a = -PI / 2 + i / 12 * PI; TRACKS.uturn.push(jit([1500 + 150 * Math.cos(a), 570 + 150 * Math.sin(a)])); }
    for (i = 13; i >= 0; i--) TRACKS.uturn.push(jit([1000 + i * 38, 720]));
    for (var sd = 0; sd <= total; sd += 36) { var q = at(sd); TRACKS.hold.push(jit([q.x, q.y])); }
    var cur = mode === "radar" ? "straight" : "hold", st = { s: 0, last: 0, pause: 0 };
    function plane(ctx, x, y, h, col, out) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(1.35, 1.35); ctx.beginPath();
      ctx.moveTo(34, 0); ctx.lineTo(8, -7); ctx.lineTo(-6, -36); ctx.lineTo(-16, -36); ctx.lineTo(-8, -6); ctx.lineTo(-26, -5); ctx.lineTo(-32, -16); ctx.lineTo(-38, -16); ctx.lineTo(-34, 0);
      ctx.lineTo(-38, 16); ctx.lineTo(-32, 16); ctx.lineTo(-26, 5); ctx.lineTo(-8, 6); ctx.lineTo(-16, 36); ctx.lineTo(-6, 36); ctx.lineTo(8, 7); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = out; ctx.stroke(); ctx.restore();
    }
    function grid(ctx, C) {
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.55;
      for (var x = 1000; x <= 1900; x += 120) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x, 1020); ctx.stroke(); }
      for (var y = 150; y <= 1020; y += 120) { ctx.beginPath(); ctx.moveTo(1000, y); ctx.lineTo(1900, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    function renderFly(ctx, C) {
      grid(ctx, C);
      if (step >= 1) {
        ctx.setLineDash([14, 14]); ctx.strokeStyle = C.muted; ctx.lineWidth = 4; ctx.beginPath();
        ctx.moveTo(xf - Lg, y0); ctx.lineTo(xf, y0); ctx.arc(xf, y0 + R, R, -PI / 2, PI / 2); ctx.lineTo(xf - Lg, y0 + 2 * R); ctx.arc(xf - Lg, y0 + R, R, PI / 2, 3 * PI / 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.sign; ctx.beginPath(); ctx.moveTo(xf, y0 - 22); ctx.lineTo(xf + 20, y0 + 14); ctx.lineTo(xf - 20, y0 + 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.ink; ctx.font = "600 30px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.fillText("FIX", xf + 30, y0 - 6);
      }
      var n = Math.floor(st.s / 36), pts = [];
      for (var j = 0; j <= n; j++) pts.push(at(j * 36));
      ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.globalAlpha = 1;
      pts.forEach(function (p) { ctx.fillStyle = C.ink; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
      var q = at(st.s); plane(ctx, q.x, q.y, q.h, C.rot, C.panel);
    }
    function renderRadar(ctx, C) {
      grid(ctx, C);
      var P = TRACKS[cur];
      ctx.fillStyle = C.ink;
      P.forEach(function (p) { ctx.globalAlpha = 0.78; ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
      ctx.fillStyle = C.muted; ctx.font = "500 28px 'Instrument Sans', sans-serif"; ctx.textAlign = "left"; ctx.fillText("radar returns: " + P.length + " timestamped positions", 1010, 1050);
    }
    function render(ctx, C) { if (mode === "fly") renderFly(ctx, C); else renderRadar(ctx, C); }
    function ui() {
      var chips = sec.querySelector(".js-chips"); if (!chips) return; chips.innerHTML = "";
      [["straight", "Straight"], ["uturn", "U-turn"], ["hold", "Holding"]].forEach(function (c) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = c[1]; b.setAttribute("aria-pressed", String(c[0] === cur)); b.onclick = function () { cur = c[0]; ui(); me.dirty = true; }; chips.appendChild(b); });
    }
    var rp = sec.querySelector(".js-replay"); if (rp) rp.addEventListener("click", function () { st.s = 0; st.pause = 0; me.dirty = true; });
    me.cv = cv; me.render = render;
    me.step = function (n) { step = n; if (mode === "radar") { var want = ["straight", "uturn", "hold"][Math.min(Math.max(n, 0), 2)]; if (want !== cur) { cur = want; ui(); } } me.dirty = true; };
    me.tick = function (now) {
      if (mode !== "fly") return false;
      var dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0; st.last = now;
      if (st.s >= total) { st.pause += dt; if (st.pause > 1.8) { st.s = 0; st.pause = 0; } return true; }
      st.s = Math.min(total, st.s + 430 * dt); return true;
    };
    ui(); return me;
  };


  /* ---------- aviation: smooth the track, count self-crossings, perturb and recount ---------- */
  SC.perturb = function (sec, cv) {
    var me = {}, step = 0, cur = "straight", T = {}, hist = [], pert = null, timer = 0, last = 0, SP = 36, zoom = null, zdrag = null;
    var mk = function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    function resample(P, d) { var out = [P[0]], acc = 0, i, prev = P[0]; for (i = 1; i < P.length; i++) { var cur_ = P[i], L = Math.hypot(cur_[0] - prev[0], cur_[1] - prev[1]); while (acc + L >= d) { var u = (d - acc) / L; prev = [prev[0] + (cur_[0] - prev[0]) * u, prev[1] + (cur_[1] - prev[1]) * u]; out.push(prev); L = Math.hypot(cur_[0] - prev[0], cur_[1] - prev[1]); acc = 0; } acc += L; prev = cur_; } return out; }
    function catmull(C, n) { var out = []; for (var i = 0; i < C.length - 1; i++) { var p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)]; for (var k = 0; k < n; k++) { var t = k / n, t2 = t * t, t3 = t2 * t; out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } } out.push(C[C.length - 1]); return out; }
    function holdPath() {
      var xf = 1620, y0 = 420, Lg = 400, R = 150, P = [], k, i;
      var line = function (x1, y1, x2, y2) { for (var j = 0; j <= 40; j++) P.push([x1 + (x2 - x1) * j / 40, y1 + (y2 - y1) * j / 40]); };
      var arc = function (cx, cy, a0, a1) { for (var j = 0; j <= 60; j++) { var a = a0 + (a1 - a0) * j / 60; P.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } };
      line(1000, y0, xf - Lg, y0); line(xf - Lg, y0, xf, y0);
      for (k = 0; k < 3; k++) { arc(xf, y0 + R, -PI / 2, PI / 2); line(xf, y0 + 2 * R, xf - Lg, y0 + 2 * R); arc(xf - Lg, y0 + R, PI / 2, 3 * PI / 2); line(xf - Lg, y0, xf, y0); }
      line(xf, y0, xf + 280, y0); return P;
    }
    var TRUE = {
      straight: function () { var P = []; for (var i = 0; i <= 60; i++) P.push([1000 + i * 15, 600 - i * 1.4]); return P; },
      loop: function () { return catmull([[1000, 720], [1250, 720], [1450, 700], [1570, 610], [1510, 480], [1360, 470], [1300, 570], [1340, 700], [1390, 800], [1520, 850], [1700, 830]], 24); },
      hold: holdPath
    };
    function smoothLine(raw) {
      var sm = raw.map(function (p, i) { var x = 0, y = 0, w = 0; for (var d = -3; d <= 3; d++) { var j = i + d; if (j < 0 || j >= raw.length) continue; var wt = 4 - Math.abs(d); x += raw[j][0] * wt; y += raw[j][1] * wt; w += wt; } return [x / w, y / w]; });
      sm[0] = raw[0].slice(); sm[sm.length - 1] = raw[raw.length - 1].slice();
      for (var it = 0; it < 2; it++) { var q = [sm[0]]; for (var i = 0; i < sm.length - 1; i++) { var a = sm[i], b = sm[i + 1]; q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } q.push(sm[sm.length - 1]); sm = q; }
      return sm;
    }
    function noisy(truth, r) { return truth.map(function (p) { return [p[0] + (r() - 0.5) * 12, p[1] + (r() - 0.5) * 12]; }); }
    function build(key) {
      var rng = mk(key === "hold" ? 11 : key === "loop" ? 5 : 3), truth = resample(TRUE[key](), SP), raw = noisy(truth, rng), line = smoothLine(raw);
      return { truth: truth, raw: raw, line: line, cross: crossings(line) };
    }
    function crossings(P) {
      var out = [], n = P.length - 1, i, j;
      for (i = 0; i < n; i++) {
        var ax = P[i][0], ay = P[i][1], rx = P[i + 1][0] - ax, ry = P[i + 1][1] - ay;
        for (j = i + 2; j < n; j++) {
          var bx = P[j][0], by = P[j][1], sx = P[j + 1][0] - bx, sy = P[j + 1][1] - by, d = rx * sy - ry * sx;
          if (Math.abs(d) < 1e-9) continue;
          var t = ((bx - ax) * sy - (by - ay) * sx) / d, u = ((bx - ax) * ry - (by - ay) * rx) / d;
          if (t > 0 && t < 1 && u > 0 && u < 1) out.push([ax + t * rx, ay + t * ry]);
        }
      }
      return out;
    }
    // push off: a parallel copy of the smoothed curve at a constant distance eps along its normal; count where the copy meets
    // the original, ignoring pairs that are close in time (trivial local meetings)
    var TAU_SEP = 24;
    function cross2(P, Q) {
      var out = [], n = P.length - 1, i, j;
      for (i = 0; i < n; i++) {
        var ax = P[i][0], ay = P[i][1], rx = P[i + 1][0] - ax, ry = P[i + 1][1] - ay;
        for (j = 0; j < n; j++) {
          if (Math.abs(i - j) <= TAU_SEP) continue;
          var bx = Q[j][0], by = Q[j][1], sx = Q[j + 1][0] - bx, sy = Q[j + 1][1] - by, d = rx * sy - ry * sx;
          if (Math.abs(d) < 1e-9) continue;
          var t = ((bx - ax) * sy - (by - ay) * sx) / d, u = ((bx - ax) * ry - (by - ay) * rx) / d;
          if (t > 0 && t < 1 && u > 0 && u < 1) out.push([ax + t * rx, ay + t * ry]);
        }
      }
      return out;
    }
    function offsetCurve(line, eps) {
      var n = line.length;
      return line.map(function (p, i) {
        var a = line[Math.max(0, i - 2)], b = line[Math.min(n - 1, i + 2)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
        return [p[0] - ty / l * eps, p[1] + tx / l * eps];
      });
    }
    function perturb(t) {
      var eps = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 5.5), Q = offsetCurve(t.line, eps);
      return { line: Q, eps: eps, cross: cross2(t.line, Q) };
    }
    function select(k) { cur = k; if (!T[k]) T[k] = build(k); hist = []; pert = null; timer = 0; ui(); me.dirty = true; }
    function once() { var t = T[cur]; pert = perturb(t); hist.push(pert.cross.length); if (hist.length > 12) hist.shift(); me.dirty = true; ui(); }
    // close-up of a box drawn over the picture: the track, its pushoff and where they meet, at the box's scale
    function renderZoom(ctx, C, t) {
      var A = { x: 1000, y: 150, w: 900, h: 870 }, z = zoom, s = Math.min(A.w / (z.x1 - z.x0), A.h / (z.y1 - z.y0)), cx = (z.x0 + z.x1) / 2, cy = (z.y0 + z.y1) / 2, inside = 0;
      var X = function (p) { return [A.x + A.w / 2 + (p[0] - cx) * s, A.y + A.h / 2 + (p[1] - cy) * s]; };
      var stroke = function (P, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.beginPath(); P.forEach(function (p, i) { var q = X(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); };
      ctx.save(); ctx.fillStyle = C.panel; ctx.fillRect(A.x, A.y, A.w, A.h); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
      ctx.fillStyle = C.ink; ctx.globalAlpha = 0.35; t.raw.forEach(function (p) { var q = X(p); ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
      stroke(t.line, C.ink, 6); stroke(pert.line, C.sign, 6);
      pert.cross.forEach(function (c) { var q = X(c); if (q[0] > A.x && q[0] < A.x + A.w && q[1] > A.y && q[1] < A.y + A.h) { inside++; ctx.fillStyle = C.mix; ctx.beginPath(); ctx.arc(q[0], q[1], 14, 0, TAU); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.panel; ctx.stroke(); } });
      ctx.restore(); ctx.strokeStyle = C.rot; ctx.lineWidth = 4; ctx.strokeRect(A.x, A.y, A.w, A.h);
      ctx.fillStyle = C.ink; ctx.font = "600 38px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.fillText("zoom ×" + s.toFixed(s < 10 ? 1 : 0) + ": " + inside + " meeting" + (inside === 1 ? "" : "s"), 1010, 130);
    }
    function render(ctx, C) {
      var t = T[cur]; if (!t) return;
      if (zoom && step >= 3 && pert) { renderZoom(ctx, C, t); return; }
      ctx.strokeStyle = C.rule; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.55;
      for (var x = 1000; x <= 1900; x += 120) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x, 1020); ctx.stroke(); }
      for (var y = 150; y <= 1020; y += 120) { ctx.beginPath(); ctx.moveTo(1000, y); ctx.lineTo(1900, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      var path = function (P, col, w, al) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = al; ctx.lineJoin = "round"; ctx.beginPath(); P.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.globalAlpha = 1; };
      var dots = function (P, col, r, al, ring) { ctx.fillStyle = col; ctx.globalAlpha = al; P.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); if (ring) { ctx.lineWidth = 3; ctx.strokeStyle = ring; ctx.stroke(); } }); ctx.globalAlpha = 1; };
      dots(t.raw, C.ink, step >= 1 ? 5 : 8, step >= 1 ? 0.35 : 0.8);
      var showPert = step >= 3 && pert;
      if (step >= 1) path(t.line, C.ink, showPert ? 4 : 5, 0.95);
      if (step >= 2 && !showPert) dots(t.cross, C.mix, 10, 0.95, C.panel);
      if (showPert) { path(pert.line, C.sign, 5, 1); dots(pert.cross, C.mix, 12, 1, C.panel); }
      var n = showPert ? pert.cross.length : t.cross.length;
      if (step >= 2) { ctx.fillStyle = C.ink; ctx.font = "600 44px 'JetBrains Mono', monospace"; ctx.textAlign = "left"; ctx.fillText((showPert ? "meets the pushoff: " : "crossings: ") + n, 1010, 310) }
      if (step >= 3 && hist.length) {
        var mx = Math.max.apply(null, hist.concat([1])), bx = 1010, by = 1030, bw = 52, hh = 130;
        ctx.fillStyle = C.muted; ctx.font = "500 24px 'Instrument Sans', sans-serif"; ctx.textAlign = "left"; ctx.fillText("meetings, for each new pushoff distance", bx, by - hh - 40);
        hist.forEach(function (v, i) { var h = v / mx * hh; ctx.fillStyle = C.sign; ctx.fillRect(bx + i * (bw + 12), by - h, bw, h); ctx.fillStyle = C.ink; ctx.font = "600 24px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(String(v), bx + i * (bw + 12) + bw / 2, by - h - 8); });
      }
      if (zdrag) { ctx.setLineDash([12, 10]); ctx.strokeStyle = C.rot; ctx.lineWidth = 4; ctx.strokeRect(Math.min(zdrag.x0, zdrag.x1), Math.min(zdrag.y0, zdrag.y1), Math.abs(zdrag.x1 - zdrag.x0), Math.abs(zdrag.y1 - zdrag.y0)); ctx.setLineDash([]); }
    }
    function ui() {
      var chips = sec.querySelector(".js-chips"); if (chips) { chips.innerHTML = ""; [["straight", "Straight"], ["loop", "Loop"], ["hold", "Holding"]].forEach(function (c) { var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = c[1]; b.setAttribute("aria-pressed", String(c[0] === cur)); b.onclick = function () { select(c[0]); }; chips.appendChild(b); }); }
      var zo = sec.querySelector(".js-zoomout"); if (zo) zo.style.display = zoom ? "" : "none";
      var v = sec.querySelector(".js-verdict");
      if (v) {
        if (hist.length < 4) v.innerHTML = "";
        else { var mn = Math.min.apply(null, hist), mxx = Math.max.apply(null, hist); v.innerHTML = mn === mxx ? "<b class='tv'>Stable:</b> always " + mn + "." : "<b class='mx'>Unstable:</b> between " + mn + " and " + mxx + "."; }
      }
    }
    var pb = sec.querySelector(".js-perturb"); if (pb) pb.addEventListener("click", once);
    var zbtn = sec.querySelector(".js-zoomout"); if (zbtn) zbtn.addEventListener("click", function () { zoom = null; ui(); me.dirty = true; });
    var pt = function (e) { var rc = cv.getBoundingClientRect(), k = W / rc.width; return [Math.max(1000, Math.min(1900, (e.clientX - rc.left) * k)), Math.max(150, Math.min(1020, (e.clientY - rc.top) * k))]; };
    cv.addEventListener("pointerdown", function (e) { if (step < 3 || !pert || zoom) return; var p = pt(e); if ((e.clientX - cv.getBoundingClientRect().left) * W / cv.getBoundingClientRect().width < 1000) return; zdrag = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }; cv.setPointerCapture(e.pointerId); me.dirty = true; });
    cv.addEventListener("pointermove", function (e) { if (!zdrag) return; var p = pt(e); zdrag.x1 = p[0]; zdrag.y1 = p[1]; me.dirty = true; });
    cv.addEventListener("pointerup", function () { if (!zdrag) return; var z = zdrag; zdrag = null; if (Math.abs(z.x1 - z.x0) >= 24 && Math.abs(z.y1 - z.y0) >= 24) zoom = { x0: Math.min(z.x0, z.x1), x1: Math.max(z.x0, z.x1), y0: Math.min(z.y0, z.y1), y1: Math.max(z.y0, z.y1) }; ui(); me.dirty = true; });
    cv.addEventListener("dblclick", function () { if (zoom) { zoom = null; ui(); me.dirty = true; } });
    me.cv = cv; me.render = render;
    me.step = function (n) {
      var prev = step; step = n; zoom = null; zdrag = null;
      var want = n >= 5 ? "hold" : n === 4 ? "loop" : "straight";
      if (want !== cur) { cur = want; if (!T[cur]) T[cur] = build(cur); hist = []; pert = null; timer = 0; }
      if (n >= 3 && (prev < 3 || !pert)) { hist = []; once(); }
      if (n < 3) { hist = []; pert = null; }
      ui(); me.dirty = true;
    };
    me.tick = function (now) {
      if (step < 3 || zoom || zdrag) return false;
      var dt = last ? (now - last) / 1000 : 0; last = now; timer += dt;
      if (timer > 0.9) { timer = 0; once(); return true; } return false;
    };
    select("straight"); return me;
  };

  /* ---------- wiring ---------- */
  function stepOf(sec) { return sec.querySelectorAll(".fragment.visible").length; }
  function enter(sec) {
    active = null; if (!sec) return;
    var sc = scenes.filter(function (s) { return s.section === sec; })[0]; if (!sc) return;
    active = sc; var n = stepOf(sec); refreshShow(sec, n); sc.step(n); sc.dirty = true;
  }
  function boot() {
    document.querySelectorAll("section[data-scene]").forEach(function (sec) {
      var f = SC[sec.dataset.scene]; if (!f) return;
      sec.setAttribute("data-prevent-swipe", ""); // dragging a simulation must not be read as a swipe to the next slide
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.className = "scene-canvas"; sec.insertBefore(cv, sec.firstChild);
      var sc = f(sec, cv); sc.section = sec; sc.dirty = true; scenes.push(sc);
    });
    var wire = function () {
      deck.on("slidechanged", function (e) { enter(e.currentSlide); });
      var frag = function (e) { var sec = e.fragment.closest("section[data-scene]"); if (sec && active && active.section === sec) { var n = stepOf(sec); refreshShow(sec, n); active.step(n); active.dirty = true; } };
      deck.on("fragmentshown", frag); deck.on("fragmenthidden", frag);
      enter(deck.getCurrentSlide());
    };
    wire();
    (function loop(now) {
      if (active) { var anim = active.tick ? active.tick(now) : false; if (anim || active.dirty) { active.dirty = false; var ctx = active.cv.getContext("2d"); ctx.clearRect(0, 0, W, H); active.render(ctx, L.colors()); } }
      requestAnimationFrame(loop);
    })(performance.now());
  }
  window.TalkBoot = boot;
  window.TalkPdf = function (sec, arg) { var sc = scenes.filter(function (s) { return s.section === sec; })[0]; if (sc && sc.pdf) { sc.pdf(arg); sc.dirty = true; } };
})();
