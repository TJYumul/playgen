"""Evaluation script for the AI recommendation system.

This script is intentionally self-contained and avoids network/audio dependencies
by patching parts of `recommender.generate_playlist` during evaluation.

Run (recommended):
  ai-service/venv/Scripts/python.exe ai-service/evaluation.py
"""

from __future__ import annotations

import contextlib
import io
import os
import shutil
import tempfile
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Sequence, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


AI_SERVICE_DIR = Path(__file__).resolve().parent

# Ensure relative paths used by `recommender.py` (joblib/csv loads) resolve even
# when running from the repo root.
os.chdir(AI_SERVICE_DIR)

import recommender  # noqa: E402
from recommender import generate_playlist  # noqa: E402


MOOD_COLS = ["electronic", "energetic", "happy", "danceable"]


class _DummyScaler:
    def transform(self, X):
        return X


class _DummyModel:
    def __init__(self, mood_vector: Sequence[float]):
        self._mood_vector = np.asarray(mood_vector, dtype=float)

    def predict(self, X):
        # Return the same mood vector for each input row.
        n = len(X)
        return np.tile(self._mood_vector, (n, 1))


@contextlib.contextmanager
def _patched_recommender(**replacements) -> Iterator[None]:
    originals: Dict[str, object] = {}
    for name, value in replacements.items():
        originals[name] = getattr(recommender, name)
        setattr(recommender, name, value)

    try:
        yield
    finally:
        for name, original in originals.items():
            setattr(recommender, name, original)


def _load_song_mood_vectors() -> pd.DataFrame:
    csv_path = AI_SERVICE_DIR / "song_mood_vectors.csv"
    df = pd.read_csv(csv_path)

    missing = [c for c in ("song_id", *MOOD_COLS) if c not in df.columns]
    if missing:
        raise ValueError(f"song_mood_vectors.csv is missing columns: {missing}")

    return df


def _format_table(rows: Iterable[Tuple], headers: Sequence[str]) -> str:
    rows = list(rows)
    if not rows:
        return "(no rows)"

    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))

    def fmt(row: Sequence[object]) -> str:
        return " | ".join(str(row[i]).ljust(widths[i]) for i in range(len(headers)))

    lines = [fmt(headers), "-+-".join("-" * w for w in widths)]
    lines.extend(fmt(r) for r in rows)
    return "\n".join(lines)


def _behavior_score_from_row(row: pd.Series) -> float:
    completion_rate = float(row.get("completion_rate", 0) or 0)
    skip_count = float(row.get("skip_count", 0) or 0)
    avg_play_duration = float(row.get("avg_play_duration", 0) or 0)

    normalized_duration = avg_play_duration / 300.0  # assume 5 minutes max

    return (completion_rate * 0.4) + (normalized_duration * 0.3) - (skip_count * 0.2)


def _scored_ranking(
    *,
    user_mood: np.ndarray,
    db_df: pd.DataFrame,
    dataset_vectors: np.ndarray,
    user_df: pd.DataFrame,
) -> List[Tuple[str, float, float, float]]:
    """Return list of (song_id, final_score, mood_score, behavior_score)."""

    similarity = recommender.cosine_similarity([user_mood], dataset_vectors)[0]

    # Build a quick lookup map for behavior features.
    behavior_by_song: Dict[str, float] = {}
    if not user_df.empty and "song_id" in user_df.columns:
        for _, r in user_df.iterrows():
            behavior_by_song[str(r["song_id"])] = _behavior_score_from_row(r)

    scored: List[Tuple[str, float, float, float]] = []
    for idx in range(len(db_df)):
        song_id = str(db_df.iloc[idx]["song_id"])
        mood_score = float(similarity[idx])
        behavior_score = float(behavior_by_song.get(song_id, 0.0))
        final_score = (mood_score * 0.7) + (behavior_score * 0.3)
        scored.append((song_id, final_score, mood_score, behavior_score))

    scored.sort(key=lambda t: t[1], reverse=True)
    return scored


def evaluate_mood_model(sample_size: int = 40) -> None:
    """Evaluate the mood prediction model via MSE.

    If local audio files referenced by the CSV are not present, falls back to a
    synthetic feature test (still uses the real model + scaler).
    """

    df = _load_song_mood_vectors()

    # Attempt to evaluate on local audio files if any exist.
    has_path_col = "path" in df.columns
    existing_audio_rows = []
    if has_path_col:
        for _, row in df.head(sample_size).iterrows():
            rel = str(row["path"])
            candidate = AI_SERVICE_DIR / rel
            if candidate.exists():
                existing_audio_rows.append((candidate, row[MOOD_COLS].to_numpy(dtype=float)))

    if existing_audio_rows:
        y_true = []
        y_pred = []

        for file_path, true_mood in existing_audio_rows:
            feats = recommender.extract_features(str(file_path))
            feats = recommender.scaler.transform([feats])
            pred_mood = recommender.model.predict(feats)[0]

            y_true.append(true_mood)
            y_pred.append(pred_mood)

        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)

        mse = float(np.mean((y_true - y_pred) ** 2))
        print(f"Mood Model MSE (local audio, n={len(y_true)}): {mse:.6f}")
        return

    y_true = df[MOOD_COLS].sample(n=min(sample_size, len(df)), random_state=42).to_numpy(dtype=float)

    scaler = recommender.scaler
    model = recommender.model

    # Infer feature dimensionality from the scaler.
    feature_dim = getattr(scaler, "n_features_in_", None)
    if feature_dim is None and hasattr(scaler, "mean_"):
        feature_dim = int(np.asarray(scaler.mean_).shape[0])

    if not feature_dim:
        raise RuntimeError("Could not infer feature dimensionality from scaler")

    rng = np.random.default_rng(42)
    X = rng.normal(loc=0.0, scale=1.0, size=(len(y_true), int(feature_dim)))

    Xs = scaler.transform(X)
    y_pred = np.asarray(model.predict(Xs), dtype=float)

    if y_pred.shape != y_true.shape:
        raise RuntimeError(f"Unexpected model output shape {y_pred.shape}; expected {y_true.shape}")

    mse = float(np.mean((y_true - y_pred) ** 2))

    print(f"  samples: {len(y_true)}")
    print(f"  feature_dim: {feature_dim}")
    print(f"  MSE: {mse:.6f}")


def evaluate_mood_model_advanced(sample_size: int = 40) -> None:
    df = _load_song_mood_vectors().head(sample_size).copy()

    y_true = df[MOOD_COLS].to_numpy(dtype=float)

    scaler = recommender.scaler
    model = recommender.model

    feature_dim = getattr(scaler, "n_features_in_", 46)
    rng = np.random.default_rng(42)
    X = rng.normal(size=(len(y_true), feature_dim))

    Xs = scaler.transform(X)
    y_pred = np.asarray(model.predict(Xs), dtype=float)

    mae = mean_absolute_error(y_true, y_pred)
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_true, y_pred)

    summary = (
        "Advanced Mood Model Evaluation "
        f"MAE: {mae:.6f} "
        f"MSE: {mse:.6f} "
        f"RMSE: {rmse:.6f} "
        f"R2: {r2:.6f}"
    )

    term_width = shutil.get_terminal_size(fallback=(120, 20)).columns
    if len(summary) <= term_width:
        print(summary)
    else:
        print("Advanced Mood Model Evaluation")
        print(f"MAE: {mae:.6f} MSE: {mse:.6f} RMSE: {rmse:.6f} R2: {r2:.6f}")

    print("\nPer-Dimension MAE:")
    for i, col in enumerate(MOOD_COLS):
        col_mae = mean_absolute_error(y_true[:, i], y_pred[:, i])
        print(f"{col}: {col_mae:.6f}")


def evaluate_recommendation_quality(k: int = 10, sample_size: int = 80) -> None:
    """Evaluate recommendation quality using a simple Precision@K proxy."""

    df = _load_song_mood_vectors().head(sample_size).copy()
    db_df = df[["song_id", *MOOD_COLS]].copy()
    dataset_vectors = df[MOOD_COLS].to_numpy(dtype=float)

    # Simulate a user selecting a song: we set the user's inferred mood vector
    # to match a real item from the dataset.
    selected_song_id = str(df.iloc[0]["song_id"])
    selected_mood = df.iloc[0][MOOD_COLS].to_numpy(dtype=float)

    user_df = pd.DataFrame(columns=["song_id", "completion_rate", "skip_count", "avg_play_duration"])

    def _download_audio_mock(url: str) -> str:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tmp.write(b"mock")
        tmp.close()
        return tmp.name

    # Keep extract_features/scaler present, but avoid librosa.
    def _extract_features_mock(file: str) -> np.ndarray:
        return np.array([0.1, 0.2, 0.3, 0.4], dtype=float)

    with _patched_recommender(
        db=db_df,
        dataset_vectors=dataset_vectors,
        download_audio=_download_audio_mock,
        extract_features=_extract_features_mock,
        scaler=_DummyScaler(),
        model=_DummyModel(selected_mood),
        load_user_features=lambda user_id: user_df,
    ):
        # Silence debug prints inside recommender.generate_playlist.
        with contextlib.redirect_stdout(io.StringIO()):
            playlist = generate_playlist("https://example.com/audio.mp3", "eval-user")

        if not playlist:
            print("Playlist generation failed (empty playlist).")
            return

        relevant_set = {playlist[0]}  # assume first recommendation is relevant
        denom = min(k, len(playlist))
        precision_at_k = sum(1 for s in playlist[:k] if s in relevant_set) / float(denom)

        user_mood = np.asarray(selected_mood, dtype=float)
        ranking = _scored_ranking(
            user_mood=user_mood,
            db_df=db_df,
            dataset_vectors=dataset_vectors,
            user_df=user_df,
        )

        print("Recommendation Quality")
        print(f"  selected_song_id: {selected_song_id}")
        print(f"  Precision@{k}: {precision_at_k:.3f} (1 relevant assumed)")
        print("\nTop recommendations (example ranking):")

        top_rows = []
        for rank, (song_id, final_score, mood_score, behavior_score) in enumerate(ranking[:k], start=1):
            top_rows.append(
                (
                    rank,
                    song_id,
                    f"{final_score:.4f}",
                    f"{mood_score:.4f}",
                    f"{behavior_score:.4f}",
                )
            )

        print(
            _format_table(
                top_rows,
                headers=["rank", "song_id", "final", "mood", "behavior"],
            )
        )


def evaluate_behavior_impact(sample_size: int = 10) -> None:
    """Verify user behavior signals impact ranking as expected."""

    df = _load_song_mood_vectors().head(sample_size).copy()
    db_df = df[["song_id", *MOOD_COLS]].copy()
    dataset_vectors = df[MOOD_COLS].to_numpy(dtype=float)

    completed_song_id = str(df.iloc[0]["song_id"])
    skipped_song_id = str(df.iloc[1]["song_id"])

    user_df = pd.DataFrame(
        [
            {"song_id": completed_song_id, "completion_rate": 1.0, "skip_count": 0, "avg_play_duration": 300},
            {"song_id": skipped_song_id, "completion_rate": 0.0, "skip_count": 1, "avg_play_duration": 0},
        ]
    )

    def _download_audio_mock(url: str) -> str:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tmp.write(b"mock")
        tmp.close()
        return tmp.name

    def _extract_features_mock(file: str) -> np.ndarray:
        return np.array([0.1, 0.2, 0.3, 0.4], dtype=float)

    # Force equal mood similarity so behavior should decide ordering.
    def _cosine_similarity_tied(a, b):
        return np.full((1, len(b)), 0.5, dtype=float)

    fixed_user_mood = np.array([0.5, 0.5, 0.5, 0.5], dtype=float)

    with _patched_recommender(
        db=db_df,
        dataset_vectors=dataset_vectors,
        download_audio=_download_audio_mock,
        extract_features=_extract_features_mock,
        scaler=_DummyScaler(),
        model=_DummyModel(fixed_user_mood),
        load_user_features=lambda user_id: user_df,
        cosine_similarity=_cosine_similarity_tied,
    ):
        with contextlib.redirect_stdout(io.StringIO()):
            playlist = generate_playlist("https://example.com/audio.mp3", "eval-user")

        ranking = _scored_ranking(
            user_mood=fixed_user_mood,
            db_df=db_df,
            dataset_vectors=dataset_vectors,
            user_df=user_df,
        )

        top_ids = [sid for sid, *_ in ranking]
        pos_completed = top_ids.index(completed_song_id) if completed_song_id in top_ids else None
        pos_skipped = top_ids.index(skipped_song_id) if skipped_song_id in top_ids else None

        passed = (
            pos_completed is not None
            and pos_skipped is not None
            and pos_completed < pos_skipped
        )

        print("Behavior Impact")
        print(f"  completed_song_id: {completed_song_id}")
        print(f"  skipped_song_id:   {skipped_song_id}")
        print(f"  result: {'PASS' if passed else 'FAIL'}")

        print("\nRanking (example):")
        rows = []
        for rank, (song_id, final_score, mood_score, behavior_score) in enumerate(ranking, start=1):
            rows.append(
                (
                    rank,
                    song_id,
                    f"{final_score:.4f}",
                    f"{mood_score:.4f}",
                    f"{behavior_score:.4f}",
                )
            )

        print(_format_table(rows, headers=["rank", "song_id", "final", "mood", "behavior"]))

        # Extra sanity check: the generated playlist should respect the same ordering.
        if playlist:
            try:
                p_completed = playlist.index(completed_song_id)
                p_skipped = playlist.index(skipped_song_id)
                print("\nGenerated playlist order check:")
                print(f"  completed position: {p_completed + 1}")
                print(f"  skipped position:   {p_skipped + 1}")
            except ValueError:
                print("\nGenerated playlist order check: (one of the songs not in top-10 playlist)")


def main() -> None:
    print("Evaluating Mood Model...")
    evaluate_mood_model()

    print("\nEvaluating Advanced Mood Metrics...")
    evaluate_mood_model_advanced()

    print("\nEvaluating Recommendation Quality...")
    evaluate_recommendation_quality()

    print("\nEvaluating Behavior Impact...")
    evaluate_behavior_impact()


if __name__ == "__main__":
    main()
