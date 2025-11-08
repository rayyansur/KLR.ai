package com.app;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.tensorflow.lite.Interpreter;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;

public class DepthModelBridge extends ReactContextBaseJavaModule {
    
    private Interpreter tflite;
    private ReactApplicationContext reactContext;
    private static final String MODEL_FILE = "midas_v3.1_small.tflite";
    private static final int INPUT_SIZE = 256; // MiDaS small input size
    private static final int PIXEL_SIZE = 3; // RGB
    
    public DepthModelBridge(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }
    
    @Override
    public String getName() {
        return "DepthModelBridge";
    }
    
    @ReactMethod
    public void loadModel(String modelPath, Promise promise) {
        try {
            MappedByteBuffer modelBuffer = loadModelFile(modelPath);
            tflite = new Interpreter(modelBuffer);
            
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("LOAD_ERROR", "Failed to load MiDaS model", e);
        }
    }
    
    @ReactMethod
    public void estimateDepth(String imageUri, ReadableMap options, Promise promise) {
        if (tflite == null) {
            promise.reject("NOT_LOADED", "Model not loaded", (Throwable) null);
            return;
        }
        
        try {
            Bitmap bitmap = loadBitmap(imageUri);
            if (bitmap == null) {
                promise.reject("INVALID_IMAGE", "Failed to load image", (Throwable) null);
                return;
            }
            
            // Preprocess image
            ByteBuffer inputBuffer = preprocessImage(bitmap);
            
            // Model outputs UINT8 with shape [1, 256, 256, 1] = [batch, height, width, channels]
            // So we need a 4D array to match the tensor shape
            byte[][][][] outputArray = new byte[1][256][256][1];
            
            // Create output map for TensorFlow Lite
            java.util.Map<Integer, Object> outputMap = new java.util.HashMap<>();
            outputMap.put(0, outputArray);
            
            // Run inference
            tflite.runForMultipleInputsOutputs(new Object[]{inputBuffer}, outputMap);
            
            // Process output to depth map
            WritableArray depthMap = processDepthOutput(outputArray);
            
            WritableMap result = Arguments.createMap();
            result.putArray("depthMap", depthMap);
            result.putBoolean("success", true);
            promise.resolve(result);
            
        } catch (Exception e) {
            promise.reject("INFERENCE_ERROR", "Depth estimation failed", e);
        }
    }
    
    private MappedByteBuffer loadModelFile(String modelPath) throws IOException {
        AssetManager assetManager = reactContext.getAssets();
        InputStream inputStream = assetManager.open(modelPath);
        
        // Read InputStream into byte array
        byte[] buffer = new byte[inputStream.available()];
        inputStream.read(buffer);
        inputStream.close();
        
        // Create ByteBuffer from byte array
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(buffer.length);
        byteBuffer.put(buffer);
        byteBuffer.rewind();
        
        // Convert to MappedByteBuffer by creating a temporary file
        // Note: This is a workaround since we can't directly map from assets
        File tempFile = File.createTempFile("model", ".tflite", reactContext.getCacheDir());
        FileOutputStream fos = new FileOutputStream(tempFile);
        fos.write(buffer);
        fos.close();
        
        FileInputStream fileInputStream = new FileInputStream(tempFile);
        FileChannel fileChannel = fileInputStream.getChannel();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, 0, fileChannel.size());
    }
    
    private Bitmap loadBitmap(String imageUri) {
        try {
            if (imageUri.startsWith("file://")) {
                String filePath = imageUri.substring(7);
                return BitmapFactory.decodeFile(filePath);
            }
            // Add other URI handling as needed
            return null;
        } catch (Exception e) {
            return null;
        }
    }
    
    private ByteBuffer preprocessImage(Bitmap bitmap) {
        // Resize to model input size
        Bitmap resized = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true);
        
        // Model expects uint8 (not float32) - 256 * 256 * 3 = 196608 bytes
        ByteBuffer byteBuffer = ByteBuffer.allocateDirect(INPUT_SIZE * INPUT_SIZE * PIXEL_SIZE);
        byteBuffer.order(ByteOrder.nativeOrder());
        
        int[] pixels = new int[INPUT_SIZE * INPUT_SIZE];
        resized.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE);
        
        for (int pixel : pixels) {
            // Extract RGB as uint8 (0-255), not normalized floats
            byteBuffer.put((byte) ((pixel >> 16) & 0xFF)); // R
            byteBuffer.put((byte) ((pixel >> 8) & 0xFF));  // G
            byteBuffer.put((byte) (pixel & 0xFF));           // B
        }
        
        return byteBuffer;
    }
    
    private WritableArray processDepthOutput(byte[][][][] outputArray) {
        // Model outputs UINT8 with shape [1, 256, 256, 1] = [batch, height, width, channels]
        // Process UINT8 output - convert to normalized float [0, 1]
        WritableArray depthMap = Arguments.createArray();
        int height = 256;
        int width = 256;
        
        for (int y = 0; y < height; y++) {
            WritableArray row = Arguments.createArray();
            for (int x = 0; x < width; x++) {
                // Read UINT8 value from [batch=0][y][x][channel=0]
                int uint8Value = outputArray[0][y][x][0] & 0xFF;
                // Normalize to [0, 1] range
                float depth = uint8Value / 255.0f;
                row.pushDouble(depth);
            }
            depthMap.pushArray(row);
        }
        
        return depthMap;
    }
}

