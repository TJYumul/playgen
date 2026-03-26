from fastapi import FastAPI
from pydantic import BaseModel
from recommender import generate_playlist

app = FastAPI()

class SongRequest(BaseModel):
    audio_url: str
    user_id: str 


@app.post("/recommend")
def recommend_song(request: SongRequest):

    playlist = generate_playlist(
        request.audio_url,
        request.user_id   # 👈 pass it here
    )

    return {"playlist": playlist}