/* js/main.js
   Main glue code:
   - Mobile nav toggle
   - GSAP page transition (intercept links, animate overlay, then navigate)
   - Lazy-load Three.js scene for car + smoke canvas, with Lottie fallback
   - Animated counters (GSAP)
   - WhatsApp pulsing animation with reduced-motion support
   - Locomotive Scroll + GSAP ScrollTrigger integration template
   - Comments indicate where to toggle debug mode and replace CDNs/assets
*/

(() => {
  const DEBUG = false; // toggle for verbose logs (production: false)

  /* Helper: safe query */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  /* Page transition overlay */
  const pageTransition = document.getElementById('page-transition');

  /* Intercept internal links for GSAP page transitions
     - Only intercept same-origin internal links that are full-page navigations.
     - Exceptions: links with target="_blank" or data-no-transition attribute
  */
  function initPageTransitions() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      if (a.target === '_blank' || a.dataset.noTransition !== undefined) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
      // same origin check
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      // animate overlay up then navigate
      gsap.to(pageTransition, {duration:0.55, y:0, ease:"power2.out", onStart: () => {
        pageTransition.style.pointerEvents = 'auto';
      }});
      // small delay for smoothness (no waiting for network here)
      setTimeout(() => { location.href = url.pathname + url.search + url.hash; }, 600);
    });
  }

  /* Mobile nav toggle */
  function initMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const menu = document.getElementById('mobile-menu');
    if (!hamburger) return;
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !expanded);
      if (!expanded) {
        menu.style.display = 'block';
        menu.setAttribute('aria-hidden', 'false');
        // animate with GSAP
        gsap.fromTo(menu, {y:-10, opacity:0}, {y:0, opacity:1, duration:0.35});
      } else {
        gsap.to(menu, {y:-10, opacity:0, duration:0.25, onComplete: () => {
          menu.style.display = 'none';
          menu.setAttribute('aria-hidden', 'true');
        }});
      }
    });

    // close menu on link click
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
      });
    });
  }

  /* Simple preloader hide */
  function hidePreloader() {
    const pre = document.getElementById('preloader');
    if (!pre) return;
    gsap.to(pre, {duration:0.6, opacity:0, onComplete: () => {
      pre.style.display = 'none';
    }});
  }

  /* Animated counters using GSAP (micro-interactions) */
  function initCounters() {
    document.querySelectorAll('.badge-value').forEach(el => {
      const count = parseInt(el.dataset.count, 10) || 0;
      gsap.fromTo(el, {innerText:0}, {duration:1.6, innerText: count, roundProps: "innerText", ease:'power2.out', scrollTrigger: {
        trigger: el, start: "top 80%"
      }});
    });
  }

  /* WhatsApp pulsing */
  function initWhatsApp() {
    const wa = document.getElementById('whatsapp-cta');
    if (!wa) return;
    if (!document.body.classList.contains('reduce-motion')) {
      wa.classList.add('pulse');
    }
    // keyboard accessible focus state
    wa.addEventListener('focus', () => wa.classList.add('focused'));
    wa.addEventListener('blur', () => wa.classList.remove('focused'));
  }

  /* Locomotive Scroll + GSAP ScrollTrigger integration template
     If you want to enable smooth scrolling, uncomment/initialize locomotive below.
     Make sure to test performance on mobile. If using Locomotive, ensure the markup has data-scroll-container.
  */
  function initSmoothScrolling() {
    try {
      const scrollEl = document.querySelector('[data-scroll-container]') || document.body;
      if (typeof LocomotiveScroll !== 'undefined') {
        const loco = new LocomotiveScroll({
          el: document.querySelector('[data-scroll-container]') || document.documentElement,
          smooth: true,
          multiplier: 1.0,
          smartphone: { smooth: true },
          tablet: { smooth: true }
        });
        // tell ScrollTrigger to use locomotive proxy
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.scrollerProxy(loco.el, {
          scrollTop(value) {
            return arguments.length ? loco.scrollTo(value) : loco.scroll.instance.scroll.y;
          },
          getBoundingClientRect() {
            return {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight};
          }
        });
        loco.on('scroll', ScrollTrigger.update);
        ScrollTrigger.addEventListener('refresh', () => loco.update());
        ScrollTrigger.refresh();
      } else {
        if (DEBUG) console.log('Locomotive not available; using native scroll.');
      }
    } catch (err) {
      if (DEBUG) console.error('Smooth scroll init error', err);
    }
  }

  /* Lazy load 3D car (Three.js) and smoke shader or fallback Lottie.
     Strategy:
      - If user has prefers-reduced-motion -> skip heavy motion and show static poster
      - Attempt to load three.js (via dynamic import from CDN), then GLTFLoader, then create scene
      - If any step fails, fallback to Lottie player with provided JSON or MP4 loop
      - Make sure to lazy-load only after hero is in viewport (IntersectionObserver)
  */
  function initThreeJSCar() {
    const carSceneEl = document.getElementById('car-scene');
    const hero = document.querySelector('.hero');
    if (!carSceneEl || !hero) return;
    if (document.body.classList.contains('reduce-motion')) {
      // reduced-motion: show lightweight Lottie static or small PNG instead
      renderLottieFallback();
      return;
    }

    // Wait until hero is visible
    const io = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) {
        obs.disconnect();
        // Start loading three.js assets
        loadThreeJS().then(success => {
          if (!success) renderLottieFallback();
        });
      }
    }, {threshold: 0.25});
    io.observe(hero);

    function renderLottieFallback() {
      // Insert Lottie fallback
      const l = document.createElement('lottie-player');
      // LOTTIE_CAR_FALLBACK: replace with your lottie car json
      l.setAttribute('src', 'https://assets2.lottiefiles.com/packages/lf20_vehicletest.json'); // sample placeholder
      l.setAttribute('background', 'transparent');
      l.setAttribute('speed', '1');
      l.setAttribute('loop', '');
      l.setAttribute('autoplay', '');
      l.style.width = '100%';
      l.style.height = '100%';
      l.style.pointerEvents = 'none';
      carSceneEl.appendChild(l);
    }

    async function loadThreeJS() {
      try {
        // Dynamic load of three.js and GLTFLoader from CDN
        // NOTE: Replace these script URLs if you prefer another CDN
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.159.0/examples/js/loaders/GLTFLoader.js');
        // optional: OrbitControls if desired
        // await loadScript('https://cdn.jsdelivr.net/npm/three@0.159.0/examples/js/controls/OrbitControls.js');

        // create scene
        const THREE = window.THREE;
        const width = carSceneEl.clientWidth;
        const height = carSceneEl.clientHeight;

        const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        carSceneEl.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, width/height, 0.1, 1000);
        camera.position.set(0, 1.2, 3.5);

        // subtle ambient + directional light
        const ambient = new THREE.HemisphereLight(0xffffff, 0x080820, 0.6);
        scene.add(ambient);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 7);
        scene.add(dir);

        // ground reflection plane (very subtle)
        const planeGeo = new THREE.PlaneGeometry(10, 10);
        const planeMat = new THREE.MeshStandardMaterial({color:0x000000, opacity:0.0, transparent:true});
        const ground = new THREE.Mesh(planeGeo, planeMat);
        ground.rotation.x = -Math.PI/2;
        ground.position.y = -0.6;
        scene.add(ground);

        // Load GLTF model
        const loader = new THREE.GLTFLoader();
        // Replace placeholder model path with your GLB/GLTF link or keep local assets/sample-car.glb
        const modelUrl = 'assets/sample-car.glb'; // <!-- THREEJS_CAR_MODEL_GLTF: replace with your glb/gltf CDN link -->
        loader.load(modelUrl, (gltf) => {
          const car = gltf.scene || gltf.scenes[0];
          car.scale.set(0.9,0.9,0.9);
          car.position.set(0,0,0);
          scene.add(car);

          // subtle animation: slow rotation and mouse parallax
          let rotY = 0;
          const onMove = (e) => {
            const rect = carSceneEl.getBoundingClientRect();
            const mx = (e.clientX - (rect.left + rect.width/2)) / rect.width;
            const my = (e.clientY - (rect.top + rect.height/2)) / rect.height;
            // rotate slightly based on mouse
            gsap.to(car.rotation, {y: mx * 0.4, x: -my * 0.15, duration: 0.8, ease:"power2.out"});
            gsap.to(car.position, {x: mx * 0.25, y: -my * 0.1, duration: 0.8, ease:"power2.out"});
          };
          // Add event listeners for parallax only on pointer devices
          if (!('ontouchstart' in window)) {
            window.addEventListener('mousemove', onMove);
          }

          // render loop
          const animate = () => {
            if (!document.body.contains(carSceneEl)) return;
            rotY += 0.002;
            car.rotation.y += 0.002; // subtle continuous rotate
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
          };
          animate();
        }, undefined, (err) => {
          if (DEBUG) console.error('GLTF load error', err);
          renderLottieFallback();
        });

        /* Smoke layer: simple particle plane
           For production you may implement a shader-based smoke with textured planes.
           Placeholder: leave smoke to the canvas fallback implemented in initSmokeCanvas().
         */
        initSmokeCanvas();

        return true;
      } catch (err) {
        if (DEBUG) console.error('Three.js init failed', err);
        return false;
      }
    }

    /* Tiny script loader */
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
  }

  /* Smoke canvas fallback / simple animated blobs.
     This will draw moving blur circles to simulate slow smoke. Lightweight and performant.
     For a shader-based approach use Three.js textured planes + additive blending (commented in index.html)
  */
  function initSmokeCanvas() {
    const canvas = document.getElementById('smoke-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = canvas.clientWidth;
    let h = canvas.height = canvas.clientHeight;
    const blobs = [];
    const NUM = Math.max(3, Math.floor(w / 300));
    for (let i=0;i<NUM;i++){
      blobs.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: 100 + Math.random()*200,
        vx: (Math.random()-0.5)*0.1,
        vy: (Math.random()-0.5)*0.05,
        a: 0.04 + Math.random()*0.06
      });
    }
    function draw(){
      ctx.clearRect(0,0,w,h);
      blobs.forEach(b=>{
        b.x += b.vx; b.y += b.vy;
        if (b.x > w + 200) b.x = -200;
        if (b.x < -200) b.x = w + 200;
        const g = ctx.createRadialGradient(b.x, b.y, b.r*0.1, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(200,220,255,${b.a})`);
        g.addColorStop(0.6, `rgba(120,160,200,${b.a*0.8})`);
        g.addColorStop(1, `rgba(10,10,12,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(b.x - b.r, b.y - b.r, b.r*2, b.r*2);
      });
    }
    let raf;
    function loop(){
      draw();
      raf = requestAnimationFrame(loop);
    }
    loop();
    window.addEventListener('resize', () => {
      w = canvas.width = canvas.clientWidth;
      h = canvas.height = canvas.clientHeight;
    });
  }

  /* Initialize animated counters and other UI micro interactions */
  function initUI() {
    initCounters();
    initWhatsApp();
    initMobileNav();
    initPageTransitions();
    initSmoothScrolling();
  }

  /* On DOM ready */
  document.addEventListener('DOMContentLoaded', () => {
    hidePreloader();
    initUI();
    initThreeJSCar();

    // Reveal page-transition overlay initial position
    gsap.set(pageTransition, {y: '100%'});

    // Keyboard nav accessibility: add outline when using keyboard
    document.body.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') document.body.classList.add('using-keyboard');
    });

    // Active nav highlight (based on body data-page)
    const page = document.body.dataset.page;
    document.querySelectorAll('.main-nav a').forEach(a => {
      if (a.dataset.page === page) a.classList.add('active');
    });

    // Add small hover neon on hero CTA
    const book = document.getElementById('book-now');
    if (book && !document.body.classList.contains('reduce-motion')) {
      book.addEventListener('mouseenter', () => gsap.to(book, {boxShadow:'0 18px 60px rgba(0,240,255,0.15)', y:-3, duration:0.28}));
      book.addEventListener('mouseleave', () => gsap.to(book, {boxShadow:'none', y:0, duration:0.22}));
    }
  });

  // Expose for debugging if needed
  window._PCH = { initThreeJSCar };

})();
