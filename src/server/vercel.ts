import type { Request, Response } from 'express';
import { createApp } from './app.js';

const app = createApp();

/**
 * Vercel Serverless Function entrypoint.
 * Normalizes rewritten paths (e.g. from vercel.json ?__vercel_path=/api/...)
 * so Express routes (/api/health, /api/gemini/chat, etc.) always match reliably.
 */
export default function handler(req: Request, res: Response) {
  try {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__vercel_path');

    if (rewrittenPath) {
      parsed.searchParams.delete('__vercel_path');
      const normalizedPath = rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`;
      const qs = parsed.searchParams.toString();
      req.url = qs ? `${normalizedPath}?${qs}` : normalizedPath;
    } else if (parsed.pathname === '/api/index' || parsed.pathname === '/api/index.js') {
      const original = req.headers['x-vercel-original-url'] || req.headers['x-matched-path'];
      if (typeof original === 'string' && original.startsWith('/api/') && !original.startsWith('/api/index')) {
        const qs = parsed.searchParams.toString();
        req.url = qs ? `${original}?${qs}` : original;
      }
    }

    return app(req, res);
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: 'error',
        scope: 'vercel-handler',
        category: 'deployment',
        errorCode: 'VERCEL_HANDLER_ERROR',
        message: String(err?.message || err).slice(0, 300),
        timestamp: new Date().toISOString(),
      })
    );
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Vercel Serverless 端點處理發生異常，請查看伺服器錯誤紀錄。',
        errorCode: 'VERCEL_HANDLER_ERROR',
        errorCategory: 'deployment',
      });
    }
  }
}
