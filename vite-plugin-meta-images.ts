import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin that updates og:image and twitter:image meta tags
 * to point to the app's opengraph image using an absolute URL, since
 * most social-media crawlers don't reliably resolve relative image URLs.
 */
export function metaImagesPlugin(): Plugin {
  return {
    name: 'vite-plugin-meta-images',
    transformIndexHtml(html) {
      const baseUrl = getDeploymentUrl();
      if (!baseUrl) {
        // vite build always sets process.env.NODE_ENV = "production"
        // internally regardless of caller, so that can't be used here to
        // distinguish a real deploy from a local/CI build — there's no
        // reliable signal in this hook for "this specific build is the one
        // that's about to go live." Left as a loud log rather than a hard
        // failure; the real regression guard for this lives in CI, which
        // greps the actual build output for the placeholder with a realistic
        // APP_URL set, and separately with it unset to prove this exact
        // code path is reachable and correctly leaves the marker in place.
        log('[meta-images] no APP_URL configured, skipping meta tag updates');
        return html;
      }

      // Check if opengraph image exists in public directory
      const publicDir = path.resolve(process.cwd(), 'client', 'public');
      const opengraphPngPath = path.join(publicDir, 'opengraph.png');
      const opengraphJpgPath = path.join(publicDir, 'opengraph.jpg');
      const opengraphJpegPath = path.join(publicDir, 'opengraph.jpeg');

      let imageExt: string | null = null;
      if (fs.existsSync(opengraphPngPath)) {
        imageExt = 'png';
      } else if (fs.existsSync(opengraphJpgPath)) {
        imageExt = 'jpg';
      } else if (fs.existsSync(opengraphJpegPath)) {
        imageExt = 'jpeg';
      }

      if (!imageExt) {
        log('[meta-images] OpenGraph image not found, skipping meta tag updates');
        return html;
      }

      const imageUrl = `${baseUrl}/opengraph.${imageExt}`;

      log('[meta-images] updating meta image tags to:', imageUrl);

      html = html.replace(
        /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/g,
        `<meta property="og:image" content="${imageUrl}" />`
      );

      html = html.replace(
        /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/g,
        `<meta name="twitter:image" content="${imageUrl}" />`
      );

      html = html.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/g,
        `<link rel="canonical" href="${baseUrl}/" />`
      );

      return html;
    },
  };
}

function getDeploymentUrl(): string | null {
  if (process.env.APP_URL) {
    log('[meta-images] using APP_URL:', process.env.APP_URL);
    return process.env.APP_URL.replace(/\/$/, '');
  }

  return null;
}

function log(...args: any[]): void {
  if (process.env.NODE_ENV === 'production') {
    console.log(...args);
  }
}
