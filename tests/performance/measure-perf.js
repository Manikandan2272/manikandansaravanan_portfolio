const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080/';

async function measurePerformance() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Track network requests
  const requests = [];
  page.on('request', req => {
    requests.push({ url: req.url(), resourceType: req.resourceType() });
  });

  const startTime = Date.now();
  await page.goto(BASE_URL, { waitUntil: 'load' });
  const loadTime = Date.now() - startTime;

  // Web Vitals & Navigation Timing
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0;
    
    return {
      dns: nav ? nav.domainLookupEnd - nav.domainLookupStart : 0,
      tcp: nav ? nav.connectEnd - nav.connectStart : 0,
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      domInteractive: nav ? nav.domInteractive : 0,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      loadEvent: nav ? nav.loadEventEnd - nav.startTime : 0,
      fcp: Math.round(fcp),
      transferSize: nav ? nav.transferSize : 0
    };
  });

  // Calculate DOM element count
  const domStats = await page.evaluate(() => {
    return {
      elementCount: document.querySelectorAll('*').length,
      imageCount: document.querySelectorAll('img').length,
      scriptCount: document.querySelectorAll('script').length,
      styleCount: document.querySelectorAll('style, link[rel="stylesheet"]').length,
      svgCount: document.querySelectorAll('svg').length
    };
  });

  await browser.close();

  const perfReport = {
    url: BASE_URL,
    totalRequests: requests.length,
    requestsByType: requests.reduce((acc, r) => {
      acc[r.resourceType] = (acc[r.resourceType] || 0) + 1;
      return acc;
    }, {}),
    timing,
    domStats,
    measuredAt: new Date().toISOString()
  };

  console.log('Performance Metrics:', JSON.stringify(perfReport, null, 2));
  fs.writeFileSync(path.join(__dirname, 'perf-report.json'), JSON.stringify(perfReport, null, 2));
}

measurePerformance().catch(console.error);
