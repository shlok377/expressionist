/**
 * Deep Expression Texture Cache Module.
 * Encapsulates off-thread ImageBitmap decoding, downsampling,
 * fallback image handling, and GPU texture lifecycle behind a clean texture interface.
 */
export class ExpressionTextureCache {
  constructor({
    width = 720,
    height = 960,
    fetcher = typeof fetch !== 'undefined' ? fetch : null,
    bitmapCreator = typeof window !== 'undefined' && window.createImageBitmap
      ? window.createImageBitmap.bind(window)
      : null,
  } = {}) {
    this.width = width;
    this.height = height;
    this.fetcher = fetcher;
    this.bitmapCreator = bitmapCreator;

    // Cache storing GPU-ready ImageBitmap or HTMLImageElement
    this.cache = new Map();

    // In-flight request deduplication map
    this.inFlight = new Map();
  }

  has(url) {
    return this.cache.has(url);
  }

  getTexture(url) {
    if (!url) return null;
    return this.cache.get(url) || null;
  }

  /**
   * Asynchronously fetches, decodes, downsamples, and caches a texture.
   * Deduplicates concurrent in-flight requests for the same URL.
   */
  async loadTexture(url) {
    if (!url) return null;

    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    if (this.inFlight.has(url)) {
      return this.inFlight.get(url);
    }

    const promise = this._load(url).finally(() => {
      this.inFlight.delete(url);
    });

    this.inFlight.set(url, promise);
    return promise;
  }

  async _load(url) {
    try {
      if (!this.fetcher) {
        throw new Error('No fetcher available');
      }

      const res = await this.fetcher(url);
      const blob = await res.blob();

      let texture = null;

      if (this.bitmapCreator) {
        try {
          // Off-thread GPU decoding with high-quality downsampling to 720x960
          texture = await this.bitmapCreator(blob, {
            resizeWidth: this.width,
            resizeHeight: this.height,
            resizeQuality: 'high',
          });
        } catch {
          // Fallback to off-thread decoding without resize options
          try {
            texture = await this.bitmapCreator(blob);
          } catch {
            texture = null;
          }
        }
      }

      // Fallback for environments lacking ImageBitmap support
      if (!texture && typeof Image !== 'undefined') {
        const img = new Image();
        img.src = url;
        if ('decode' in img) {
          try {
            await img.decode();
          } catch {}
        }
        texture = img;
      }

      if (texture) {
        this.cache.set(url, texture);
      }

      return texture;
    } catch (err) {
      console.warn('Failed to decode texture for', url, err);
      return null;
    }
  }

  /**
   * Pre-fetches and pre-decodes textures for all clips or expressions.
   */
  async preloadExpressions(items = []) {
    if (!Array.isArray(items)) return [];

    const promises = items.map((item) => {
      const url = item?.expression?.url || item?.url;
      return url ? this.loadTexture(url) : Promise.resolve(null);
    });

    return Promise.allSettled(promises);
  }

  /**
   * Calculates aspect-ratio preserving dimensions and offsets for letterboxing.
   */
  calculateLetterbox(imgWidth, imgHeight, canvasWidth = this.width, canvasHeight = this.height) {
    const imgAspect = (imgWidth && imgHeight) ? imgWidth / imgHeight : canvasWidth / canvasHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasAspect > imgAspect) {
      drawWidth = canvasHeight * imgAspect;
      offsetX = (canvasWidth - drawWidth) / 2;
    } else {
      drawHeight = canvasWidth / imgAspect;
      offsetY = (canvasHeight - drawHeight) / 2;
    }

    return { drawWidth, drawHeight, offsetX, offsetY };
  }

  /**
   * Disposes all cached GPU textures and clears memory.
   */
  clear() {
    for (const texture of this.cache.values()) {
      if (texture && typeof texture.close === 'function') {
        try {
          texture.close();
        } catch {}
      }
    }
    this.cache.clear();
    this.inFlight.clear();
  }
}
