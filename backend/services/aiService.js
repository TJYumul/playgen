<<<<<<< HEAD
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
=======
import axios from "axios";

const AI_URL = "http://localhost:8000/recommend";

export async function getRecommendations(audio_url, user_id) {
  try {
    const response = await axios.post(AI_URL, {
      audio_url,
      user_id,
    });

    const playlist = response?.data?.playlist;
    if (!Array.isArray(playlist)) {
      throw new Error("AI service response missing playlist array");
    }

    return playlist;
  } catch (error) {
    console.error("AI Service Error:", error.message);
    throw error;
  }
}
>>>>>>> c29f1537 (Added ai-service folder and integrated model)
