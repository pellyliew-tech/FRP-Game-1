import { GoogleGenAI } from "@google/genai";
import { Recruiter } from "../types";

// Safe initialization for Vite/Browser environments
let apiKey = '';

// 1. Try process.env.API_KEY (Defined in vite.config.ts via define replacement)
if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
  apiKey = process.env.API_KEY;
}

// 2. Try import.meta.env.VITE_API_KEY (Standard Vite) safely
if (!apiKey) {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      apiKey = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore access errors
  }
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const getCoachingTip = async (
  currentUser: Recruiter, 
  leader: Recruiter
): Promise<string> => {
  if (!ai) return "Keep pushing! You're doing great. (Configure API_KEY for AI tips)";

  const userCount = currentUser.applicants.length;
  const leaderCount = leader.applicants.length;
  const diff = leaderCount - userCount;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Context: A sales/recruiter leaderboard competition.
        User: ${currentUser.name} has ${userCount} applicants.
        Leader: ${leader.name} has ${leaderCount} applicants.
        Difference: ${diff}.
        
        Task: Provide a short, high-energy, 1-sentence motivational coaching tip for ${currentUser.name}. 
        If they are winning, congratulate them. If losing, tell them how close they are or to push harder.
        Be spicy and competitive.
      `,
    });
    
    return response.text || "Compete to win!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Focus on your unique value proposition to attract more candidates!";
  }
};

export const parseUnstructuredData = async (text: string): Promise<any[]> => {
  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Extract applicant data from this unstructured text. 
        Return ONLY a JSON array of objects with keys: "name", "email", "date" (ISO string).
        If date is missing, use today. Generate fake email if missing based on name.
        
        Text:
        ${text}
      `,
      config: {
        responseMimeType: "application/json"
      }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Parsing error", error);
    return [];
  }
};

export const analyzePortalData = async (text: string): Promise<{ count: number; reasoning: string }> => {
    if (!ai) return { count: 0, reasoning: "API Key missing. Cannot analyze data." };
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
          You are a data analyst for a recruitment firm.
          Analyze the following unstructured text copied from a recruitment portal.
          
          Task: Count the number of UNIQUE applicants/candidates listed.
          - Ignore headers, footers, or menu text.
          - Look for rows with names, dates, or IDs.
          - If the text is just a single number (e.g. "Total: 45"), return that number.
          
          Return JSON: { "count": number, "reasoning": "string explanation" }
          
          Data:
          ${text.substring(0, 10000)}
        `,
        config: {
          responseMimeType: "application/json"
        }
      });
  
      if (response.text) {
          return JSON.parse(response.text);
      }
      return { count: 0, reasoning: "Could not parse response." };
    } catch (error) {
      console.error("Analysis error", error);
      return { count: 0, reasoning: "Error processing data." };
    }
  };