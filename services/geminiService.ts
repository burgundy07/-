import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SegmentResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeText = async (text: string, targetLanguage: string = 'Simplified Chinese'): Promise<SegmentResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a language learning assistant. Split the following text into natural, bite-sized reading segments (logical phrases or sentences) that are easy to digest for a learner. 
      For each segment, provide a translation in ${targetLanguage}.
      
      Input Text:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique identifier for the segment (e.g., 'seg-1')" },
                  original: { type: Type.STRING, description: "The original text segment" },
                  translation: { type: Type.STRING, description: `The translation in ${targetLanguage}` },
                },
                required: ["id", "original", "translation"],
              },
            },
          },
          required: ["segments"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as SegmentResponse;
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Error analyzing text:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("No audio data generated");
    }
    // Returns Base64 encoded PCM data (raw bytes, no header)
    return audioData;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};