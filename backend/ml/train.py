import pandas as pd
import numpy as np
import joblib
import json
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import (
    train_test_split,
    cross_val_score,
    StratifiedKFold,
)
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

CSV_PATH = os.path.join(os.path.dirname(__file__), "features.csv")
MODEL_BINARY = os.path.join(os.path.dirname(__file__), "model_binary.pkl")
MODEL_GAME = os.path.join(os.path.dirname(__file__), "model_game.pkl")
FEATURE_META = os.path.join(os.path.dirname(__file__), "feature_meta.json")

GAME_CLASSES = {0: "Valorant", 1: "Tekken 8", 2: "PUBG Mobile"}


def load_data():
    df = pd.read_csv(CSV_PATH)
    y_labels = df["game"].values
    drop_cols = [c for c in ["game"] if c in df.columns]
    X = df.drop(columns=drop_cols).values

    # Stage 1 labels: 1 = gameplay, 0 = non-gameplay
    y_binary = np.array([0 if label == "Non-Gameplay" else 1 for label in y_labels])

    # Stage 2 labels: only gameplay samples
    gp_mask = y_binary == 1
    X_game = X[gp_mask]
    y_game_labels = y_labels[gp_mask]
    y_game = np.array(
        [
            0 if g == "Valorant" else 1 if g == "Tekken 8" else 2
            for g in y_game_labels
        ]
    )

    return X, y_binary, X_game, y_game, y_labels, df.drop(columns=drop_cols).columns.tolist()


def train_stage1(X, y_binary, feature_names):
    print("=" * 60)
    print("STAGE 1: Gameplay vs Non-Gameplay (Binary)")
    print("=" * 60)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_binary, test_size=0.20, random_state=42, stratify=y_binary
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_split=3,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nTest accuracy: {acc:.2%}")
    print("\nClassification Report:")
    print(
        classification_report(
            y_test, y_pred, target_names=["Non-Gameplay", "Gameplay"], zero_division=0
        )
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y_binary, cv=cv, scoring="accuracy")
    print(f"Cross-val accuracy: {cv_scores.mean():.2%} (+/- {cv_scores.std():.2%})")

    importances = model.feature_importances_
    top_n = min(10, len(feature_names))
    top_idx = np.argsort(importances)[::-1][:top_n]
    print(f"\nTop {top_n} features:")
    for i, idx in enumerate(top_idx):
        print(f"  {i+1}. {feature_names[idx]}: {importances[idx]:.4f}")

    joblib.dump(model, MODEL_BINARY)
    print(f"\nSaved: {MODEL_BINARY}")
    return model


def train_stage2(X_game, y_game, feature_names):
    print("\n" + "=" * 60)
    print("STAGE 2: Game Identification (Multi-class)")
    print("=" * 60)

    n_classes = len(np.unique(y_game))
    print(f"Classes: {dict(GAME_CLASSES)}")
    class_counts = np.bincount(y_game)
    for cls_id, count in enumerate(class_counts):
        print(f"  {GAME_CLASSES[cls_id]}: {count} samples")

    X_train, X_test, y_train, y_test = train_test_split(
        X_game, y_game, test_size=0.25, random_state=42, stratify=y_game
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_split=3,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nTest accuracy: {acc:.2%}")
    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            y_pred,
            target_names=list(GAME_CLASSES.values()),
            zero_division=0,
        )
    )

    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    if len(np.unique(y_game)) >= 2:
        cv_scores = cross_val_score(model, X_game, y_game, cv=cv, scoring="accuracy")
        print(f"Cross-val accuracy: {cv_scores.mean():.2%} (+/- {cv_scores.std():.2%})")

    importances = model.feature_importances_
    top_n = min(10, len(feature_names))
    top_idx = np.argsort(importances)[::-1][:top_n]
    print(f"\nTop {top_n} features:")
    for i, idx in enumerate(top_idx):
        print(f"  {i+1}. {feature_names[idx]}: {importances[idx]:.4f}")

    joblib.dump(model, MODEL_GAME)
    print(f"Saved: {MODEL_GAME}")
    return model


def main():
    print("Loading features from", CSV_PATH)
    X, y_binary, X_game, y_game, y_labels, feature_names = load_data()

    print(f"\nTotal samples: {len(X)}")
    print(f"Label distribution:")
    for label in sorted(set(y_labels)):
        print(f"  {label}: {sum(y_labels == label)}")

    train_stage1(X, y_binary, feature_names)
    train_stage2(X_game, y_game, feature_names)

    meta = {
        "feature_names": feature_names,
        "num_features": len(feature_names),
        "game_classes": GAME_CLASSES,
    }
    with open(FEATURE_META, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"\nSaved feature metadata: {FEATURE_META}")
    print("\nDone!")


if __name__ == "__main__":
    main()
