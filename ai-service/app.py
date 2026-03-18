from fastapi import FastAPI
from pydantic import BaseModel
from recommender import generate_playlist

app = FastAPI()

class SongRequest(BaseModel):
    audio_url: str


@app.post("/recommend")
def recommend_song(request: SongRequest):

    try:
        playlist = generate_playlist(request.audio_url)

        return {
            "playlist": playlist
        }

    except Exception as e:
        return {"error": str(e)}