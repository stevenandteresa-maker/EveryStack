/**
 * GotenbergClient — HTTP client for Gotenberg's Chromium HTML→PDF endpoint.
 *
 * Posts an HTML file to /forms/chromium/convert/html and returns the
 * generated PDF as a Buffer.
 *
 * @see docs/reference/smart-docs.md § Rendering Pipelines
 * @see docs/reference/smart-docs.md § Backend Requirements
 */

import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'gotenberg-client' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GotenbergConvertOptions {
  /** Paper width override in inches (Gotenberg default: 8.5). */
  paperWidth?: number;
  /** Paper height override in inches (Gotenberg default: 11). */
  paperHeight?: number;
  /** Top margin in inches. */
  marginTop?: number;
  /** Bottom margin in inches. */
  marginBottom?: number;
  /** Left margin in inches. */
  marginLeft?: number;
  /** Right margin in inches. */
  marginRight?: number;
  /** Print background graphics. Defaults to true. */
  printBackground?: boolean;
  /** Page orientation — 'landscape' to enable. */
  landscape?: boolean;
  /** Request timeout in milliseconds. Defaults to 30 000. */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

function getGotenbergUrl(): string {
  const url = process.env.GOTENBERG_URL;
  if (!url) {
    throw new Error(
      'GOTENBERG_URL environment variable is not set. ' +
      'Gotenberg is required for PDF generation.',
    );
  }
  return url.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class GotenbergClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    const url = baseUrl ?? getGotenbergUrl();
    this.baseUrl = url.replace(/\/+$/, '');
  }

  /**
   * Convert an HTML string to PDF via Gotenberg's Chromium endpoint.
   *
   * Sends a multipart/form-data POST to /forms/chromium/convert/html
   * with the HTML as a file upload named `index.html`.
   *
   * @returns The generated PDF as a Buffer.
   * @throws On HTTP errors, timeouts, or connection failures.
   */
  async convertHTMLToPDF(
    html: string,
    options?: GotenbergConvertOptions,
  ): Promise<Buffer> {
    const url = `${this.baseUrl}/forms/chromium/convert/html`;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const formData = new FormData();

    // Gotenberg expects the HTML as a file upload named "index.html"
    const htmlBlob = new Blob([html], { type: 'text/html' });
    formData.append('files', htmlBlob, 'index.html');

    // Optional Chromium conversion properties
    if (options?.paperWidth != null) {
      formData.append('paperWidth', String(options.paperWidth));
    }
    if (options?.paperHeight != null) {
      formData.append('paperHeight', String(options.paperHeight));
    }
    if (options?.marginTop != null) {
      formData.append('marginTop', String(options.marginTop));
    }
    if (options?.marginBottom != null) {
      formData.append('marginBottom', String(options.marginBottom));
    }
    if (options?.marginLeft != null) {
      formData.append('marginLeft', String(options.marginLeft));
    }
    if (options?.marginRight != null) {
      formData.append('marginRight', String(options.marginRight));
    }
    if (options?.printBackground !== undefined) {
      formData.append('printBackground', String(options.printBackground));
    }
    if (options?.landscape) {
      formData.append('landscape', 'true');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.info({ url, timeoutMs }, 'gotenberg: converting HTML to PDF');

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(unreadable)');
        throw new Error(
          `Gotenberg returned HTTP ${response.status}: ${errorBody}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(
          `Gotenberg request timed out after ${timeoutMs}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
