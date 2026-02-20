const MM_PER_INCH = 25.4;

// Convert inches to mm
function inToMm(value) {
  return value * MM_PER_INCH;
}

// Convert mm to inches
function mmToIn(value) {
  return value / MM_PER_INCH;
}

// Convert feed rate to mm/sec based on rate_units
// Aspire rate_units: 0 = mm/sec, 4 = inches/min
function aspireRateToMmPerSec(value, rateUnits) {
  if (rateUnits === 0) return value; // already mm/sec
  if (rateUnits === 4) return (value / 60) * MM_PER_INCH; // in/min → mm/sec
  return value;
}

// Convert Aspire rate to the unit system's per-second rate
// For imperial tools: result in in/sec; for metric tools: result in mm/sec
function aspireRateToPerSec(value, rateUnits, isMetric) {
  if (rateUnits === 0) {
    // Source is mm/sec
    return isMetric ? value : mmToIn(value);
  }
  if (rateUnits === 4) {
    // Source is in/min
    const inPerSec = value / 60;
    return isMetric ? inToMm(inPerSec) : inPerSec;
  }
  return value;
}

// Convert Aspire dimension to mm based on units flag
// Aspire units: 0 = metric, 1 = imperial
function aspireDimToMm(value, units) {
  if (units === 1) return inToMm(value);
  return value;
}

module.exports = { MM_PER_INCH, inToMm, mmToIn, aspireRateToMmPerSec, aspireRateToPerSec, aspireDimToMm };
