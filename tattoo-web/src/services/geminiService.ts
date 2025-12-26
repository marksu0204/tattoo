
import { GoogleGenAI } from "@google/genai";

// Ideally, this should be proxied through a backend to hide the key, 
// but for this frontend-only demo, we access it from env.
const apiKey = process.env.API_KEY || ''; 

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export const generateArtworkDetails = async (keywords: string): Promise<{ description: string; tags: string[] }> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Returning mock data.");
    return {
        description: `(AI Unavailable) A stunning tattoo design featuring ${keywords}. Detailed shading and crisp lines.`,
        tags: ['tattoo', 'art', 'ink']
    };
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      I am a tattoo artist uploading a new design. 
      The keywords for this design are: "${keywords}".
      
      Please generate:
      1. A professional, poetic description (max 30 words) for a portfolio in Traditional Chinese (繁體中文).
      2. A list of 5 relevant tags/categories (can be English or Chinese).
      
      Return ONLY valid JSON in this format:
      {
        "description": "string",
        "tags": ["string", "string"]
      }
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      description: `A unique design inspired by ${keywords}.`,
      tags: ['tattoo', 'design']
    };
  }
};
