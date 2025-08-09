import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

// ✅ Use the correct environment variable name for the LOCAL TYPE
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey });

/**
 * Generates a stylized cartoon image using the Imagen 3 model.
 * @param objectName The name of the object to feature in the image (e.g., "peacock").
 * @returns A promise that resolves to the base64 encoded PNG image string.
 */
export const generateAiImage = async (objectName: string): Promise<string> => {
  const prompt = `A cute, happy, cartoon-style ${objectName}, drawn in a style similar to Disney or Pixar animation. The character should be the only subject. IMPORTANT: The background must be fully transparent. The character should be joyful and centered, suitable for a celebration.`;

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '1:1',
      },
    });

    if (
      response.generatedImages &&
      response.generatedImages.length > 0 &&
      response.generatedImages[0].image.imageBytes
    ) {
      return response.generatedImages[0].image.imageBytes;
    } else {
      console.error("AI response was empty or did not contain image data.", response);
      throw new Error("AI failed to generate an image. The response was empty.");
    }
  } catch (error) {
    console.error("Error generating AI image with Gemini:", error);
    throw new Error("Could not generate image. Please try again.");
  }
};