export function loadAndResizeImage(file, maxWidth = 1600, maxHeight = 1600) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      return reject(new Error("loadAndResizeImage expects a File"));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const targetWidth = img.width * ratio;
        const targetHeight = img.height * ratio;

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          resolve(dataUrl);
        } catch (e) {
          resolve(reader.result);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

