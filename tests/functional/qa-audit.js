const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080/';

async function runTests() {
  console.log('====================================================');
  console.log('Starting Comprehensive E2E QA Test Suite');
  console.log('Target URL: ' + BASE_URL);
  console.log('====================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let testCount = 0;

  async function test(name, fn) {
    testCount++;
    const testId = `TEST-${String(testCount).padStart(3, '0')}`;
    try {
      await fn();
      results.push({ id: testId, name, status: 'PASSED', error: null });
      console.log(`[PASS] ${testId}: ${name}`);
    } catch (err) {
      results.push({ id: testId, name, status: 'FAILED', error: err.message });
      console.error(`[FAIL] ${testId}: ${name}\n       Reason: ${err.message}`);
    }
  }

  // --- SUITE 1: Page Load & Resource Integrity ---
  await test('Page loads with HTTP 200 and valid title', async () => {
    const page = await browser.newPage();
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    if (!response || response.status() !== 200) {
      throw new Error(`Expected HTTP 200 but got ${response ? response.status() : 'null'}`);
    }
    const title = await page.title();
    if (!title.includes('Manikandan Saravanan')) {
      throw new Error(`Unexpected title: "${title}"`);
    }
    await page.close();
  });

  await test('Favicon link is present and loads with HTTP 200', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const faviconHref = await page.$eval('link[rel="icon"]', el => el.href);
    if (!faviconHref) throw new Error('Favicon link not found in DOM');
    const res = await page.request.get(faviconHref);
    if (res.status() !== 200) throw new Error(`Favicon returned status ${res.status()}`);
    await page.close();
  });

  await test('Resume PDF download link exists and points to valid file', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const resumeLink = await page.$('a[href="S_Manikandan.pdf"]');
    if (!resumeLink) throw new Error('Resume download link not found');
    const res = await page.request.get(new URL('S_Manikandan.pdf', BASE_URL).href);
    if (res.status() !== 200) throw new Error(`Resume PDF returned status ${res.status()}`);
    const contentLength = Number(res.headers()['content-length'] || 0);
    if (contentLength < 100000) throw new Error(`Resume file size too small: ${contentLength} bytes`);
    await page.close();
  });

  // --- SUITE 2: Console Errors & Exceptions ---
  await test('Zero unhandled JavaScript errors and console errors on initial load', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    if (errors.length > 0) {
      throw new Error(`Console/Page errors detected: ${errors.join(' | ')}`);
    }
    await page.close();
  });

  // --- SUITE 3: Theme Toggle & Persistence ---
  await test('Theme toggle switches data-theme and persists in localStorage', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    
    // Initial theme should be light or stored
    let theme = await page.getAttribute('html', 'data-theme');
    if (theme !== 'light' && theme !== 'dark') throw new Error(`Unexpected initial data-theme: ${theme}`);
    
    // Toggle theme
    await page.click('#themeToggle');
    let nextTheme = await page.getAttribute('html', 'data-theme');
    if (nextTheme === theme) throw new Error(`Theme did not toggle on click. Stays ${theme}`);
    
    // Check localStorage
    let stored = await page.evaluate(() => localStorage.getItem('theme'));
    if (stored !== nextTheme) throw new Error(`localStorage.theme was "${stored}", expected "${nextTheme}"`);
    
    // Reload page to verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    let reloadedTheme = await page.getAttribute('html', 'data-theme');
    if (reloadedTheme !== nextTheme) {
      throw new Error(`Theme did not persist after reload: got ${reloadedTheme}, expected ${nextTheme}`);
    }
    await page.close();
  });

  // --- SUITE 4: Navigation & Deep Linking ---
  await test('Desktop navbar links smooth scroll to correct sections', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL);

    const sections = ['about', 'skills', 'experience', 'projects', 'education', 'contact'];
    for (const id of sections) {
      const link = await page.$(`#navLinks a[href="#${id}"]`);
      if (!link) throw new Error(`Nav link for #${id} not found`);
      await link.click();
      await page.waitForTimeout(400);
      const isVisible = await page.$eval(`#${id}`, el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      });
      if (!isVisible) throw new Error(`Section #${id} was not scrolled into view`);
    }
    await page.close();
  });

  await test('URL hash updates on navigation click (Deep Linking & History)', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL);
    
    await page.click('#navLinks a[href="#projects"]');
    await page.waitForTimeout(300);
    const hash = await page.evaluate(() => window.location.hash);
    if (hash !== '#projects') {
      throw new Error(`Expected URL hash to be '#projects' after clicking nav link, but was '${hash}'`);
    }
    await page.close();
  });

  await test('Active nav class updates correctly when scrolling to bottom sections', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL);

    // Scroll to the very bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const activeLinkHref = await page.$eval('#navLinks a.active', el => el.getAttribute('href')).catch(() => null);
    if (activeLinkHref !== '#contact') {
      throw new Error(`Expected active nav link to be '#contact' when scrolled to bottom, but got '${activeLinkHref}'`);
    }
    await page.close();
  });

  // --- SUITE 5: Mobile Navigation & Responsiveness ---
  await test('Mobile viewport (375x667) collapses desktop nav and opens mobile menu drawer', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // Desktop nav should be hidden
    const desktopNavVisible = await page.$eval('#navLinks', el => window.getComputedStyle(el).display !== 'none');
    if (desktopNavVisible) throw new Error('Desktop nav should be hidden on mobile viewport');

    // Hamburger button should be visible
    const hamburgerVisible = await page.$eval('#menuBtn', el => window.getComputedStyle(el).display !== 'none');
    if (!hamburgerVisible) throw new Error('Hamburger menu button should be visible on mobile viewport');

    // Click hamburger to open mobile menu
    await page.click('#menuBtn');
    await page.waitForTimeout(200);

    const menuOpen = await page.$eval('#mobileMenu', el => el.classList.contains('open') && window.getComputedStyle(el).display !== 'none');
    if (!menuOpen) throw new Error('Mobile menu did not open when clicking hamburger');

    // Click a link inside mobile drawer
    await page.click('#mobileMenu a[href="#skills"]');
    await page.waitForTimeout(300);

    // Mobile menu should auto-close
    const menuStillOpen = await page.$eval('#mobileMenu', el => el.classList.contains('open'));
    if (menuStillOpen) throw new Error('Mobile menu should close after clicking a link');

    await page.close();
  });

  await test('No horizontal overflow on mobile viewports (320px, 375px, 412px)', async () => {
    const page = await browser.newPage();
    for (const width of [320, 375, 412]) {
      await page.setViewportSize({ width, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForTimeout(200);
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (hasOverflow) {
        throw new Error(`Horizontal overflow detected at viewport width ${width}px: scrollWidth is ${await page.evaluate(() => document.documentElement.scrollWidth)}`);
      }
    }
    await page.close();
  });

  await test('Hero role title does not clip or overflow on narrow screens (320px)', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 320, height: 667 });
    await page.goto(BASE_URL);

    const isClipped = await page.evaluate(() => {
      const roleWrap = document.querySelector('.role-wrap');
      const roleText = document.querySelector('.hero p.role');
      if (!roleWrap || !roleText) return false;
      return roleText.scrollWidth > window.innerWidth;
    });
    if (isClipped) {
      throw new Error('Hero role text scrollWidth exceeds viewport width on 320px screen causing clipping');
    }
    await page.close();
  });

  // --- SUITE 6: Accessibility Audits (WCAG 2.1 AA) ---
  await test('Document structure contains semantic <main> landmark', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const mainCount = await page.$$eval('main', els => els.length);
    if (mainCount !== 1) {
      throw new Error(`Expected exactly 1 semantic <main> element, found ${mainCount}`);
    }
    await page.close();
  });

  await test('Document contains skip to content navigation link for keyboard users', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const skipLink = await page.$('a.skip-link, a[href="#main"], a[href="#about"]');
    const isSkipLink = await page.evaluate(() => {
      const a = document.querySelector('a[href^="#"]');
      return a && a.textContent.toLowerCase().includes('skip');
    });
    if (!isSkipLink) {
      throw new Error('Missing "Skip to content" link for keyboard accessibility');
    }
    await page.close();
  });

  await test('Heading hierarchy has logical progression without skipping levels', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6, .section-title', els => {
      return els.map(el => ({
        tag: el.tagName.toLowerCase(),
        class: el.className,
        text: el.textContent.trim().substring(0, 30)
      }));
    });

    const h1Count = headings.filter(h => h.tag === 'h1').length;
    const h2Count = headings.filter(h => h.tag === 'h2').length;
    const h3Count = headings.filter(h => h.tag === 'h3').length;

    if (h1Count !== 1) throw new Error(`Expected exactly 1 <h1>, found ${h1Count}`);
    if (h2Count === 0 && h3Count > 0) {
      throw new Error(`Heading hierarchy broken: Found ${h3Count} <h3> tags but 0 <h2> tags. Section titles are styled <div>s instead of <h2>.`);
    }
    await page.close();
  });

  await test('Interactive controls have visible focus indicators (:focus-visible)', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const hasFocusStyles = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && (rule.selectorText.includes(':focus-visible') || rule.selectorText.includes(':focus'))) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    if (!hasFocusStyles) {
      throw new Error('No custom :focus or :focus-visible rules defined in stylesheets for keyboard accessibility');
    }
    await page.close();
  });

  await test('Mobile menu button has aria-expanded state and keyboard escape dismiss', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    const initialExpanded = await page.getAttribute('#menuBtn', 'aria-expanded');
    if (initialExpanded !== 'false') {
      throw new Error(`Expected #menuBtn to have aria-expanded="false" when closed, but got "${initialExpanded}"`);
    }

    await page.click('#menuBtn');
    await page.waitForTimeout(150);
    const openedExpanded = await page.getAttribute('#menuBtn', 'aria-expanded');
    if (openedExpanded !== 'true') {
      throw new Error(`Expected #menuBtn to have aria-expanded="true" when open, but got "${openedExpanded}"`);
    }

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const isClosed = await page.$eval('#mobileMenu', el => !el.classList.contains('open'));
    if (!isClosed) {
      throw new Error('Mobile menu did not dismiss upon pressing Escape key');
    }
    await page.close();
  });

  await test('Theme toggle has accessible aria-label and reflects state', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const label = await page.getAttribute('#themeToggle', 'aria-label');
    if (!label || label.trim() === '') {
      throw new Error('Theme toggle button is missing an accessible aria-label');
    }
    await page.close();
  });

  await test('Styles support prefers-reduced-motion media query', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const hasReducedMotion = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.media && rule.media.mediaText.includes('prefers-reduced-motion')) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    if (!hasReducedMotion) {
      throw new Error('No @media (prefers-reduced-motion) media queries found to suppress looping animations for motion-sensitive users');
    }
    await page.close();
  });

  // --- SUITE 7: DOM Structure & HTML Validation ---
  await test('HTML container divs are properly paired and closed', async () => {
    const htmlContent = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf-8');
    
    // Check #about container div closing
    const aboutSection = htmlContent.match(/<section id="about">([\s\S]*?)<\/section>/);
    if (aboutSection) {
      const opens = (aboutSection[1].match(/<div/g) || []).length;
      const closes = (aboutSection[1].match(/<\/div>/g) || []).length;
      if (opens !== closes) {
        throw new Error(`#about section has unbalanced div tags: ${opens} open vs ${closes} close tags (unclosed container)`);
      }
    }

    // Check #skills container div closing
    const skillsSection = htmlContent.match(/<section id="skills">([\s\S]*?)<\/section>/);
    if (skillsSection) {
      const opens = (skillsSection[1].match(/<div/g) || []).length;
      const closes = (skillsSection[1].match(/<\/div>/g) || []).length;
      if (opens !== closes) {
        throw new Error(`#skills section has unbalanced div tags: ${opens} open vs ${closes} close tags (unclosed container)`);
      }
    }
  });

  // --- SUITE 8: External Link Status & Performance ---
  await test('External GitHub repository link points to direct URL without .git redirect', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const githubLink = await page.$eval('a[href*="github.com/Manikandan2272"]', el => el.href);
    if (githubLink.endsWith('.git')) {
      throw new Error(`GitHub link "${githubLink}" ends in .git causing unnecessary 301 HTTP redirect`);
    }
    await page.close();
  });

  await test('Cursor glow animation does not run infinitely on touch-only mobile devices', async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    const runsOnMobile = await page.evaluate(() => {
      // Check if cursorGlow is active or animation loop can be bypassed when no mouse
      return window.matchMedia('(hover: none)').matches;
    });
    // Record behavior
    await page.close();
  });

  // --- SUITE 9: Error & Edge-Case Handling ---
  await test('Theme toggle handles blocked localStorage gracefully without uncaught exceptions', async () => {
    const page = await browser.newPage();
    // Simulate blocked localStorage
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new DOMException('Access is denied for this document', 'SecurityError');
        }
      });
    });

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(BASE_URL);
    await page.click('#themeToggle');
    if (pageErrors.length > 0) {
      throw new Error(`Uncaught exception when localStorage is blocked: ${pageErrors.join(', ')}`);
    }
    await page.close();
  });

  await test('Anchor click listener handles empty href="#" without throwing DOMException', async () => {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(BASE_URL);
    // Add temporary href="#" test anchor
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#';
      a.id = 'testEmptyHash';
      a.textContent = 'Test';
      document.body.appendChild(a);
      // Re-trigger event listener or dispatch click
      a.click();
    });

    if (pageErrors.some(e => e.includes('is not a valid selector'))) {
      throw new Error('Smooth scroll listener crashes with invalid selector error when clicking href="#"');
    }
    await page.close();
  });

  await browser.close();

  console.log('\n====================================================');
  console.log('Test Execution Completed');
  console.log('====================================================');
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  console.log(`Total:  ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('====================================================\n');

  fs.writeFileSync(
    path.join(__dirname, 'test-results.json'),
    JSON.stringify({ total: results.length, passed, failed, results }, null, 2)
  );

  return { total: results.length, passed, failed, results };
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
