package com.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

public class MLKitBridge extends ReactContextBaseJavaModule {
    
    private TextRecognizer textRecognizer;
    private ReactApplicationContext reactContext;
    
    public MLKitBridge(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }
    
    @Override
    public String getName() {
        return "MLKitBridge";
    }
    
    @ReactMethod
    public void initialize(Promise promise) {
        try {
            textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("INIT_ERROR", "Failed to initialize ML Kit", e);
        }
    }
    
    @ReactMethod
    public void recognizeText(String imageUri, Promise promise) {
        if (textRecognizer == null) {
            promise.reject("NOT_INITIALIZED", "Text recognizer not initialized", (Throwable) null);
            return;
        }
        
        try {
            InputImage image = loadImage(imageUri);
            if (image == null) {
                promise.reject("INVALID_IMAGE", "Failed to load image from URI", (Throwable) null);
                return;
            }
            
            textRecognizer.process(image)
                .addOnSuccessListener(visionText -> {
                    WritableMap result = processTextRecognitionResult(visionText);
                    promise.resolve(result);
                })
                .addOnFailureListener(e -> {
                    promise.reject("RECOGNITION_ERROR", "Text recognition failed", e);
                });
        } catch (Exception e) {
            promise.reject("LOAD_ERROR", "Failed to load image", e);
        }
    }
    
    private InputImage loadImage(String uri) throws IOException {
        // Handle file:// URIs
        if (uri.startsWith("file://")) {
            String filePath = uri.substring(7);
            File file = new File(filePath);
            Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
            return InputImage.fromBitmap(bitmap, 0);
        }
        
        // Handle base64
        if (uri.startsWith("data:image")) {
            String base64String = uri.substring(uri.indexOf(",") + 1);
            byte[] imageBytes = Base64.decode(base64String, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            return InputImage.fromBitmap(bitmap, 0);
        }
        
        // Try as direct file path
        File file = new File(uri);
        if (file.exists()) {
            Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
            return InputImage.fromBitmap(bitmap, 0);
        }
        
        // Try as content URI
        try {
            Uri contentUri = Uri.parse(uri);
            return InputImage.fromFilePath(reactContext, contentUri);
        } catch (Exception e) {
            return null;
        }
    }
    
    private WritableMap processTextRecognitionResult(com.google.mlkit.vision.text.Text visionText) {
        WritableMap result = Arguments.createMap();
        result.putString("text", visionText.getText());
        
        WritableArray blocks = Arguments.createArray();
        
        for (com.google.mlkit.vision.text.Text.TextBlock block : visionText.getTextBlocks()) {
            WritableMap blockMap = Arguments.createMap();
            
            WritableArray lines = Arguments.createArray();
            for (com.google.mlkit.vision.text.Text.Line line : block.getLines()) {
                WritableMap lineMap = Arguments.createMap();
                lineMap.putString("text", line.getText());
                
                // Get bounding box
                android.graphics.Rect bbox = line.getBoundingBox();
                if (bbox != null) {
                    WritableArray cornerPoints = Arguments.createArray();
                    cornerPoints.pushInt(bbox.left);
                    cornerPoints.pushInt(bbox.top);
                    cornerPoints.pushInt(bbox.right);
                    cornerPoints.pushInt(bbox.bottom);
                    lineMap.putArray("cornerPoints", cornerPoints);
                }
                
                lines.pushMap(lineMap);
            }
            
            blockMap.putArray("lines", lines);
            blocks.pushMap(blockMap);
        }
        
        result.putArray("blocks", blocks);
        return result;
    }
}

