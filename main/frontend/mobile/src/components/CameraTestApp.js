import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import TextDetectionService from '../services/TextDetectionService';
import DepthEstimationService from '../services/DepthEstimationService';
import CollisionDetectionService from '../services/CollisionDetectionService';
import BackendService from '../services/BackendService';

/**
 * Camera Test App Component
 * Replicates TestActivity.java functionality in React Native
 */
export default function CameraTestApp() {
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageWidth, setImageWidth] = useState(640);
  const [imageHeight, setImageHeight] = useState(480);
  const [statusLogs, setStatusLogs] = useState([]);
  const [textResult, setTextResult] = useState(null);
  const [depthResult, setDepthResult] = useState(null);
  const [collisionResult, setCollisionResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initialize services on mount
    initializeServices();
  }, []);

  const logStatus = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setStatusLogs(prev => [...prev, { message, timestamp }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const initializeServices = async () => {
    logStatus('Initializing services...');
    
    // Initialize ML Kit
    const textInit = await TextDetectionService.initialize();
    if (textInit.success) {
      logStatus('✅ ML Kit initialized');
    } else {
      logStatus('❌ ML Kit init failed: ' + textInit.error);
    }

    // Initialize Depth Model
    const depthInit = await DepthEstimationService.initialize();
    if (depthInit.success) {
      logStatus('✅ Depth model loaded');
    } else {
      logStatus('❌ Depth model load failed: ' + depthInit.error);
    }

    // Initialize Collision Detector
    const collisionInit = await CollisionDetectionService.initialize();
    if (collisionInit.success) {
      logStatus('✅ Collision detector initialized');
    } else {
      logStatus('❌ Collision detector init failed: ' + collisionInit.error);
    }
  };

  const captureImage = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
      },
      (response) => {
        if (response.didCancel) {
          logStatus('📷 Camera cancelled');
        } else if (response.errorMessage) {
          logStatus('❌ Camera error: ' + response.errorMessage);
        } else if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri);
          setImageBase64(asset.base64);
          setImageWidth(asset.width || 640);
          setImageHeight(asset.height || 480);
          logStatus('✅ Image captured: ' + (asset.width || 0) + 'x' + (asset.height || 0));
        }
      }
    );
  };

  const pickImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
      },
      (response) => {
        if (response.didCancel) {
          logStatus('🖼️ Image picker cancelled');
        } else if (response.errorMessage) {
          logStatus('❌ Image picker error: ' + response.errorMessage);
        } else if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri);
          setImageBase64(asset.base64);
          setImageWidth(asset.width || 640);
          setImageHeight(asset.height || 480);
          logStatus('✅ Image loaded: ' + (asset.width || 0) + 'x' + (asset.height || 0));
        }
      }
    );
  };

  const testTextDetection = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    setIsProcessing(true);
    logStatus('🔍 Detecting text in image...');

    try {
      const result = await TextDetectionService.detectText({
        uri: imageUri,
        width: imageWidth,
        height: imageHeight,
      });

      if (result.success) {
        setTextResult(result);
        logStatus('✅ Text detected!');
        logStatus('📝 Blocks found: ' + (result.regions?.length || 0));
        if (result.regions && result.regions.length > 0) {
          const preview = result.regions[0].text;
          logStatus('📄 Text: ' + (preview.length > 100 ? preview.substring(0, 100) + '...' : preview));
        }
        logStatus('✅ Text detection test PASSED!');
      } else {
        logStatus('❌ No text detected in image');
        setTextResult(null);
      }
    } catch (error) {
      logStatus('❌ Text detection failed: ' + error.message);
      setTextResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const testDepthEstimation = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    setIsProcessing(true);
    logStatus('📏 Estimating depth...');

    try {
      // Step 1: Get depth map from MiDaS
      const depthResult = await DepthEstimationService.estimateDepth({
        uri: imageUri,
        width: imageWidth,
        height: imageHeight,
      });

      if (!depthResult.success || !depthResult.depth_map) {
        throw new Error('Failed to generate depth map');
      }

      const depthMap = depthResult.depth_map;
      
      // Calculate depth stats
      let minDepth = Infinity;
      let maxDepth = -Infinity;
      let sumDepth = 0;
      let pixelCount = 0;

      for (let y = 0; y < depthMap.length; y++) {
        for (let x = 0; x < depthMap[y].length; x++) {
          const depth = depthMap[y][x];
          if (depth > 0) {
            minDepth = Math.min(minDepth, depth);
            maxDepth = Math.max(maxDepth, depth);
            sumDepth += depth;
            pixelCount++;
          }
        }
      }

      const avgDepth = pixelCount > 0 ? sumDepth / pixelCount : 0;

      logStatus('✅ Depth estimation complete!');
      logStatus('📊 Depth stats:');
      logStatus('   Min: ' + minDepth.toFixed(2));
      logStatus('   Max: ' + maxDepth.toFixed(2));
      logStatus('   Avg: ' + avgDepth.toFixed(2));

      // Step 2: Get YOLO detections from backend
      logStatus('🔍 Getting object detections from backend...');
      const detectionResult = await BackendService.getObjectDetections(imageBase64, imageWidth, imageHeight);

      if (!detectionResult.success || !detectionResult.labeledObjects || detectionResult.labeledObjects.length === 0) {
        logStatus('⚠️ No objects detected by YOLO');
        setDepthResult({ depthMap, stats: { min: minDepth, max: maxDepth, avg: avgDepth } });
        setCollisionResult(null);
        setIsProcessing(false);
        return;
      }

      logStatus('✅ Found ' + detectionResult.labeledObjects.length + ' objects from YOLO');

      // Step 3: Analyze collision threats
      logStatus('⚠️ Analyzing collision threats...');
      const collisionResult = await CollisionDetectionService.analyzeLabeledObjects(
        depthMap,
        detectionResult.labeledObjects
      );

      if (collisionResult.success) {
        setCollisionResult(collisionResult);
        logStatus('');
        logStatus('📦 Collision Analysis (' + collisionResult.objects.length + ' objects analyzed):');
        
        if (collisionResult.objects.length === 0) {
          logStatus('   ✅ No collision threats detected - SAFE');
        } else {
          collisionResult.objects.forEach((obj, index) => {
            logStatus('   ┌─ ' + obj.label + ' (' + obj.objectId + ')');
            logStatus('   │  Bbox: [' + obj.bbox.join(', ') + ']');
            logStatus('   │  Direction: ' + obj.direction);
            logStatus('   │  Angle: ' + obj.angleDeg.toFixed(1) + '°');
            logStatus('   │  Danger Level: ' + obj.dangerLevel);
            logStatus('   │  Confidence: ' + obj.confidenceScore.toFixed(2));
            if (obj.reasonForDanger) {
              logStatus('   │  Reason: ' + obj.reasonForDanger);
            }
            logStatus('   └─');
          });
        }
      }

      setDepthResult({ depthMap, stats: { min: minDepth, max: maxDepth, avg: avgDepth } });
      logStatus('');
      logStatus('✅ Depth estimation test PASSED!');

    } catch (error) {
      logStatus('❌ Depth estimation failed: ' + error.message);
      console.error('Depth estimation error:', error);
      setDepthResult(null);
      setCollisionResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        ref={(ref) => {
          // Auto-scroll to bottom
          if (ref && statusLogs.length > 0) {
            setTimeout(() => ref.scrollToEnd({ animated: true }), 100);
          }
        }}
      >
        <Text style={styles.title}>Depth Estimation & Collision Detection</Text>
        <Text style={styles.subtitle}>
          1. Capture or pick an image{'\n'}
          2. Test text detection and depth estimation
        </Text>

        {/* Image Display */}
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        )}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={captureImage}>
            <Text style={styles.buttonText}>📷 Capture</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>🖼️ Pick Image</Text>
          </TouchableOpacity>
        </View>

        {/* Test Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.testButton, (!imageUri || isProcessing) && styles.buttonDisabled]} 
            onPress={testTextDetection}
            disabled={!imageUri || isProcessing}
          >
            <Text style={styles.buttonText}>🔍 Test Text Detection</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.testButton, (!imageUri || isProcessing) && styles.buttonDisabled]} 
            onPress={testDepthEstimation}
            disabled={!imageUri || isProcessing}
          >
            <Text style={styles.buttonText}>📏 Test Depth Estimation</Text>
          </TouchableOpacity>
        </View>

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}

        {/* Status Logs */}
        <View style={styles.logsContainer}>
          <Text style={styles.logsTitle}>Status Log:</Text>
          {statusLogs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log.message}
            </Text>
          ))}
        </View>

        {/* Text Detection Results */}
        {textResult && textResult.success && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>📝 Text Detection Results:</Text>
            <Text style={styles.resultText}>
              Blocks: {textResult.regions?.length || 0}
            </Text>
            {textResult.regions && textResult.regions.slice(0, 3).map((region, index) => (
              <Text key={index} style={styles.resultText}>
                • {region.text}
              </Text>
            ))}
          </View>
        )}

        {/* Collision Analysis Results */}
        {collisionResult && collisionResult.success && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>⚠️ Collision Analysis Results:</Text>
            {collisionResult.objects.length === 0 ? (
              <Text style={[styles.resultText, styles.safeText]}>
                ✅ No collision threats detected - SAFE
              </Text>
            ) : (
              collisionResult.objects.map((obj, index) => (
                <View key={index} style={styles.objectResult}>
                  <Text style={styles.objectLabel}>
                    {obj.label} ({obj.objectId})
                  </Text>
                  <Text style={styles.objectDetail}>
                    Direction: {obj.direction} | Angle: {obj.angleDeg.toFixed(1)}°
                  </Text>
                  <Text style={[
                    styles.objectDanger,
                    { color: CollisionDetectionService.getDangerLevelColor(obj.dangerLevel) }
                  ]}>
                    Danger: {CollisionDetectionService.getDangerLevelLabel(obj.dangerLevel)}
                  </Text>
                  {obj.reasonForDanger && (
                    <Text style={styles.objectReason}>{obj.reasonForDanger}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    marginTop: 10,
    color: '#666',
  },
  logsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    maxHeight: 300,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  logText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  safeText: {
    color: '#34C759',
    fontWeight: '600',
  },
  objectResult: {
    backgroundColor: '#F9F9F9',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  objectLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  objectDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  objectDanger: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  objectReason: {
    fontSize: 11,
    color: '#999',
    marginTop: 3,
    fontStyle: 'italic',
  },
});

