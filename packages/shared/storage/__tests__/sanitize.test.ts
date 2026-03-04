import { describe, it, expect } from 'vitest';
import { sanitizeFilename, sanitizeSvg } from '../sanitize';

describe('sanitizeFilename', () => {
  it('passes through safe filenames unchanged', () => {
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
    expect(sanitizeFilename('my-image.png')).toBe('my-image.png');
    expect(sanitizeFilename('document_v2.docx')).toBe('document_v2.docx');
  });

  it('replaces path separators with underscores', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
  });

  it('neutralizes path traversal sequences', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('..');
    expect(result).toContain('etc_passwd');
  });

  it('removes null bytes', () => {
    expect(sanitizeFilename('file\x00name.txt')).toBe('filename.txt');
  });

  it('replaces control characters with underscores', () => {
    expect(sanitizeFilename('file\x1Fname.txt')).toBe('file_name.txt');
  });

  it('replaces unsafe shell characters', () => {
    expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
  });

  it('collapses consecutive dots', () => {
    expect(sanitizeFilename('file...txt')).toBe('file.txt');
    expect(sanitizeFilename('file....hidden.txt')).toBe('file.hidden.txt');
    expect(sanitizeFilename('no..dots..here.txt')).toBe('no.dots.here.txt');
  });

  it('collapses consecutive whitespace', () => {
    expect(sanitizeFilename('my   file   name.txt')).toBe('my file name.txt');
  });

  it('replaces tab and control characters with underscores', () => {
    expect(sanitizeFilename('tab\there.txt')).toBe('tab_here.txt');
  });

  it('trims leading/trailing whitespace and dots', () => {
    expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
    expect(sanitizeFilename('.hidden')).toBe('hidden');
  });

  it('removes path traversal dots', () => {
    const result = sanitizeFilename('...file.txt...');
    expect(result).not.toContain('..');
    expect(result).toContain('file');
  });

  it('enforces 255 character limit', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('preserves extension when truncating long names', () => {
    const longName = 'x'.repeat(260) + '.docx';
    const result = sanitizeFilename(longName);
    expect(result.endsWith('.docx')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('truncates without extension preservation for very long extensions', () => {
    const longName = 'a'.repeat(200) + '.' + 'b'.repeat(60);
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('returns "unnamed" for empty filenames', () => {
    expect(sanitizeFilename('')).toBe('unnamed');
    expect(sanitizeFilename('   ')).toBe('unnamed');
    expect(sanitizeFilename('...')).toBe('unnamed');
  });

  it('handles Unicode filenames', () => {
    const result = sanitizeFilename('日本語ファイル.pdf');
    expect(result).toContain('.pdf');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('sanitizeSvg', () => {
  it('removes <script> elements', () => {
    const input = '<svg><script>alert("xss")</script><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<rect/>');
  });

  it('removes multi-line <script> elements', () => {
    const input = `<svg>
      <script>
        document.cookie;
        fetch("evil.com");
      </script>
      <circle/>
    </svg>`;
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('document.cookie');
    expect(result).toContain('<circle/>');
  });

  it('removes self-closing <script/> tags', () => {
    const input = '<svg><script src="evil.js"/><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<script');
  });

  it('removes <foreignObject> elements', () => {
    const input = '<svg><foreignObject><div>HTML injection</div></foreignObject></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('<foreignObject');
    expect(result).not.toContain('HTML injection');
  });

  it('removes on* event handler attributes', () => {
    const input = '<svg><rect onclick="alert(1)" onload="fetch(\'evil\')" /></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).toContain('<rect');
  });

  it('removes onerror handlers', () => {
    const input = '<svg><image onerror="alert(1)" href="img.png"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('onerror');
  });

  it('removes javascript: URIs in href', () => {
    const input = '<svg><a href="javascript:alert(1)"><text>Click</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('javascript:');
  });

  it('removes data: URIs in href', () => {
    const input = '<svg><a href="data:text/html,<script>alert(1)</script>"><text>X</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('data:');
  });

  it('removes xlink:href javascript URIs', () => {
    const input = '<svg><use xlink:href="javascript:alert(1)"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe SVG content', () => {
    const input = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#ff0000"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).toBe(input);
  });

  it('preserves safe href attributes', () => {
    const input = '<svg><a href="https://example.com"><text>Link</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).toContain('href="https://example.com"');
  });
});
