import sys
import json
import os
import numpy as np
import joblib

ML_DIR = os.path.dirname(__file__)
MODEL_BINARY = os.path.join(ML_DIR, "model_binary.pkl")
MODEL_GAME = os.path.join(ML_DIR, "model_game.pkl")

GAME_IDS = {0: "Valorant", 1: "Tekken 8", 2: "PUBG Mobile"}

# Lazy-load models so the first call is slower but subsequent ones share the cached module
_model_binary = None
_model_game = None


def load_models():
    global _model_binary, _model_game
    if _model_binary is None:
        _model_binary = joblib.load(MODEL_BINARY)
    if _model_game is None:
        _model_game = joblib.load(MODEL_GAME)
    return _model_binary, _model_game


def predict(data):
    frames = data.get("frames", [])
    selected_game = (data.get("gameTitle") or "").strip().lower()

    if not frames:
        return {"isGameplay": False, "detectedGame": None, "confidence": 0, "gameMatch": False}

    model_binary, model_game = load_models()
    X = np.array(frames, dtype=float)
    if X.ndim == 1:
        X = X.reshape(1, -1)

    # Stage 1: binary gameplay classification for each frame
    bin_preds = model_binary.predict(X)
    bin_probs = model_binary.predict_proba(X)

    gameplay_votes = int(np.sum(bin_preds))
    total_frames = len(frames)

    # Stage 2: game identification for gameplay frames
    game_votes = {}
    for i, is_gp in enumerate(bin_preds):
        if is_gp == 1:
            game_id = int(model_game.predict([X[i]])[0])
            game_name = GAME_IDS.get(game_id, "unknown")
            game_votes[game_name] = game_votes.get(game_name, 0) + 1

    # Majority decisions
    gameplay_confidence = gameplay_votes / total_frames
    is_gameplay = gameplay_votes > total_frames / 2

    detected_game = None
    game_match = False
    if is_gameplay and game_votes:
        # Pick the game with the most frame votes
        detected_game = max(game_votes, key=game_votes.get)
        game_match = detected_game.lower() == selected_game if selected_game else True

    return {
        "isGameplay": bool(is_gameplay),
        "detectedGame": detected_game,
        "confidence": round(float(gameplay_confidence), 4),
        "gameMatch": game_match,
    }


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"isGameplay": False, "detectedGame": None, "confidence": 0, "gameMatch": False}))
        return
    try:
        data = json.loads(raw)
        result = predict(data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "isGameplay": False, "detectedGame": None, "confidence": 0, "gameMatch": False}))


if __name__ == "__main__":
    main()
