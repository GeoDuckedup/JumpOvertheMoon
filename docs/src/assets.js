export class AssetLoader {
  constructor(manifest) {
    this.manifest = [...manifest];
    this.images = new Map();
    this.failures = [];
  }

  async load(onProgress = () => {}) {
    let completed = 0;
    const total = this.manifest.length;
    onProgress({ completed, total, ratio: total ? 0 : 1, id: null });

    await Promise.all(
      this.manifest.map(async (record) => {
        try {
          const image = await this.#loadImage(record.src);
          this.images.set(record.id, image);
        } catch (error) {
          this.failures.push({
            id: record.id,
            src: record.src,
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          completed += 1;
          onProgress({
            completed,
            total,
            ratio: total ? completed / total : 1,
            id: record.id,
          });
        }
      }),
    );

    return {
      images: this.images,
      failures: [...this.failures],
      loaded: this.images.size,
      total,
    };
  }

  #loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = async () => {
        if (typeof image.decode === "function") {
          try {
            await image.decode();
          } catch {
            // The load event already proves the bitmap is available. Some Safari
            // versions reject decode() after a successful eager decode.
          }
        }
        resolve(image);
      };
      image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
      image.src = src;
    });
  }
}
