import axios from "axios";

const AI_URL = "http://localhost:8000/recommend";

export async function getRecommendations(audioUrl) {
  try {
    const response = await axios.post(AI_URL, {
      audio_url: audioUrl,
    });

    return response.data;
  } catch (error) {
    console.error("AI Service Error:", error.message);
    throw error;
  }
}
