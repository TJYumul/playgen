import pandas as pd
import numpy as np
import joblib
import librosa
import requests
import tempfile
import os

from sklearn.metrics.pairwise import cosine_similarity

# Load AI assets
model = joblib.load("mood_model.pkl")
scaler = joblib.load("feature_scaler.pkl")

db = pd.read_csv("song_mood_vectors.csv")

# PRELOAD vectors once
dataset_vectors = db[["electronic","energetic","happy","danceable"]].values


def extract_features(file):

    y, sr = librosa.load(file, duration=30)

    features = []

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    features.extend(np.mean(mfcc, axis=1))

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    features.extend(np.mean(chroma, axis=1))

    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    features.extend(np.mean(contrast, axis=1))

    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
    features.append(np.mean(rolloff))

    flatness = librosa.feature.spectral_flatness(y=y)
    features.append(np.mean(flatness))

    zcr = librosa.feature.zero_crossing_rate(y)
    features.append(np.mean(zcr))

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features.append(np.mean(centroid))

    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    features.append(np.mean(bandwidth))

    rms = librosa.feature.rms(y=y)
    features.append(np.mean(rms))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    features.append(float(np.mean(tempo)))

    return np.array(features)

def download_audio(url):
    response = requests.get(url)

    if response.status_code != 200:
        raise Exception("Failed to download audio")

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    temp_file.write(response.content)
    temp_file.close()

    return temp_file.name

def generate_playlist(audio_url):

    # download audio first
    song_file = download_audio(audio_url)

    try:
        features = extract_features(song_file)
        features = scaler.transform([features])

        user_mood = model.predict(features)[0]

        similarity = cosine_similarity([user_mood], dataset_vectors)[0]

        top_indices = np.argsort(similarity)[-20:][::-1]

        playlist = []

        for idx in top_indices:

            song_id = db.iloc[idx]["song_id"]

            # skip same song if path exists
            if "path" in db.columns and db.iloc[idx]["path"] == song_file:
                continue

            playlist.append(song_id)

            if len(playlist) == 10:
                break

        return playlist

    finally:
        # 🧹 cleanup temp file
        if os.path.exists(song_file):
            os.remove(song_file)