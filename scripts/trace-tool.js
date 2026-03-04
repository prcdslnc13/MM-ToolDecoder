'use strict';
const { parseAspire9 } = require('/app/src/server/parsers/aspire9');
const { parseAspire12 } = require('/app/src/server/parsers/aspire12');
const { convertToMillMage } = require('/app/src/server/converters/to-millmage');

function dumpAll(label, filePath, parserFn) {
  process.stdout.write('\n=== ' + label + ' ===\n');
  const tools = parserFn(filePath);
  if (!tools.length) { process.stdout.write('  (no tools parsed)\n'); return; }
  tools.forEach(t => {
    process.stdout.write(
      '  [' + (t.compatible ? 'OK' : '--') + '] ' + t.name +
      '  passDepth=' + t.passDepth +
      '  plungeRate=' + t.plungeRate +
      '  feedRate=' + t.feedRate +
      '  metric=' + t.metricTool + '\n'
    );
  });

  // Also run full convert and spot-check first compatible tool
  const { output } = convertToMillMage(tools, {});
  const cats = Object.keys(output);
  if (!cats.length) { process.stdout.write('  (no compatible tools converted)\n'); return; }
  const cat = cats[0];
  const uuid = Object.keys(output[cat])[0];
  const out = output[cat][uuid];
  process.stdout.write('  First converted: ' + out.Name + '\n');
  process.stdout.write('    PassDepth='  + out.PassDepth  + '\n');
  process.stdout.write('    PlungeRate=' + out.PlungeRate + '\n');
  process.stdout.write('    FeedRate='   + out.FeedRate   + '\n');
}

dumpAll('Aspire9 Imperial (.tool)',    '/dbs/Aspire9DefaultImperial.tool',    parseAspire9);
dumpAll('Aspire9 Imperial (.tool_db)', '/dbs/Aspire9DefaultImperial.tool_db', parseAspire9);
dumpAll('Aspire9 Metric (.tool)',      '/dbs/Aspire9DefaultMetric.tool',      parseAspire9);
dumpAll('Aspire9 Metric (.tool_db)',   '/dbs/Aspire9DefaultMetric.tool_db',   parseAspire9);
dumpAll('Aspire12',                    '/dbs/aspire12.vtdb',                  parseAspire12);
