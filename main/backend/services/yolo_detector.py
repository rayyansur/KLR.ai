# yolo_detector.py
from ultralytics import YOLO
import os

# Load YOLO model once at import
MODEL_PATH = os.getenv("YOLO_MODEL_PATH")
# Use default YOLO model if path not provided (will download automatically)
if MODEL_PATH:
    model = YOLO(MODEL_PATH)
else:
    # Use default YOLOv8 model (will download on first use)
    model = YOLO('yolov8n.pt')


def yolo_detect(image_path: str):
    try:
        # Check if image file exists
        if not os.path.exists(image_path):
            return {"Objects": []}
        
        # Run YOLO inference
        results = model.predict(image_path, verbose=False)
        result = results[0]

        objects = []
        if hasattr(result, 'boxes') and result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0]  # tensor -> [x1, y1, x2, y2]
                objects.append({
                    "class": result.names[cls_id],
                    "confidence": round(conf, 3),
                    "position": {
                        "x1": float(x1),
                        "y1": float(y1),
                        "x2": float(x2),
                        "y2": float(y2)
                    }
                })

        return {"Objects": objects}
    except Exception as e:
        print(f"Error in yolo_detect: {e}")
        return {"Objects": []}

# Example standalone test
if __name__ == "__main__":
    sample_image = "test.jpg"
    output = yolo_detect(sample_image)
    print(output)
