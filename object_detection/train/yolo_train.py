# train_yolo_household.py
from ultralytics import YOLO

def main():
    # Path to your dataset YAML file (edit this to your dataset path)
    data_yaml = "data.yaml"

    # Load a pretrained YOLOv8 model (you can use yolov8n.pt, yolov8s.pt, etc.)
    model = YOLO("../model/yolov8n.pt")

    # Train the model
    model.train(
        data=data_yaml,     # path to dataset YAML
        epochs=50,          # training duration
        imgsz=640,          # image size for training
        batch=16,           # adjust based on your GPU
        name="household_objects",  # output folder name
        pretrained=True,    # start from pretrained weights
    )

    # Evaluate performance on validation set
    model.val()

    # Export trained weights to ONNX or CoreML if needed
    model.export(format="onnx")  # optional

if __name__ == "__main__":
    main()