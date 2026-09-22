/* THEME (Hardened with safe storage access) */
    const html = document.documentElement;
    let saved = 'light';
    try {
      saved = localStorage.getItem('theme') || 'light';
    } catch (e) {}
    html.setAttribute('data-theme', saved);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', saved === 'dark');
      themeToggle.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', next);
        themeToggle.setAttribute('aria-pressed', next === 'dark');
        try {
          localStorage.setItem('theme', next);
        } catch (e) {}
      });
    }

    /* HAMBURGER & ACCESSIBILITY */
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    function toggleMobile() {
      const isOpen = mobileMenu.classList.toggle('open');
      menuBtn.classList.toggle('open', isOpen);
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    function closeMobile() {
      mobileMenu.classList.remove('open');
      menuBtn.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
    if (menuBtn) {
      menuBtn.addEventListener('click', toggleMobile);
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileMenu && mobileMenu.classList.contains('open')) {
        closeMobile();
        menuBtn.focus();
      }
    });

    /* SMOOTH SCROLL & DEEP LINK HASH SYNC */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        if (href === '#main-content') {
          const main = document.getElementById('main-content');
          if (main) {
            main.setAttribute('tabindex', '-1');
            main.focus();
          }
          return;
        }
        e.preventDefault();
        const t = document.querySelector(href);
        if (t) {
          t.scrollIntoView({ behavior: 'smooth' });
          if (history.pushState) {
            history.pushState(null, '', href);
          } else {
            window.location.hash = href;
          }
        }
        closeMobile();
      });
    });

    /* SCROLL REVEAL */
    const revObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal,.reveal-l,.reveal-r').forEach(el => revObs.observe(el));

    /* TIMELINE LINE */
    const tl = document.getElementById('timeline');
    const tlObs = new IntersectionObserver(e => { if (e[0].isIntersecting) { tl.classList.add('in'); tlObs.disconnect(); } }, { threshold: 0.05 });
    if (tl) tlObs.observe(tl);

    /* COUNTER */
    function runCounter(el) {
      const target = parseFloat(el.dataset.t);
      const suffix = el.dataset.s || '';
      const decimals = parseInt(el.dataset.d) || 0;
      const duration = 1500;
      let startTime = null;

      function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const value = progress === 1 ? target : target * ease;
        el.textContent = value.toFixed(decimals) + suffix;
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
      requestAnimationFrame(animate);
    }
    const ctrObs = new IntersectionObserver((entries, observer) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          runCounter(e.target);
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.ctr').forEach(el => ctrObs.observe(el));

    /* SKILL BARS */
    const barObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.style.width = e.target.dataset.w; barObs.unobserve(e.target); } });
    }, { threshold: 0.4 });
    document.querySelectorAll('.skill-bar-fill').forEach(el => barObs.observe(el));

    /* TAG POP */
    const tagGroupObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.tag').forEach((tag, i) => {
            setTimeout(() => tag.classList.add('popped'), i * 75);
          });
          tagGroupObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.skills-group').forEach(el => tagGroupObs.observe(el));

    /* ACTIVE NAV (With bottom of document boundary check) */
    const sections = document.querySelectorAll('section[id]');
    const navAs = document.querySelectorAll('#navLinks a');
    window.addEventListener('scroll', () => {
      let cur = '';
      const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 60);
      if (atBottom) {
        cur = 'contact';
      } else {
        sections.forEach(s => {
          if (window.scrollY >= s.offsetTop - 120) cur = s.id;
        });
      }
      navAs.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + cur);
      });
    }, { passive: true });

    /* CURSOR GLOW (Desktop with pointer support only) */
    const glow = document.getElementById('cursorGlow');
    if (glow && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let mx = -1000, my = -1000, cx = -1000, cy = -1000;
      document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        glow.style.opacity = '1';
      });
      document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
      (function animGlow() {
        cx += (mx - cx) * 0.1; cy += (my - cy) * 0.1;
        glow.style.left = cx + 'px'; glow.style.top = cy + 'px';
        requestAnimationFrame(animGlow);
      })();
    } else if (glow) {
      glow.style.display = 'none';
    }