import { describe, it, expect } from 'vitest';
import { formatMoney, escHtml, parseNum, parseIntNum, getTodayStr } from '../utils.js';

describe('formatMoney', () => {
  it('formats number as ARS currency', () => {
    const result = formatMoney(1500.5);
    expect(result).toContain('$');
    expect(result).toContain('1.500');
  });

  it('returns em dash for null/undefined', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(NaN)).toBe('—');
  });
});

describe('escHtml', () => {
  it('escapes HTML special chars', () => {
    expect(escHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('returns empty string for falsy input', () => {
    expect(escHtml('')).toBe('');
    expect(escHtml(null)).toBe('');
    expect(escHtml(undefined)).toBe('');
  });
});

describe('parseNum', () => {
  it('parses ARS formatted numbers', () => {
    expect(parseNum('1.500,50')).toBe(1500.50);
    expect(parseNum('59.000,00')).toBe(59000);
  });

  it('handles dot as decimal separator', () => {
    expect(parseNum('1500.50')).toBe(1500.50);
  });

  it('returns 0 for invalid input', () => {
    expect(parseNum('')).toBe(0);
    expect(parseNum(null)).toBe(0);
    expect(parseNum('abc')).toBe(0);
  });
});

describe('parseIntNum', () => {
  it('parses and rounds to integer', () => {
    expect(parseIntNum('1.500,75')).toBe(1501);
    expect(parseIntNum('42')).toBe(42);
  });
});

describe('getTodayStr', () => {
  it('returns ISO date string', () => {
    const result = getTodayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
