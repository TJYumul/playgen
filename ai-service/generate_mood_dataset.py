import pandas as pd
import numpy as np
import requests
import tempfile
import os
import joblib
import librosa

from client import supabase

# Load models
model = joblib.load("mood_model.pkl")
scaler = joblib.load("feature_scaler.pkl")

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
        raise Exception("Download failed")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    tmp.write(response.content)
    tmp.close()

    return tmp.name


def fetch_songs():
    response = supabase.table("songs").select("id,audio_url").execute()
    return response.data


def main():
    songs = fetch_songs()

    rows = []

    for song in songs:
        song_id = song["id"]
        audio_url = song["audio_url"]

        print(f"Processing {song_id}...")

        file_path = None

        try:
            file_path = download_audio(audio_url)

            features = extract_features(file_path)
            features = scaler.transform([features])

            mood = model.predict(features)[0]

            rows.append({
                "song_id": song_id,
                "electronic": mood[0],
                "energetic": mood[1],
                "happy": mood[2],
                "danceable": mood[3],
            })

        except Exception as e:
            print(f"Skipped {song_id}: {e}")

        finally:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)

    df = pd.DataFrame(rows)
    df.to_csv("song_mood_vectors_v2.csv", index=False)

    print("✅ DONE: song_mood_vectors_v2.csv created")


if __name__ == "__main__":
    main()