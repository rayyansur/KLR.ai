# yolo_detector.py
from ultralytics import YOLO
import os

# Load YOLO model once at import
MODEL_PATH = os.getenv("YOLO_MODEL_PATH")
model = YOLO(MODEL_PATH)


def yolo_detect(image_path: str):
    # Run YOLO inference
    results = model.predict(image_path, verbose=False)
    result = results[0]

    detections = []
    for box in result.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        xywhn = box.xywhn[0].tolist()  # normalized [x_center, y_center, w, h]
        label = result.names[cls_id]

        detections.append({
            "class": label,
            "confidence": round(conf, 3),
            "position": {
                "x_center": round(xywhn[0], 4),
                "y_center": round(xywhn[1], 4),
                "width": round(xywhn[2], 4),
                "height": round(xywhn[3], 4)
            }
        })

    return {"detections": detections}


# Example standalone test
if __name__ == "__main__":
    sample_image = "test.jpg"
    output = yolo_detect(sample_image)
    print(output)
