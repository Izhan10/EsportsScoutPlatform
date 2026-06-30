import sys, json, os
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

MODEL_REPO = 'keremberke/yolov8n-valorant-detection'
MODEL_FILE = 'best.pt'

def load_model():
    path = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_FILE)
    return YOLO(path)

def detect(model, image_path):
    results = model.predict(image_path, conf=0.25, max_det=100, verbose=False)
    detections = []
    for r in results:
        for box in r.boxes:
            detections.append({
                'class': model.names[int(box.cls[0])],
                'class_id': int(box.cls[0]),
                'confidence': round(float(box.conf[0]), 3),
                'bbox': [round(float(x), 1) for x in box.xyxy[0].tolist()]
            })
    return detections

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: detect.py <image_path1> [image_path2 ...]'}))
        sys.exit(1)
    try:
        model = load_model()
        results = {}
        for path in sys.argv[1:]:
            if os.path.exists(path):
                results[path] = detect(model, path)
            else:
                results[path] = {'error': f'File not found: {path}'}
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
