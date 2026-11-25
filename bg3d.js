/* 3D wave of light points: one canvas, one job — give the page depth that follows scroll and pointer */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
(function(){
  var canvas = document.getElementById('bg3d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var small = window.innerWidth < 760;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'low-power' }); }
  catch (e) { canvas.remove(); return; }
  var px = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(px);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
  var group = new THREE.Group(); scene.add(group);

  var cols = small ? 110 : 200, rows = small ? 80 : 130;
  var geo = new THREE.PlaneGeometry(44, 30, cols, rows);
  geo.rotateX(-Math.PI / 2);
  var uniforms = {
    uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0, 0) }, uDim: { value: 1 },
    uPx: { value: px * (small ? 1.25 : 1) }, uPink: { value: new THREE.Color('#ff4f87') }
  };
  var mat = new THREE.ShaderMaterial({
    uniforms: uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'uniform float uTime; uniform vec2 uMouse; uniform float uPx;',
      'varying float vH; varying float vFog;',
      'void main(){',
      '  vec3 p = position; float t = uTime * .35;',
      '  float h = sin(p.x*.32 + t)*.55 + sin(p.z*.46 - t*1.3)*.45 + sin((p.x+p.z)*.2 + t*.7)*.85;',
      '  h += sin(p.x*.9 - p.z*.6 + t*2.)*.12;',
      '  vec2 m = uMouse * vec2(9., 6.) + vec2(0., -3.);',
      '  float d = length(p.xz - m);',
      '  h += sin(d*1.3 - uTime*3.5) * .45 * exp(-d*.28);',
      '  p.y = h; vH = h;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
      '  gl_Position = projectionMatrix * mv;',
      '  gl_PointSize = uPx * (2.4 + max(h, 0.) * 1.8) * (10. / -mv.z);',
      '  vFog = smoothstep(30., 5., -mv.z);',
      '}'].join('\n'),
    fragmentShader: [
      'uniform vec3 uPink; uniform float uDim;',
      'varying float vH; varying float vFog;',
      'void main(){',
      '  float d = length(gl_PointCoord - .5); if (d > .5) discard;',
      '  float a = smoothstep(.5, .0, d) * vFog * (.35 + .65 * smoothstep(-1., 1.3, vH));',
      '  vec3 c = mix(vec3(.78, .76, .74), uPink, smoothstep(0., 1.3, vH));',
      '  c += vec3(1.,.85,.9) * smoothstep(1.35, 1.9, vH) * .5;',
      '  gl_FragColor = vec4(c, a * uDim * .8);',
      '}'].join('\n')
  });
  var pts = new THREE.Points(geo, mat);
  pts.position.set(0, -2, -6);
  group.add(pts);

  /* floating dust in front of the wave for depth */
  var n = small ? 260 : 520, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (var i = 0; i < n; i++){
    pos[i*3] = (Math.random() - .5) * 30; pos[i*3+1] = Math.random() * 12 - 2.5; pos[i*3+2] = -Math.random() * 22 + 4;
    seed[i] = Math.random();
  }
  var dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dgeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  var dmat = new THREE.ShaderMaterial({
    uniforms: uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'uniform float uTime; uniform float uPx; attribute float aSeed; varying float vA; varying float vS;',
      'void main(){',
      '  vec3 p = position;',
      '  p.y += mod(uTime * (.15 + aSeed * .25) + aSeed * 12., 12.) - 6.;',
      '  p.x += sin(uTime * .3 + aSeed * 40.) * .6;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
      '  gl_Position = projectionMatrix * mv;',
      '  gl_PointSize = uPx * (1.5 + aSeed * 3.) * (12. / -mv.z);',
      '  vA = smoothstep(26., 4., -mv.z) * (.4 + .6 * sin(uTime * (1. + aSeed) + aSeed * 30.) * .5 + .3); vS = aSeed;',
      '}'].join('\n'),
    fragmentShader: [
      'uniform vec3 uPink; uniform float uDim; varying float vA; varying float vS;',
      'void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard;',
      '  vec3 c = vS > .7 ? uPink : vec3(.95, .93, .9);',
      '  gl_FragColor = vec4(c, smoothstep(.5, 0., d) * vA * uDim * .8); }'].join('\n')
  });
  group.add(new THREE.Points(dgeo, dmat));

  function size(){
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  size();
  var rt; window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(size, 120); });

  /* pointer (throttled to one read per frame) */
  var mx = 0, my = 0, tx = 0, ty = 0;
  if (fine && !reduce){
    window.addEventListener('pointermove', function(e){ tx = e.clientX / window.innerWidth * 2 - 1; ty = e.clientY / window.innerHeight * 2 - 1; }, { passive: true });
    window.addEventListener('blur', function(){ tx = 0; ty = 0; });
  }

  var clock = new THREE.Clock(), raf = 0, running = false;
  function frame(){
    var t = clock.getElapsedTime();
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var s = Math.min(1, window.scrollY / max);
    var hero = Math.min(1, window.scrollY / window.innerHeight);
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    uniforms.uTime.value = t;
    uniforms.uMouse.value.set(mx, my);
    uniforms.uDim.value = 1 - hero * .45;
    /* camera glides over the wave as the page scrolls */
    camera.position.set(mx * .8, 3.4 + s * 2.6 - my * .4, 9 - s * 3);
    camera.lookAt(0, -1.2 - s * 1.5, -6);
    group.rotation.y = s * .9 - .15 + mx * .06;
    renderer.render(scene, camera);
  }
  function loop(){ frame(); raf = requestAnimationFrame(loop); }
  function start(){ if (!running && !reduce){ running = true; clock.start(); loop(); } }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  if (reduce){ frame(); window.addEventListener('scroll', function(){ requestAnimationFrame(frame); }, { passive: true }); }
  else start();
  document.addEventListener('visibilitychange', function(){ document.hidden ? stop() : start(); });
  canvas.addEventListener('webglcontextlost', function(e){ e.preventDefault(); stop(); canvas.style.display = 'none'; });
  requestAnimationFrame(function(){ canvas.classList.add('ready'); });
  window.addEventListener('pagehide', function(){ stop(); geo.dispose(); mat.dispose(); dgeo.dispose(); dmat.dispose(); renderer.dispose(); });
})();
