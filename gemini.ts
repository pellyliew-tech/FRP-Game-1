import { GoogleGenerativeAI } from "@google/generative-ai";
import { Recruiter } from "./types";

// Safe initialization
// Note: In Vite, use import.meta.env for env vars usually, but we keep process.env compatibility via vite.config.ts
const apiKey = process.env.API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const getCoachingTip = async (
  currentUser: Recruiter, 
  leader: Recruiter
): Promise<string> => {
  if (!genAI) return "Keep pushing! You're doing great.";

  const userCount = currentUser.applicants.length;
  const leaderCount = leader.applicants.length;
  const diff = leaderCount - userCount;

  try {
    // Using gemini-1.5-flash as the stable standard model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
        Context: A sales/recruiter leaderboard competition.
        User: ${currentUser.name} has ${userCount} applicants.
        Leader: ${leader.name} has ${leaderCount} applicants.
        Difference: ${diff}.
        
        Task: Provide a short, high-energy, 1-sentence motivational coaching tip for ${currentUser.name}. 
        If they are winning, congratulate them. If losing, tell them how close they are or to push harder.
        Be spicy and competitive.
      `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "Compete to win!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Focus on your unique value proposition to attract more candidates!";
  }
};

export const parseUnstructuredData = async (text: string): Promise<any[]> => {
  if (!genAI) return [];

  try {
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
    
    const prompt = `
        Extract applicant data from this unstructured text. 
        Return ONLY a JSON array of objects with keys: "name", "email", "date" (ISO string).
        If date is missing, use today. Generate fake email if missing based on name.
        
        Text:
        ${text}
      `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("Parsing error", error);
    return [];
  }
};