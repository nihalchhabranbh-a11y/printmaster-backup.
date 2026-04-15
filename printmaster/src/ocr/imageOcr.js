import Tesseract from "tesseract.js";

export async function runPurchaseOcr(imageSource) {
  if (!imageSource) {
    throw new Error("No image provided for OCR");
  }

  try {
    const { data } = await Tesseract.recognize(imageSource, "eng", {
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz./-:,() ",
    });
    return (data.text || "").replace(/\r/g, "\n").trim();
  } catch (e) {
    console.error("OCR failed", e);
    throw new Error("Failed to read text from image");
  }
}

