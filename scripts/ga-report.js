// ga-report.js - Pull traffic stats from the GA4 Data API
//
// Setup (one time):
//   1. Put the numeric GA4 property ID in .secrets/ga-property-id
//      (or export GA4_PROPERTY_ID)
//   2. Authenticate, either way:
//      a. Drop a service account JSON key at .secrets/ga-service-account.json, or
//      b. Run: gcloud auth application-default login \\
//           --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/analytics.readonly"
//   .secrets/ is gitignored.
//
// Usage:
//   node scripts/ga-report.js                 # last 28 days, all reports
//   node scripts/ga-report.js --days 90
//   node scripts/ga-report.js --report pages --limit 25
//   node scripts/ga-report.js --json          # machine-readable output

const fs = require('fs');
const path = require('path');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const SECRETS_DIR = path.join(__dirname, '../.secrets');
const KEY_PATH = path.join(SECRETS_DIR, 'ga-service-account.json');
const PROPERTY_PATH = path.join(SECRETS_DIR, 'ga-property-id');

// --- args ---------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const days = parseInt(flag('days', '28'), 10);
const limit = parseInt(flag('limit', '15'), 10);
const which = flag('report', 'all');
const asJson = args.includes('--json');

// --- credentials --------------------------------------------------------
function resolvePropertyId() {
  if (process.env.GA4_PROPERTY_ID) return process.env.GA4_PROPERTY_ID.trim();
  if (fs.existsSync(PROPERTY_PATH)) return fs.readFileSync(PROPERTY_PATH, 'utf8').trim();
  return null;
}

const propertyId = resolvePropertyId();

const hasKeyFile = fs.existsSync(KEY_PATH);

if (!propertyId) {
  console.error(`Missing GA4 property ID. Write it to ${PROPERTY_PATH} or set GA4_PROPERTY_ID.`);
  console.error('Find it in GA: Admin > Property Settings > Property ID (a number like 123456789).');
  process.exit(1);
}

// With no key file, fall back to Application Default Credentials (gcloud auth).
const client = new BetaAnalyticsDataClient(hasKeyFile ? { keyFilename: KEY_PATH } : {});
const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

// --- reports ------------------------------------------------------------
async function runReport({ dimensions = [], metrics, orderBy, rowLimit }) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges,
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name })),
    orderBys: orderBy ? [orderBy] : undefined,
    limit: rowLimit,
  });
  const headers = [
    ...(response.dimensionHeaders || []).map(h => h.name),
    ...(response.metricHeaders || []).map(h => h.name),
  ];
  const rows = (response.rows || []).map(row => [
    ...(row.dimensionValues || []).map(v => v.value),
    ...(row.metricValues || []).map(v => v.value),
  ]);
  return { headers, rows };
}

const byMetricDesc = metric => ({ metric: { metricName: metric }, desc: true });

const REPORTS = {
  overview: () => runReport({
    metrics: ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration'],
  }),
  pages: () => runReport({
    dimensions: ['pagePath', 'pageTitle'],
    metrics: ['screenPageViews', 'activeUsers', 'averageSessionDuration'],
    orderBy: byMetricDesc('screenPageViews'),
    rowLimit: limit,
  }),
  sources: () => runReport({
    dimensions: ['sessionSource', 'sessionMedium'],
    metrics: ['sessions', 'activeUsers'],
    orderBy: byMetricDesc('sessions'),
    rowLimit: limit,
  }),
  countries: () => runReport({
    dimensions: ['country'],
    metrics: ['activeUsers', 'sessions'],
    orderBy: byMetricDesc('activeUsers'),
    rowLimit: limit,
  }),
  daily: () => runReport({
    dimensions: ['date'],
    metrics: ['activeUsers', 'screenPageViews'],
    orderBy: { dimension: { dimensionName: 'date' }, desc: false },
    rowLimit: days + 1, // range is inclusive of both endpoints
  }),
};

// --- output -------------------------------------------------------------
function printTable(name, { headers, rows }) {
  console.log(`\n== ${name} ==`);
  if (!rows.length) {
    console.log('(no data)');
    return;
  }
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const line = cells => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  rows.forEach(r => console.log(line(r)));
}

async function main() {
  const names = which === 'all' ? Object.keys(REPORTS) : which.split(',');
  const unknown = names.filter(n => !REPORTS[n]);
  if (unknown.length) {
    console.error(`Unknown report(s): ${unknown.join(', ')}`);
    console.error(`Available: ${Object.keys(REPORTS).join(', ')}, all`);
    process.exit(1);
  }

  const output = {};
  for (const name of names) {
    output[name] = await REPORTS[name]();
  }

  if (asJson) {
    console.log(JSON.stringify({ propertyId, days, reports: output }, null, 2));
  } else {
    console.log(`GA4 property ${propertyId} - last ${days} days`);
    names.forEach(name => printTable(name, output[name]));
  }
}

main().catch(err => {
  console.error(`GA request failed: ${err.message}`);
  if (err.code === 7 && /has not been used in project|is disabled/i.test(err.message)) {
    console.error('Enable the Google Analytics Data API on the Cloud project, then wait a minute and retry.');
  } else if (err.code === 7) {
    console.error('Permission denied - the caller needs Viewer access on the GA4 property.');
  }
  if (!hasKeyFile && /credential|authenticat/i.test(err.message)) {
    console.error(`No credentials found. Add a key at ${KEY_PATH}, or run:`);
    console.error('  gcloud auth application-default login \\');
    console.error('    --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/analytics.readonly"');
  }
  process.exit(1);
});
