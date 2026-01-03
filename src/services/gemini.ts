import { GoogleGenAI } from "@google/genai";

// 2. Google Apps Script Web App URL for File Uploads (Proxy)
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywVx70i2DXMf90cuMkE84Jn3rNlIr6dQJwXdoVx7l9kzzSXU-9uxn1MnrbWnJRRu6b/exec"; 

export const callGemini = async (prompt: string): Promise<string | null> => {
  try {
    // FIX: Use process.env.API_KEY as required by GenAI SDK guidelines.
    // Ensure the environment variable is configured.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "Could not generate response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};