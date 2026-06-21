import { describe, expect, it } from 'vitest';
import { countryFlag, formatNumber, riskLevel, timeAgo } from './format';

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('handles null', () => {
    expect(formatNumber(null)).toBe('0');
  });
});

describe('riskLevel', () => {
  it('maps scores to levels at the documented boundaries', () => {
    expect(riskLevel(0)).toBe('low');
    expect(riskLevel(24)).toBe('low');
    expect(riskLevel(25)).toBe('review');
    expect(riskLevel(50)).toBe('elevated');
    expect(riskLevel(75)).toBe('high');
    expect(riskLevel(100)).toBe('high');
  });
});

describe('countryFlag', () => {
  it('returns a flag emoji for a valid code', () => {
    expect(countryFlag('US')).toBe('🇺🇸');
  });
  it('returns a globe for invalid input', () => {
    expect(countryFlag(null)).toBe('🌐');
    expect(countryFlag('XYZ')).toBe('🌐');
  });
});

describe('timeAgo', () => {
  it('handles missing input', () => {
    expect(timeAgo(null)).toBe('—');
  });
  it('returns seconds for very recent times', () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    expect(timeAgo(tenSecondsAgo)).toMatch(/s ago/);
  });
});
