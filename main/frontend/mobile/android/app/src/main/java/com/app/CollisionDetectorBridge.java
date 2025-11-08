package com.app;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.List;

/**
 * React Native bridge for collision detection using RelativeCollisionDetector
 */
public class CollisionDetectorBridge extends ReactContextBaseJavaModule {
    
    private ReactApplicationContext reactContext;
    
    public CollisionDetectorBridge(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }
    
    @Override
    public String getName() {
        return "CollisionDetectorBridge";
    }
    
    @ReactMethod
    public void analyzeLabeledObjects(ReadableArray depthMapArray, ReadableArray labeledObjectsArray, Promise promise) {
        try {
            // Convert depth map from React Native array to float[][]
            float[][] depthMap = convertDepthMapFromRN(depthMapArray);
            
            // Convert labeled objects from React Native array to List<LabeledObject>
            List<RelativeCollisionDetector.LabeledObject> labeledObjects = convertLabeledObjectsFromRN(labeledObjectsArray);
            
            // Run collision detection
            RelativeCollisionDetector detector = new RelativeCollisionDetector();
            List<RelativeCollisionDetector.DetectedObject> results = detector.analyzeLabeledObjects(depthMap, labeledObjects);
            
            // Convert results back to React Native format
            WritableArray resultsArray = convertDetectedObjectsToRN(results);
            
            WritableMap result = Arguments.createMap();
            result.putArray("objects", resultsArray);
            result.putBoolean("success", true);
            promise.resolve(result);
            
        } catch (Exception e) {
            promise.reject("ANALYSIS_ERROR", "Collision detection failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Convert React Native depth map array to float[][]
     */
    private float[][] convertDepthMapFromRN(ReadableArray depthMapArray) {
        int height = depthMapArray.size();
        if (height == 0) {
            return new float[0][0];
        }
        
        ReadableArray firstRow = depthMapArray.getArray(0);
        int width = firstRow.size();
        
        float[][] depthMap = new float[height][width];
        
        for (int y = 0; y < height; y++) {
            ReadableArray row = depthMapArray.getArray(y);
            for (int x = 0; x < width; x++) {
                depthMap[y][x] = (float)row.getDouble(x);
            }
        }
        
        return depthMap;
    }
    
    /**
     * Convert React Native labeled objects array to List<LabeledObject>
     */
    private List<RelativeCollisionDetector.LabeledObject> convertLabeledObjectsFromRN(ReadableArray labeledObjectsArray) {
        List<RelativeCollisionDetector.LabeledObject> labeledObjects = new ArrayList<>();
        
        for (int i = 0; i < labeledObjectsArray.size(); i++) {
            ReadableMap objMap = labeledObjectsArray.getMap(i);
            
            String objectId = objMap.getString("objectId");
            String label = objMap.getString("label");
            ReadableArray bboxArray = objMap.getArray("bbox");
            float detectionConfidence = (float)objMap.getDouble("detectionConfidence");
            
            // Convert bbox array to int[]
            int[] bbox = new int[4];
            bbox[0] = bboxArray.getInt(0); // x1
            bbox[1] = bboxArray.getInt(1); // y1
            bbox[2] = bboxArray.getInt(2); // x2
            bbox[3] = bboxArray.getInt(3); // y2
            
            labeledObjects.add(new RelativeCollisionDetector.LabeledObject(objectId, label, bbox, detectionConfidence));
        }
        
        return labeledObjects;
    }
    
    /**
     * Convert DetectedObject list to React Native array
     */
    private WritableArray convertDetectedObjectsToRN(List<RelativeCollisionDetector.DetectedObject> detectedObjects) {
        WritableArray resultsArray = Arguments.createArray();
        
        for (RelativeCollisionDetector.DetectedObject obj : detectedObjects) {
            WritableMap objMap = Arguments.createMap();
            
            objMap.putString("objectId", obj.objectId);
            objMap.putString("label", obj.label);
            
            // Convert bbox to array
            WritableArray bboxArray = Arguments.createArray();
            bboxArray.pushInt(obj.bbox[0]);
            bboxArray.pushInt(obj.bbox[1]);
            bboxArray.pushInt(obj.bbox[2]);
            bboxArray.pushInt(obj.bbox[3]);
            objMap.putArray("bbox", bboxArray);
            
            objMap.putDouble("centerX", obj.centerX);
            objMap.putDouble("centerY", obj.centerY);
            objMap.putDouble("maxDepth", obj.maxDepth);
            objMap.putDouble("medianDepth", obj.medianDepth);
            objMap.putDouble("depthVariance", obj.depthVariance);
            objMap.putDouble("depthGradient", obj.depthGradient);
            objMap.putString("direction", obj.direction);
            objMap.putDouble("angleDeg", obj.angleDeg);
            objMap.putDouble("confidenceScore", obj.confidenceScore);
            
            // Convert DangerLevel enum to string
            objMap.putString("dangerLevel", obj.danger.toString());
            
            if (obj.reasonForDanger != null) {
                objMap.putString("reasonForDanger", obj.reasonForDanger);
            }
            
            resultsArray.pushMap(objMap);
        }
        
        return resultsArray;
    }
}

