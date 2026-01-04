import { GoogleGenAI, Content, Type, Schema } from "@google/genai";
import { RatingDimension } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export type ChatMode = 'standard' | 'thinking' | 'search';

export interface ChatResponse {
  text: string | undefined;
  groundingMetadata?: any;
}

export const sendMessageToAI = async (
  history: Content[], 
  message: string, 
  mode: ChatMode
): Promise<ChatResponse> => {
  let model = 'gemini-3-pro-preview';
  let config: any = {};
  let tools: any[] | undefined = undefined;

  // Mode selection based on feature requirements
  if (mode === 'thinking') {
    model = 'gemini-3-pro-preview';
    config = {
      thinkingConfig: { thinkingBudget: 32768 }
    };
  } else if (mode === 'search') {
    model = 'gemini-3-flash-preview';
    tools = [{ googleSearch: {} }];
  } else {
    // Default Chatbot: "receive responses from Gemini using gemini-3-pro-preview"
    model = 'gemini-3-pro-preview';
  }

  // Construct conversation content
  const contents: Content[] = [
    ...history,
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        ...config,
        tools
      }
    });

    return {
      text: response.text,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (error) {
    console.error("AI Error:", error);
    return { text: "I encountered an error processing your request. Please try again." };
  }
};

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Analyze this image and provide a detailed technical description suitable for an innovation proposal. Focus on equipment, operational context, safety hazards, or potential efficiency improvements visible in the image." }
        ]
      }
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Image Analysis Error:", error);
    return "Failed to analyze image.";
  }
};

export const transcribeAudio = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Transcribe the audio exactly as spoken." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    return "Failed to transcribe audio.";
  }
};

// --- New Features ---

export interface ManagerAnalysisResult {
  summary: string;
  pros: string[];
  cons: string[];
}

export interface AIEvaluationResult {
  scores: Record<string, number>; // kpiId -> score (1-5)
  comment: string;
}

export const generateEvaluation = async (
  title: string, 
  description: string, 
  kpis: RatingDimension[]
): Promise<AIEvaluationResult | null> => {
  try {
    // Construct a dynamic schema based on the KPI IDs provided
    const scoresProperties: Record<string, any> = {};
    const requiredFields = ["comment"];
    
    kpis.forEach(k => {
      scoresProperties[k.id] = { type: Type.INTEGER, description: `Score (1-5) for ${k.name}` };
      requiredFields.push(k.id);
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a strict technical innovation manager evaluating a proposal.
      
      Proposal Title: "${title}"
      Proposal Description: "${description}"
      
      Evaluate this proposal based on the following dimensions (1 = Poor, 5 = Excellent):
      ${kpis.map(k => `- ${k.name} (ID: ${k.id}): ${k.description}`).join('\n')}
      
      Provide an integer score (1-5) for each dimension ID and a constructive summary comment justifying the scores.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comment: { type: Type.STRING, description: "A professional justification of the scores." },
            ...scoresProperties
          },
          required: requiredFields // Ideally we list them, but dynamic is tricky in schema. The prompt usually handles it.
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      const comment = data.comment;
      // Extract scores excluding comment
      const scores: Record<string, number> = {};
      kpis.forEach(k => {
        if (data[k.id]) scores[k.id] = data[k.id];
      });
      
      return { scores, comment };
    }
    return null;
  } catch (error) {
    console.error("Evaluation Error:", error);
    return null;
  }
};

export const generateManagerAnalysis = async (title: string, description: string): Promise<ManagerAnalysisResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze this innovation idea for a manager. 
      Title: ${title}
      Description: ${description}
      
      Provide:
      1. A concise executive summary (max 2 sentences).
      2. 3 Key Pros (Benefits).
      3. 3 Key Cons (Risks or Challenges).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            cons: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "pros", "cons"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ManagerAnalysisResult;
    }
    return null;
  } catch (error) {
    console.error("Manager Analysis Error:", error);
    return null;
  }
};

export const enhanceIdeaText = async (currentText: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rewrite the following innovation description to be more professional, persuasive, and concise for a corporate environment. Keep the technical details accurate but improve the flow and impact:\n\n${currentText}`
    });
    return response.text || currentText;
  } catch (error) {
    console.error("Enhancement Error:", error);
    return currentText;
  }
};