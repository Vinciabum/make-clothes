import { GoogleGenAI } from "@google/genai";
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
  console.log("Testing IMAGE-to-IMAGE model (gemini-3.1-flash-image-preview)...");
  
  // Create a dummy transparent 1x1 PNG base64
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  try {
    const res = await ai.models.generateContent({ 
      model: "gemini-3.1-flash-image-preview", 
      contents: {
        parts: [
          { text: "Change the clothing to a suit" },
          { inlineData: { mimeType: "image/png", data: dummyBase64 } },
        ],
      }
    });
    console.log("[IMAGE-TO-IMAGE RESULT]: SUCCESS!");
  } catch (e) {
    console.error("[IMAGE-TO-IMAGE ERROR]:", e.message);
  }
}

run();
