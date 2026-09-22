const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080/';
const ARTIFACT_DIR = 'C:/Users/manik/.gemini/antigravity-ide/brain/d399aa74-174a-4021-8b20-1c459e13431c';

async function captureEvidence() {
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile role clipping evidence
  const mobilePage = await browser.newPage({ viewport: { width: 320, height: 667 } });
  await mobilePage.goto(BASE_URL);
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'BUG-001-mobile-role-clipping.png'),
    clip: { x: 0, y: 0, width: 320, height: 380 }
  });
  await mobilePage.close();

  // 2. Mobile drawer open
  const drawerPage = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await drawerPage.goto(BASE_URL);
  await drawerPage.click('#menuBtn');
  await drawerPage.waitForTimeout(200);
  await drawerPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'evidence-mobile-drawer.png')
  });
  await drawerPage.close();

  // 3. Desktop Light Mode
  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktopPage.goto(BASE_URL);
  await desktopPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'evidence-desktop-light.png')
  });

  // 4. Desktop Dark Mode
  await desktopPage.click('#themeToggle');
  await desktopPage.waitForTimeout(300);
  await desktopPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'evidence-desktop-dark.png')
  });

  // 5. ScrollSpy bottom mismatch
  await desktopPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await desktopPage.waitForTimeout(400);
  await desktopPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'BUG-002-active-nav-bottom-scrollspy.png')
  });

  await desktopPage.close();
  await browser.close();
  console.log('Visual evidence captured successfully in artifacts directory.');
}

captureEvidence().catch(console.error);
