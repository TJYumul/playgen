import numpy as np
import pandas as pd
import pytest

import sys
from pathlib import Path

# Allow `import recommender` when pytest is run from repo root.
AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_DIR) not in sys.path:
	sys.path.insert(0, str(AI_SERVICE_DIR))

import recommender
from recommender import generate_playlist


class _DummyScaler:
	def transform(self, X):
		return X


class _DummyModel:
	def __init__(self, mood_vector):
		self._mood_vector = np.asarray(mood_vector, dtype=float)

	def predict(self, X):
		return np.asarray([self._mood_vector], dtype=float)


def _patch_common(monkeypatch, tmp_path, *, db_df, dataset_vectors, user_df, mood_vector=None):
	dummy_file = tmp_path / "dummy.mp3"
	dummy_file.write_bytes(b"not-a-real-audio-file")

	monkeypatch.setattr(recommender, "download_audio", lambda url: str(dummy_file))
	monkeypatch.setattr(recommender, "extract_features", lambda file: np.array([0.5, 0.6, 0.7, 0.8]))
	monkeypatch.setattr(recommender, "scaler", _DummyScaler())
	monkeypatch.setattr(recommender, "model", _DummyModel(mood_vector or np.array([0.5, 0.6, 0.7, 0.8])))
	monkeypatch.setattr(recommender, "load_user_features", lambda user_id: user_df)

	monkeypatch.setattr(recommender, "db", db_df)
	monkeypatch.setattr(recommender, "dataset_vectors", np.asarray(dataset_vectors, dtype=float))


def test_mood_only_recommendation(monkeypatch, tmp_path):
	song_ids = [f"s{i}" for i in range(12)]
	db_df = pd.DataFrame({
		"song_id": song_ids,
		"final_score": np.linspace(0.0, 1.0, num=len(song_ids)),
	})
	dataset_vectors = np.tile(np.array([0.5, 0.6, 0.7, 0.8]), (len(song_ids), 1))
	user_df = pd.DataFrame(columns=["song_id", "completion_rate", "skip_count", "avg_play_duration"])

	_patch_common(
		monkeypatch,
		tmp_path,
		db_df=db_df,
		dataset_vectors=dataset_vectors,
		user_df=user_df,
	)

	playlist = generate_playlist("https://example.com/audio.mp3", "user-1")
	assert isinstance(playlist, list)
	assert len(playlist) == 10


def test_behavior_improves_ranking(monkeypatch, tmp_path):
	db_df = pd.DataFrame({
		"song_id": ["A", "B"],
		"final_score": [0.1, 0.9],
	})
	dataset_vectors = np.array([
		[0.1, 0.2, 0.3, 0.4],
		[0.1, 0.2, 0.3, 0.4],
	])

	user_df = pd.DataFrame([
		{"song_id": "A", "completion_rate": 0.9, "skip_count": 0, "avg_play_duration": 0},
		{"song_id": "B", "completion_rate": 0.0, "skip_count": 5, "avg_play_duration": 0},
	])

	_patch_common(
		monkeypatch,
		tmp_path,
		db_df=db_df,
		dataset_vectors=dataset_vectors,
		user_df=user_df,
	)

	# Force identical mood similarity so behavior decides the ordering.
	monkeypatch.setattr(recommender, "cosine_similarity", lambda a, b: np.array([[0.5, 0.5]]))

	playlist = generate_playlist("https://example.com/audio.mp3", "user-1")
	assert playlist.index("A") < playlist.index("B")


def test_empty_dataset_returns_empty_playlist(monkeypatch, tmp_path):
	db_df = pd.DataFrame(columns=["song_id", "final_score"])
	dataset_vectors = np.empty((0, 4), dtype=float)
	user_df = pd.DataFrame(columns=["song_id", "completion_rate", "skip_count", "avg_play_duration"])

	_patch_common(
		monkeypatch,
		tmp_path,
		db_df=db_df,
		dataset_vectors=dataset_vectors,
		user_df=user_df,
	)

	playlist = generate_playlist("https://example.com/audio.mp3", "user-1")
	assert playlist == []


def test_invalid_audio_url_handled_gracefully(monkeypatch):
	monkeypatch.setattr(recommender, "download_audio", lambda url: (_ for _ in ()).throw(Exception("boom")))
	playlist = generate_playlist("not-a-url", "user-1")
	assert playlist == []


def test_deterministic_output(monkeypatch, tmp_path):
	song_ids = [f"s{i}" for i in range(12)]
	db_df = pd.DataFrame({
		"song_id": song_ids,
		"final_score": np.linspace(0.0, 1.0, num=len(song_ids)),
	})
	dataset_vectors = np.vstack([
		np.array([0.5, 0.6, 0.7, 0.8], dtype=float) for _ in range(len(song_ids))
	])
	user_df = pd.DataFrame(columns=["song_id", "completion_rate", "skip_count", "avg_play_duration"])

	_patch_common(
		monkeypatch,
		tmp_path,
		db_df=db_df,
		dataset_vectors=dataset_vectors,
		user_df=user_df,
	)

	p1 = generate_playlist("https://example.com/audio.mp3", "user-1")
	p2 = generate_playlist("https://example.com/audio.mp3", "user-1")
	assert p1 == p2

def test_behavior_changes_final_score(monkeypatch, tmp_path):
    db_df = pd.DataFrame({
        "song_id": ["A", "B"],
    })

    dataset_vectors = np.array([
        [0.5, 0.5, 0.5, 0.5],
        [0.5, 0.5, 0.5, 0.5],
    ])

    user_df = pd.DataFrame([
        {"song_id": "A", "completion_rate": 1.0, "skip_count": 0, "avg_play_duration": 300},
        {"song_id": "B", "completion_rate": 0.0, "skip_count": 5, "avg_play_duration": 0},
    ])

    _patch_common(monkeypatch, tmp_path,
        db_df=db_df,
        dataset_vectors=dataset_vectors,
        user_df=user_df
    )

    monkeypatch.setattr(recommender, "cosine_similarity", lambda a, b: np.array([[0.5, 0.5]]))

    playlist = generate_playlist("url", "user")

    assert playlist[0] == "A"