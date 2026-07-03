/**
 * The whole background is one fragment shader: a topographic contour map
 * whose height field IS the neural network — every node is a peak the
 * contours ring around, every link raises a ridge between peaks and is
 * drawn on top as a dashed line with travelling pulses. The cursor gets a
 * coral ring, deforms the terrain, lights the relief and draws dashed
 * cyan links to its nearest thoughts.
 *
 * Performance model: the CPU culls the graph to a small ACTIVE set near
 * the visible window every frame (off-screen contributions are ~e^-100),
 * and hoists every uniform-only term (reveal pops, link growth, cursor
 * heat, pulse positions, dash offsets, lengths) out of the per-pixel
 * loops. The fragment shader only does work that genuinely varies per
 * pixel. Visually identical to evaluating the full graph.
 */

/** Upper bounds for the per-frame active sets (GLSL arrays are static). */
export const ACTIVE_NODES = 18
export const ACTIVE_LINKS = 22

export const topoVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const topoFragment = /* glsl */ `
  precision highp float;

  #define A_NODES ${ACTIVE_NODES}
  #define A_LINKS ${ACTIVE_LINKS}
  #define CURSOR_LINKS 3

  uniform vec2 uRes;
  uniform float uTime;
  uniform float uTimeScale;
  uniform float uReveal;
  uniform float uPan;        // world-y offset of the visible window
  uniform vec2 uMouseW;      // damped mouse in world coords
  uniform vec2 uMouseN;      // damped mouse in ndc (-1..1), for parallax
  uniform float uMouseIn;    // eased 0..1 pointer presence

  // active sets, culled + precomputed on the CPU each frame (x pre-scaled)
  uniform vec4 uANodes[A_NODES];    // x, y, height amp (incl. pop), height radius
  uniform vec4 uANodeDraw[A_NODES]; // draw radius rr (incl. pop), cursor heat, -, -
  uniform vec4 uALinks[A_LINKS];    // ax, ay, bx, by
  uniform vec4 uALinkLive[A_LINKS]; // grow, cursor heat, pulse position, dash offset
  uniform float uALinkLen[A_LINKS]; // segment length
  uniform vec4 uCursorLinks[CURSOR_LINKS]; // nx, ny, strength (x pre-scaled)

  varying vec2 vUv;

  const vec3 INK = vec3(0.957, 0.957, 0.973);
  const vec3 CYAN = vec3(0.369, 0.949, 0.910);
  const vec3 CORAL = vec3(1.0, 0.541, 0.361);

  // ------------------------------------------------------------ noise ---
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec2(11.7, 5.3);
      a *= 0.5;
    }
    return s;
  }

  // -------------------------------------------------------- distances ---
  float segDist(vec2 p, vec2 a, vec2 b, out float t) {
    vec2 ab = b - a;
    t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    return length(p - (a + ab * t));
  }

  // ----------------------------------------------------- height field ---
  float height(vec2 w) {
    // organic base wobble, drifting almost imperceptibly
    vec2 drift = vec2(uTime * uTimeScale * 0.008, -uTime * uTimeScale * 0.005);
    float h = fbm(w * 1.55 + drift) * 0.42;
    h += fbm(w * 3.4 - drift * 1.7) * 0.13;

    // every thought is a peak (amp already includes the birth pop)
    for (int i = 0; i < A_NODES; i++) {
      vec4 n = uANodes[i];
      if (n.z <= 0.0) continue; // empty slot
      vec2 d = w - n.xy;
      h += n.z * exp(-dot(d, d) / (n.w * n.w));
    }

    // ridges connect linked thoughts so contours flow between them.
    // uALinkLive.x carries the draw-grow (grow01 * 1.04); the ridge wants
    // the un-boosted grow01, so divide the boost back out for exact parity
    for (int i = 0; i < A_LINKS; i++) {
      float grow = uALinkLive[i].x;
      if (grow <= 0.0) continue; // empty slot / unborn
      float t;
      float d = segDist(w, uALinks[i].xy, uALinks[i].zw, t);
      h += 0.055 * (grow * 0.9615385) * exp(-d * d / 0.0026);
    }

    // the cursor is a thought being formed — terrain rises to meet it
    // (anchored in the terrain layer's parallax-shifted space)
    vec2 dm = w - (uMouseW - uMouseN * 0.012);
    h += 0.14 * uMouseIn * exp(-dot(dm, dm) / 0.02);

    return h;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv;

    // slight two-layer parallax: terrain and network drift apart on hover
    vec2 wTerrain = vec2((uv.x - 0.5) * aspect, uv.y + uPan) - uMouseN * 0.012;
    vec2 wNet = vec2((uv.x - 0.5) * aspect, uv.y + uPan) - uMouseN * 0.038;

    float h = height(wTerrain);

    // ---- contour lines from hardware derivatives (one height eval) ----
    float levels = 30.0;
    float lv = h * levels;
    float w1 = fwidth(lv);
    float gMinor = abs(fract(lv + 0.5) - 0.5);
    float minor = 1.0 - smoothstep(0.0, w1 * 1.4, gMinor);

    float lv5 = lv / 5.0;
    float w5 = fwidth(lv5);
    float gMajor = abs(fract(lv5 + 0.5) - 0.5);
    float major = 1.0 - smoothstep(0.0, w5 * 1.1, gMajor);

    // one major band becomes a dashed wandering trail (map flavour)
    float trailBand = 1.0 - smoothstep(0.3, 0.32, abs(fract(lv5 + 0.5) - 0.5) * 5.0);
    float trailDash = step(0.45, fract(wTerrain.x * 14.0 + wTerrain.y * 9.0));

    // the pointer expressed in each parallax layer's own space — cursor
    // features must compare against these, not the base-space uMouseW
    vec2 mouseT = uMouseW - uMouseN * 0.012;
    vec2 mouseNt = uMouseW - uMouseN * 0.038;

    float dhdx = dFdx(h) / max(fwidth(uv.x), 1e-6) * 0.5;
    float dhdy = dFdy(h) / max(fwidth(uv.y), 1e-6) * 0.5;
    vec2 grad = vec2(dhdx, dhdy);
    vec2 toMouse = normalize(mouseT - wTerrain + vec2(1e-4));
    float relief = clamp(dot(normalize(grad + vec2(1e-5)), toMouse), -1.0, 1.0);

    vec2 dmv = wTerrain - mouseT;
    float mGlow = exp(-dot(dmv, dmv) * 11.0) * uMouseIn;

    // contours are the quiet texture layer — the network reads first
    float lineBoost = 1.0 + relief * 0.2 * uMouseIn + mGlow * 0.55;
    float minorA = minor * 0.115 * lineBoost;
    float majorA = major * 0.2 * lineBoost;
    majorA = mix(majorA, majorA * (0.35 + 0.65 * trailDash), trailBand);

    vec3 col = vec3(0.0);
    col += INK * (minorA + majorA);

    // ---- survey decorations: sparse dots + crosses ---------------------
    for (int s = 0; s < 2; s++) {
      float scale = s == 0 ? 2.6 : 4.7;
      vec2 cell = floor(wTerrain * scale);
      vec2 local = fract(wTerrain * scale) - 0.5;
      float rnd = hash21(cell + float(s) * 71.7);
      vec2 jitter = (vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.6;
      vec2 q = (local - jitter) / scale;
      if (rnd > 0.93) {
        float dd = length(q);
        col += INK * (1.0 - smoothstep(0.0025, 0.0045, dd)) * 0.42;
      } else if (rnd > 0.88) {
        float cw = 0.0009;
        float cl = 0.008;
        float cross = (1.0 - smoothstep(cw, cw * 2.2, abs(q.x))) * step(abs(q.y), cl)
                    + (1.0 - smoothstep(cw, cw * 2.2, abs(q.y))) * step(abs(q.x), cl);
        col += INK * clamp(cross, 0.0, 1.0) * 0.3;
      }
    }

    // ---- links: clearly visible dashed lines with travelling pulses ----
    float px = 1.0 / uRes.y; // ~1px in world units (window height = 1)
    for (int i = 0; i < A_LINKS; i++) {
      vec4 live = uALinkLive[i];
      float grow = live.x;
      if (grow <= 0.0) continue;
      float t;
      float d = segDist(wNet, uALinks[i].xy, uALinks[i].zw, t);
      float visible = 1.0 - smoothstep(grow - 0.05, grow, t);
      if (visible < 0.002) continue;

      float core = 1.0 - smoothstep(px * 0.4, px * 1.8, d);
      float halo = exp(-d * d / (px * px * 90.0)) * 0.16;

      float dash = smoothstep(0.28, 0.36, abs(fract(t * uALinkLen[i] * 26.0 + live.w) - 0.5));

      float hot = live.y;

      // exp(-q*q), never pow(negative, y) — that is UB and NaNs on some GPUs
      float q = (t - live.z) * 9.0;
      float pulse = exp(-q * q);

      vec3 linkCol = mix(INK, CYAN, clamp(hot * 1.2 + pulse * 0.5, 0.0, 1.0));
      float a = (core * (0.68 + hot * 0.32) * dash + halo * 0.8 + core * pulse * 0.9) * visible;
      col += linkCol * a;
    }

    // ---- cursor links: the pointer joins the network -------------------
    for (int i = 0; i < CURSOR_LINKS; i++) {
      vec4 cl = uCursorLinks[i];
      if (cl.z < 0.01) continue;
      float t;
      float d = segDist(wNet, mouseNt, cl.xy, t);
      float core = 1.0 - smoothstep(px * 0.4, px * 1.6, d);
      float dash = smoothstep(0.25, 0.35, abs(fract(t * 16.0 - uTime * uTimeScale * 1.6) - 0.5));
      float a = core * dash * cl.z * uMouseIn * 0.9;
      col += CYAN * a;
    }

    // ---- nodes on top ---------------------------------------------------
    for (int i = 0; i < A_NODES; i++) {
      vec4 n = uANodes[i];
      vec4 dr = uANodeDraw[i];
      float rr = dr.x;
      if (rr <= 0.0001) continue;
      float d = length(wNet - n.xy);
      float dot_ = 1.0 - smoothstep(rr * 0.55, rr, d);
      float ring = 1.0 - smoothstep(px * 1.2, px * 2.4, abs(d - rr * 1.9));
      float halo = exp(-d * d / (rr * rr * 22.0)) * 0.18;

      float hot = dr.y;
      vec3 nodeCol = mix(INK, CYAN, hot);
      col += nodeCol * (dot_ * 1.2 + ring * (0.45 + hot * 0.65) + halo);
    }

    // ---- the cursor's own mark -----------------------------------------
    float dCur = length(wNet - mouseNt);
    float curRing = (1.0 - smoothstep(px * 1.0, px * 2.2, abs(dCur - 0.016))) * uMouseIn;
    col += CORAL * curRing * 0.9;

    // ---- grade: vignette + grain ---------------------------------------
    vec2 c = uv - 0.5;
    col *= 1.0 - dot(c, c) * 0.55;
    // grain freezes to a static pattern under prefers-reduced-motion
    float grain = hash21(uv * uRes + fract(uTime * uTimeScale) * 37.0) - 0.5;
    col += grain * 0.035;

    vec3 bg = vec3(0.02, 0.02, 0.031);
    gl_FragColor = vec4(bg + col, 1.0);
  }
`
