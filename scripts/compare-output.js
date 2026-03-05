const { parseAspire9 } = require('../src/server/parsers/aspire9');
const { convertToMillMage } = require('../src/server/converters/to-millmage');
const fs = require('fs');

function compare(label, toolsPath, fixedPath) {
  const tools = parseAspire9(toolsPath);
  const result = convertToMillMage(tools);
  const output = result.output;
  const fixed = JSON.parse(fs.readFileSync(fixedPath, 'utf8'));

  console.log('\n=== ' + label + ' ===');
  console.log('Tools found:', tools.length, '| Compatible:', result.stats.compatible);

  const category = Object.keys(output)[0];
  const convertedTools = Object.values(output[category] || {});
  const fixedCategory = Object.keys(fixed)[0];
  const fixedTools = Object.values(fixed[fixedCategory] || {});

  console.log('Converted:', convertedTools.length, '| Fixed:', fixedTools.length);

  const fields = ['Diameter','FeedRate','PlungeRate','PassDepth','StepOver','IncludedAngle','Length','Radius','MetricTool','FluteCount','SpindleSpeed'];

  for (const ct of convertedTools) {
    const ft = fixedTools.find(f => f.Name === ct.Name);
    if (!ft) { console.log('  NOT IN FIXED: ' + ct.Name); continue; }
    const diffs = [];
    for (const k of fields) {
      if (typeof ct[k] === 'number' && typeof ft[k] === 'number') {
        if (Math.abs(ct[k] - ft[k]) > 0.1) {
          diffs.push(k + ': got ' + ct[k].toFixed(3) + ' expected ' + ft[k].toFixed(3));
        }
      } else if (ct[k] !== ft[k]) {
        diffs.push(k + ': got ' + ct[k] + ' expected ' + ft[k]);
      }
    }
    if (diffs.length > 0) console.log('  DIFF ' + ct.Name + ':\n    ' + diffs.join('\n    '));
    else console.log('  OK: ' + ct.Name);
  }
}

compare('METRIC',
  'ToolDatabases/Clean Aspire Libraries/Aspire9DefaultMetric.tool',
  'ToolDatabases/CurrentState-Examples/Aspire9DefaultMetric-fixed.tools');

compare('IMPERIAL',
  'ToolDatabases/Clean Aspire Libraries/Aspire9DefaultImperial1.tool',
  'ToolDatabases/CurrentState-Examples/Aspire9DefaultImperial-fixed.tools');
