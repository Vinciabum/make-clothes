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
  console.log("==========================================");
  console.log("1. Testing TEXT model (gemini-2.5-flash)...");
  try {
    const res = await ai.models.generateContent({ 
      model: "gemini-2.5-flash", 
      contents: "Hello, just simply output the word SUCCESS." 
    });
    console.log("[TEXT RESULT]:", res.text);
  } catch (e) {
    console.error("[TEXT ERROR]:", e.message);
  }

  console.log("\n==========================================");
  console.log("2. Testing IMAGE model (gemini-3.1-flash-image-preview)...");
  try {
    const res = await ai.models.generateContent({ 
      model: "gemini-3.1-flash-image-preview", 
      contents: "Draw a small red ball." 
    });
    console.log("[IMAGE RESULT]: SUCCESS! Images generated.");
  } catch (e) {
    console.error("[IMAGE ERROR]:", e.message);
  }
}

run();
