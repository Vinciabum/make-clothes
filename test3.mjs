import { GoogleGenAI } from "@google/genai";
import crypto from 'crypto';
import fs from "fs";
import path from "path";

const envFilePath = path.resolve(".env.local");
const envFileContents = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, "utf8") : "";
const envLine = envFileContents
  .split(/\r?\n/)
  .find((line) => line.startsWith("GEMINI_API_KEY=") || line.startsWith("API_KEY="));
const apiKey = envLine?.split("=").slice(1).join("=")?.trim() || process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY or API_KEY is required.");
}

const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log("Testing LARGE IMAGE-to-IMAGE model...");
  
  // Create a dummy 5MB random base64 string to simulate a large portrait photo
  // Actually, Gemini API rejects invalid base64 images, so we need a valid one or just a reasonably large valid image.
  // I will generate a valid large black square image using an SVG converted to base64, or just a known valid base64.
  const svg = `<svg width="2000" height="2000" xmlns="http://www.w3.org/2000/svg"><rect width="2000" height="2000" fill="red"/></svg>`;
  const base64Data = Buffer.from(svg).toString('base64');
  
  try {
    const res = await ai.models.generateContent({ 
      model: "gemini-3.1-flash-image-preview", 
      contents: {
        parts: [
          { text: "Change the clothing to a suit" },
          { inlineData: { mimeType: "image/svg+xml", data: base64Data } },
        ],
      }
    });
    console.log("[LARGE IMAGE RESULT]: SUCCESS!");
  } catch (e) {
    console.error("[LARGE IMAGE ERROR]:", e.message);
  }

  console.log("Testing INVALID API KEY...");
  const aiInvalid = new GoogleGenAI({ apiKey: "PLACEHOLDER_API_KEY" });
  try {
    await aiInvalid.models.generateContent({ model: "gemini-3.1-flash-image-preview", contents: "test" });
  } catch (e) {
    console.error("[INVALID KEY ERROR]:", e.message);
  }
}

run();
