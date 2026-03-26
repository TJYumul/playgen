import pandas as pd
import numpy as np
import joblib
import librosa
import requests
import tempfile
import os

from sklearn.metrics.pairwise import cosine_similarity
from client import supabase

# Load AI assets
model = joblib.load("mood_model.pkl")
scaler = joblib.load("feature_scaler.pkl")

db = pd.read_csv("song_mood_vectors_v2.csv")

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

def load_user_features(user_id):

    if supabase is None:
        return pd.DataFrame(columns=["song_id", "completion_rate", "skip_count", "avg_play_duration"])

    response = supabase.table("user_song_features") \
        .select("*") \
        .eq("user_id", user_id) \
        .execute()

    data = response.data if response.data else []

    if not data:
        return pd.DataFrame(columns=["song_id", "completion_rate", "skip_count", "avg_play_duration"])

    return pd.DataFrame(data)

def generate_playlist(audio_url, user_id):

    song_file = None
    try:
        song_file = download_audio(audio_url)

        if dataset_vectors is None or np.size(dataset_vectors) == 0 or db is None or len(db) == 0:
            return []

        # ================================
        # Extract mood of user song
        # ================================
        features = extract_features(song_file)
        features = scaler.transform([features])

        user_mood = model.predict(features)[0]

        # ================================
        # Compute similarity
        # ================================
        similarity = cosine_similarity([user_mood], dataset_vectors)[0]

        # Get top candidates (speed optimization)
        if "final_score" in db.columns:
            top_indices = np.argsort(db["final_score"].values)[-20:][::-1]
        else:
            top_indices = np.argsort(similarity)[-20:][::-1]

        # ================================
        # Load user behavior
        # ================================
        user_df = load_user_features(user_id)

        playlist = []

        for idx in top_indices:

            song_id = db.iloc[idx]["song_id"]

            # -------------------------------
            # Mood Score
            # -------------------------------
            mood_score = similarity[idx]

            # -------------------------------
            # Behavior Score (IMPROVED)
            # -------------------------------
            behavior_score = 0

            if not user_df.empty:
                row = user_df[user_df["song_id"] == song_id]

                if not row.empty:
                    completion_rate = row.iloc[0].get("completion_rate", 0)
                    skip_count = row.iloc[0].get("skip_count", 0)
                    avg_play_duration = row.iloc[0].get("avg_play_duration", 0)

                    # Normalize duration (0–1 scale)
                    normalized_duration = avg_play_duration / 300  # assuming 5 mins max

                    behavior_score = (
                        completion_rate * 0.4
                        + normalized_duration * 0.3
                        - skip_count * 0.2
                    )

            # -------------------------------
            # FINAL SCORE (STEP 4 FIX)
            # -------------------------------
            final_score = (mood_score * 0.7) + (behavior_score * 0.3)

            playlist.append((song_id, final_score))

        playlist = sorted(playlist, key=lambda x: x[1], reverse=True)

        print("User mood:", user_mood)
        print("Top similarity:", similarity[:5])
        return [song for song, _ in playlist[:10]]

    except Exception:
        return []

    finally:
        if song_file and os.path.exists(song_file):
            os.remove(song_file)
            
def compute_behavior_score(features):

    if not features:
        return 0  # no data yet

    return (
        features.get("completion_rate", 0) * 0.4
        + features.get("avg_play_duration", 0) / 300
        - features.get("skip_count", 0) * 0.2
    )