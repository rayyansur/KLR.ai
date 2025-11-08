package com.app;

import java.util.List;
import java.util.ArrayList;
import java.util.Collections;

/**
 * Relative Collision Detector - Pure relative depth analysis (no absolute calibration)
 * Uses labeled objects with bboxes from YOLO/detection system
 */
public class RelativeCollisionDetector {
    
    // Danger classification levels
    public enum DangerLevel {
        CRITICAL_COLLISION,   // Immediate collision risk (< 0.5 seconds)
        HIGH_WARNING,         // Very close, impending danger
        MODERATE_WARNING,     // Close, attention needed
        LOW_WARNING,          // Detected but distant
        SAFE                  // Far away, no concern
    }
    
    // Scene analysis result
    private static class SceneAnalysis {
        float backgroundDepth;      // Typical background (median)
        float foregroundThreshold;  // What counts as "foreground"
        float p25, p50, p75, p90;  // Depth percentiles
        float min, max;             // Depth range
        
        SceneAnalysis(float[][] depthMap) {
            analyzeScene(depthMap);
        }
        
        private void analyzeScene(float[][] depthMap) {
            // Collect all depth values
            List<Float> allDepths = new ArrayList<>();
            int height = depthMap.length;
            int width = depthMap[0].length;
            
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    allDepths.add(depthMap[y][x]);
                }
            }
            
            Collections.sort(allDepths);
            int n = allDepths.size();
            
            // Calculate percentiles
            this.min = allDepths.get(0);
            this.max = allDepths.get(n - 1);
            this.p25 = allDepths.get(n / 4);
            this.p50 = allDepths.get(n / 2);  // Median
            this.p75 = allDepths.get(3 * n / 4);
            this.p90 = allDepths.get(9 * n / 10);
            
            // Background = median (most of scene)
            this.backgroundDepth = p50;
            
            // Foreground = anything significantly above 75th percentile
            // (closer than 75% of the scene)
            this.foregroundThreshold = p75 + (p90 - p75) * 0.5f;
        }
    }
    
    // Labeled object from YOLO/detection system
    public static class LabeledObject {
        public String objectId;      // Unique identifier (e.g., "person_1")
        public String label;         // Object class label (e.g., "person", "chair", "car")
        public int[] bbox;           // Bounding box [x1, y1, x2, y2] in image coordinates
        public float detectionConfidence;  // Detection confidence from YOLO (0.0-1.0)
        
        public LabeledObject(String objectId, String label, int[] bbox, float detectionConfidence) {
            this.objectId = objectId;
            this.label = label;
            this.bbox = bbox;
            this.detectionConfidence = detectionConfidence;
        }
    }
    
    // Object with danger assessment
    public static class DetectedObject {
        public String objectId;
        public String label;         // Object class label from YOLO
        public int[] bbox;
        public float centerX, centerY;
        public float maxDepth;           // Highest depth value (closest point)
        public float medianDepth;      // Median depth in bbox
        public float depthVariance;    // How varied is depth?
        public float depthGradient;    // Edge strength
        public DangerLevel danger;
        public String direction;
        public float angleDeg;
        public float confidenceScore;  // How confident in this detection
        public String reasonForDanger; // Explanation for debugging/logging
    }
    
    /**
     * Main collision analysis method - analyzes labeled objects with bboxes
     * @param inverseDepthMap Normalized inverse depth map from MiDaS [0,1]
     * @param labeledObjects List of labeled objects with bboxes from YOLO/detection system
     * @return List of analyzed objects with danger levels
     */
    public List<DetectedObject> analyzeLabeledObjects(float[][] inverseDepthMap, List<LabeledObject> labeledObjects) {
        List<DetectedObject> results = new ArrayList<>();
        
        if (labeledObjects == null || labeledObjects.isEmpty()) {
            return results;
        }
        
        // 1. Analyze the scene to understand context
        SceneAnalysis scene = new SceneAnalysis(inverseDepthMap);
        
        // 2. Analyze each labeled object for collision threat
        for (LabeledObject labeledObj : labeledObjects) {
            DetectedObject obj = analyzeLabeledObject(inverseDepthMap, labeledObj, scene);
            
            // 3. Calculate collision danger
            obj.danger = calculateDangerLevel(obj, scene, inverseDepthMap);
            
            // 4. Add to results (include all objects, even if SAFE, for complete analysis)
            results.add(obj);
        }
        
        // 5. Sort by danger level (most dangerous first)
        results.sort((a, b) -> b.danger.compareTo(a.danger));
        
        return results;
    }
    
    /**
     * Analyze a labeled object region using its provided bbox
     */
    private DetectedObject analyzeLabeledObject(float[][] depthMap, LabeledObject labeledObj, SceneAnalysis scene) {
        DetectedObject obj = new DetectedObject();
        obj.objectId = labeledObj.objectId;
        obj.label = labeledObj.label;
        obj.bbox = labeledObj.bbox;
        
        int x1 = labeledObj.bbox[0], y1 = labeledObj.bbox[1];
        int x2 = labeledObj.bbox[2], y2 = labeledObj.bbox[3];
        
        // Calculate center
        obj.centerX = (x1 + x2) / 2.0f;
        obj.centerY = (y1 + y2) / 2.0f;
        
        // Sample depth values in bbox
        List<Float> depthSamples = new ArrayList<>();
        int height = depthMap.length;
        int width = depthMap[0].length;
        
        for (int y = y1; y <= y2; y++) {
            for (int x = x1; x <= x2; x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    depthSamples.add(depthMap[y][x]);
                }
            }
        }
        
        if (depthSamples.isEmpty()) {
            obj.maxDepth = 0;
            obj.medianDepth = 0;
            obj.depthVariance = 0;
            return obj;
        }
        
        Collections.sort(depthSamples);
        
        // Key metrics
        obj.maxDepth = depthSamples.get(depthSamples.size() - 1); // Closest point
        obj.medianDepth = depthSamples.get(depthSamples.size() / 2);
        
        // Depth variance (how uniform is the object?)
        float mean = 0;
        for (float d : depthSamples) mean += d;
        mean /= depthSamples.size();
        
        float variance = 0;
        for (float d : depthSamples) {
            variance += (d - mean) * (d - mean);
        }
        obj.depthVariance = variance / depthSamples.size();
        
        // Calculate depth gradient at object center
        int cx = (int)obj.centerX;
        int cy = (int)obj.centerY;
        obj.depthGradient = calculateLocalGradient(depthMap, cx, cy);
        
        // Direction and angle
        obj.direction = calculateDirection(obj.centerX, obj.centerY, width, height);
        obj.angleDeg = calculateAngle(obj.centerX, obj.centerY, width, height);
        
        return obj;
    }
    
    /**
     * Calculate collision danger level - THE CORE ALGORITHM
     */
    private DangerLevel calculateDangerLevel(DetectedObject obj, SceneAnalysis scene, float[][] depthMap) {
        int height = depthMap.length;
        int width = depthMap[0].length;
        
        // FACTOR 1: Absolute Closeness (relative to scene range)
        // Map depth to 0-1 scale where 1 = closest possible
        float normalizedCloseness = (obj.maxDepth - scene.min) / (scene.max - scene.min);
        float closenessScore = 0;
        
        if (normalizedCloseness > 0.95f) closenessScore = 1.0f;      // Extreme
        else if (normalizedCloseness > 0.85f) closenessScore = 0.7f; // Very close
        else if (normalizedCloseness > 0.75f) closenessScore = 0.5f; // Close
        else if (normalizedCloseness > 0.65f) closenessScore = 0.3f; // Moderate
        else closenessScore = 0.1f;                                   // Distant
        
        // FACTOR 2: Relative to Scene Background
        // How much closer than typical background?
        float relativeCloseness = obj.medianDepth / scene.backgroundDepth;
        float relativeScore = 0;
        
        if (relativeCloseness > 2.0f) relativeScore = 0.8f;      // 2x closer than background
        else if (relativeCloseness > 1.5f) relativeScore = 0.5f; // 1.5x closer
        else if (relativeCloseness > 1.2f) relativeScore = 0.3f; // 1.2x closer
        else relativeScore = 0.1f;
        
        // FACTOR 3: Position in Frame (center = more dangerous)
        float centerX = width / 2.0f;
        float centerY = height / 2.0f;
        float distFromCenter = (float)Math.sqrt(
            Math.pow(obj.centerX - centerX, 2) + 
            Math.pow(obj.centerY - centerY, 2)
        );
        float maxDistFromCenter = (float)Math.sqrt(
            Math.pow(centerX, 2) + Math.pow(centerY, 2)
        );
        float positionScore = 1.0f - (distFromCenter / maxDistFromCenter);
        
        // Boost for bottom-center (walking path)
        boolean inWalkingPath = obj.centerY > height * 0.5f && 
                                Math.abs(obj.centerX - centerX) < width * 0.3f;
        if (inWalkingPath) {
            positionScore *= 1.3f;
        }
        
        // FACTOR 4: Depth Gradient (strong edge = obstacle)
        float gradientScore = Math.min(1.0f, obj.depthGradient * 3.0f);
        
        // FACTOR 5: Object Size (larger objects more concerning)
        int area = (obj.bbox[2] - obj.bbox[0]) * (obj.bbox[3] - obj.bbox[1]);
        int frameArea = width * height;
        float sizeRatio = (float)area / frameArea;
        float sizeScore = Math.min(1.0f, sizeRatio * 5.0f); // Objects >20% of frame get max score
        
        // FACTOR 6: Depth Uniformity (uniform = solid object, varied = noisy/far)
        float uniformityScore = obj.depthVariance < 0.01f ? 1.0f : 
                               obj.depthVariance < 0.05f ? 0.7f : 0.3f;
        
        // CALCULATE TOTAL DANGER SCORE (weighted combination)
        float dangerScore = 
            closenessScore * 0.35f +      // Most important: how close?
            relativeScore * 0.25f +       // Is it foreground or background?
            positionScore * 0.20f +       // Is it in my path?
            gradientScore * 0.10f +       // Is it a real obstacle?
            sizeScore * 0.05f +           // How big is it?
            uniformityScore * 0.05f;      // Is it solid?
        
        // Build explanation
        StringBuilder reason = new StringBuilder();
        reason.append(String.format("Closeness:%.2f ", closenessScore));
        reason.append(String.format("Relative:%.2f ", relativeScore));
        reason.append(String.format("Position:%.2f ", positionScore));
        reason.append(String.format("Total:%.2f", dangerScore));
        obj.reasonForDanger = reason.toString();
        obj.confidenceScore = dangerScore;
        
        // CLASSIFY DANGER LEVEL
        if (dangerScore >= 0.75f) {
            return DangerLevel.CRITICAL_COLLISION;
        } else if (dangerScore >= 0.55f) {
            return DangerLevel.HIGH_WARNING;
        } else if (dangerScore >= 0.35f) {
            return DangerLevel.MODERATE_WARNING;
        } else if (dangerScore >= 0.20f) {
            return DangerLevel.LOW_WARNING;
        } else {
            return DangerLevel.SAFE;
        }
    }
    
    /**
     * Calculate local depth gradient (edge strength)
     */
    private float calculateLocalGradient(float[][] depthMap, int x, int y) {
        int height = depthMap.length;
        int width = depthMap[0].length;
        
        if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) {
            return 0;
        }
        
        // Sobel operator
        float gx = 
            -1 * depthMap[y-1][x-1] + 1 * depthMap[y-1][x+1] +
            -2 * depthMap[y][x-1]   + 2 * depthMap[y][x+1] +
            -1 * depthMap[y+1][x-1] + 1 * depthMap[y+1][x+1];
        
        float gy = 
            -1 * depthMap[y-1][x-1] - 2 * depthMap[y-1][x] - 1 * depthMap[y-1][x+1] +
             1 * depthMap[y+1][x-1] + 2 * depthMap[y+1][x] + 1 * depthMap[y+1][x+1];
        
        return (float)Math.sqrt(gx * gx + gy * gy) / 8.0f; // Normalize
    }
    
    /**
     * Direction helper
     */
    private String calculateDirection(float x, float y, int width, int height) {
        float centerX = width / 2.0f;
        float offsetX = x - centerX;
        
        if (Math.abs(offsetX) < width * 0.2f) {
            return "center";
        } else if (offsetX < 0) {
            return "left";
        } else {
            return "right";
        }
    }
    
    /**
     * Calculate angle in degrees
     */
    private float calculateAngle(float x, float y, int width, int height) {
        float centerX = width / 2.0f;
        float centerY = height / 2.0f;
        float offsetX = x - centerX;
        float offsetY = y - centerY;
        
        double angleRad = Math.atan2(offsetX, Math.abs(offsetY));
        return (float)(angleRad * 180.0 / Math.PI);
    }
}

