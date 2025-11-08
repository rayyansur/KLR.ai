import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Camera } from 'expo-camera';
import TextDetectionService from '../services/TextDetectionService';
import DepthEstimationService from '../services/DepthEstimationService';
import CollisionDetectionService from '../services/CollisionDetectionService';
import BackendService from '../services/BackendService';
import VoiceService from '../services/VoiceService';
import AccessibilityOverlay from './AccessibilityOverlay';
import ResultsPanel from './ResultsPanel';

const { width, height } = Dimensions.get('window');

/**
 * Main Production App Component
 * Full-featured app for visually impaired users with:
 * - Real-time camera view
 * - Text detection
 * - Collision detection
 * - Voice query interface
 * - LLM responses
 */
export default function MainApp() {
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraType, setCameraType] = useState(Camera.Constants.Type.back);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto', 'text', 'query'
  const [status, setStatus] = useState('Ready');
  
  // Detection results
  const [textResult, setTextResult] = useState(null);
  const [collisionResult, setCollisionResult] = useState(null);
  const [llmResponse, setLlmResponse] = useState(null);
  const [queryText, setQueryText] = useState('');
  
  // Services initialized
  const [servicesReady, setServicesReady] = useState(false);
  
  const cameraRef = useRef(null);
  const processingIntervalRef = useRef(null);
  const cameraReadyTimeoutRef = useRef(null);
  const cameraReadyRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    // Request camera permissions
    (async () => {
      try {
        // Use Camera.requestCameraPermissionsAsync for expo-camera v13.4.4
        const { status } = await Camera.requestCameraPermissionsAsync();
        console.log('Camera permission status:', status);
        setHasPermission(status === 'granted');
        if (status === 'granted') {
          console.log('✅ Camera permission granted');
          setStatus('Camera ready');
        } else {
          console.log('❌ Camera permission denied');
          setStatus('Camera permission denied');
        }
      } catch (error) {
        console.error('Camera permission error:', error);
        setHasPermission(false);
        setStatus('Camera permission error: ' + error.message);
      }
    })();
    
    // Initialize services (non-blocking)
    initializeServices();
    
    return () => {
      // Cleanup
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      if (cameraReadyTimeoutRef.current) {
        clearTimeout(cameraReadyTimeoutRef.current);
      }
    };
  }, []);

  const initializeServices = async () => {
    try {
      setStatus('Initializing services...');
      
      // Initialize all services - don't block camera if they fail
      const [textInit, depthInit, collisionInit] = await Promise.allSettled([
        TextDetectionService.initialize().catch(e => ({ success: false, error: e.message })),
        DepthEstimationService.initialize().catch(e => ({ success: false, error: e.message })),
        CollisionDetectionService.initialize().catch(e => ({ success: false, error: e.message })),
      ]);
      
      const textSuccess = textInit.status === 'fulfilled' && textInit.value?.success;
      const depthSuccess = depthInit.status === 'fulfilled' && depthInit.value?.success;
      const collisionSuccess = collisionInit.status === 'fulfilled' && collisionInit.value?.success;
      
      // Allow camera to work even if some services fail
      setServicesReady(true);
      
      if (textSuccess && depthSuccess && collisionSuccess) {
        setStatus('Services ready');
      } else {
        setStatus('Camera ready (some services unavailable)');
        console.warn('Some services failed to initialize:', {
          text: !textSuccess,
          depth: !depthSuccess,
          collision: !collisionSuccess
        });
      }
    } catch (error) {
      console.error('Service initialization error:', error);
      // Still allow camera to work
      setServicesReady(true);
      setStatus('Camera ready');
    }
  };

  const captureAndProcess = async () => {
    if (isProcessing) {
      return;
    }
    
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready. Please wait a moment and try again.');
      return;
    }

    setIsProcessing(true);
    setStatus('Capturing image...');

    try {
      console.log('Attempting to capture photo...');
      // Capture photo - this works even if preview doesn't show on emulator
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });
      console.log('Photo captured successfully:', photo ? 'yes' : 'no');
      
      // Mark camera as ready if capture works (even if preview doesn't show)
      if (photo && !cameraReadyRef.current) {
        console.log('Camera is functional (capture works), marking as ready');
        cameraReadyRef.current = true;
        setCameraReady(true);
      }

      if (!photo || !photo.uri) {
        throw new Error('Failed to capture image');
      }

      // Check if base64 is available
      if (!photo.base64) {
        throw new Error('Failed to get base64 image data. Please try again.');
      }

      const imageWidth = photo.width || 640;
      const imageHeight = photo.height || 480;

      // Process based on mode
      if (mode === 'auto' || mode === 'collision') {
        await processCollisionDetection(photo, imageWidth, imageHeight);
      }
      
      if (mode === 'auto' || mode === 'text') {
        await processTextDetection(photo);
      }

      setStatus('Processing complete');
    } catch (error) {
      console.error('Processing error:', error);
      setStatus('Error: ' + error.message);
      Alert.alert('Error', 'Failed to process image: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processTextDetection = async (photo) => {
    try {
      const result = await TextDetectionService.detectText({
        uri: photo.uri,
        width: photo.width || 640,
        height: photo.height || 480,
      });

      if (result.success && result.regions && result.regions.length > 0) {
        setTextResult(result);
        // Announce detected text
        const textPreview = result.regions.slice(0, 3).map(r => r.text).join(', ');
        setStatus(`Text detected: ${textPreview}`);
      } else {
        setTextResult(null);
      }
    } catch (error) {
      console.error('Text detection error:', error);
    }
  };

  const processCollisionDetection = async (photo, imageWidth, imageHeight) => {
    try {
      setStatus('Running YOLO detection...');
      
      // Step 1: Run YOLO first to detect objects (labels + bboxes)
      const detectionResult = await BackendService.getObjectDetections(
        photo.base64,
        imageWidth,
        imageHeight
      );

      if (!detectionResult.success) {
        setStatus(`Detection error: ${detectionResult.error || 'Unknown error'}`);
        return;
      }

      if (!detectionResult.labeledObjects || detectionResult.labeledObjects.length === 0) {
        setStatus('No objects detected');
        setCollisionResult(null);
        return;
      }

      setStatus('Running MiDaS depth estimation...');

      // Step 2: Run MiDaS to get depth heatmap (runs in parallel with YOLO if possible)
      let depthMap = null;
      try {
        const depthResult = await DepthEstimationService.estimateDepth({
          uri: photo.uri,
          width: imageWidth,
          height: imageHeight,
        });
        if (depthResult.success && depthResult.depth_map) {
          depthMap = depthResult.depth_map;
        }
      } catch (depthError) {
        console.warn('Depth estimation failed, continuing without depth:', depthError);
        setStatus('Depth estimation failed, using YOLO detections only');
      }

      // Step 3: Combine YOLO detections (labels + bboxes) with MiDaS heatmap
      // This determines how close objects are based on depth values within bboxes
      if (depthMap && detectionResult.labeledObjects.length > 0) {
        setStatus('Analyzing collision threats...');
        try {
          const collisionResult = await CollisionDetectionService.analyzeLabeledObjects(
            depthMap,  // MiDaS heatmap
            detectionResult.labeledObjects  // YOLO labels + bboxes
          );

          if (collisionResult.success) {
            setCollisionResult(collisionResult);

            // Announce critical threats
            const criticalObjects = collisionResult.objects.filter(
              obj => obj.dangerLevel === 'CRITICAL_COLLISION' || obj.dangerLevel === 'HIGH_WARNING'
            );
            
            if (criticalObjects.length > 0) {
              const warning = `Warning: ${criticalObjects.length} object(s) detected nearby`;
              setStatus(warning);
              VoiceService.speak(warning);
            } else {
              const objectNames = detectionResult.labeledObjects.map(obj => obj.label).join(', ');
              setStatus(`Detected: ${objectNames}`);
            }
          }
        } catch (collisionError) {
          console.warn('Collision analysis failed:', collisionError);
          // Still show detections even if collision analysis fails
          const objectNames = detectionResult.labeledObjects.map(obj => obj.label).join(', ');
          setStatus(`Detected: ${objectNames}`);
        }
      } else {
        // No depth map, just show YOLO detections
        const objectNames = detectionResult.labeledObjects.map(obj => obj.label).join(', ');
        setStatus(`Detected: ${objectNames} (no depth data)`);
      }
    } catch (error) {
      console.error('Collision detection error:', error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const sendQuery = async () => {
    if (!queryText.trim() || !cameraRef.current || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setStatus('Sending query...');

    try {
      // Capture current frame
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      // Send query to backend
      const result = await BackendService.sendQuery(queryText, photo.base64);

      if (result.success) {
        setLlmResponse(result.responseText);
        setStatus('Response received');
        VoiceService.speak(result.responseText);
      } else {
        Alert.alert('Error', result.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Query error:', error);
      Alert.alert('Error', 'Failed to send query');
    } finally {
      setIsProcessing(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Camera permission denied</Text>
        <Text style={styles.statusText}>Please enable camera access in settings</Text>
        <TouchableOpacity
          style={[styles.captureButton, { marginTop: 20 }]}
          onPress={async () => {
            try {
              const { status } = await Camera.requestCameraPermissionsAsync();
              setHasPermission(status === 'granted');
            } catch (error) {
              console.error('Permission request error:', error);
            }
          }}
        >
          <Text style={styles.captureButtonText}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={cameraType}
          onCameraReady={() => {
            console.log('✅ Camera is ready callback fired');
            cameraReadyRef.current = true;
            setCameraReady(true);
            if (cameraReadyTimeoutRef.current) {
              clearTimeout(cameraReadyTimeoutRef.current);
            }
            if (!status.includes('Camera ready')) {
              setStatus('Camera ready');
            }
          }}
          onMountError={(error) => {
            console.error('❌ Camera mount error:', error);
            console.error('Error details:', error);
            setStatus('Camera error: ' + (error?.message || 'Unknown error'));
          }}
        />
        
        {/* Accessibility Overlay for collision warnings */}
        <AccessibilityOverlay
          collisionResult={collisionResult}
          textResult={textResult}
          onDangerPress={(obj) => {
            const description = `${obj.label} detected ${obj.direction}. ${CollisionDetectionService.getDangerLevelLabel(obj.dangerLevel)} danger.`;
            VoiceService.speak(description);
          }}
        />
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
        {isProcessing && <ActivityIndicator size="small" color="#007AFF" />}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Mode Selection */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'auto' && styles.modeButtonActive]}
            onPress={() => setMode('auto')}
          >
            <Text style={styles.modeButtonText}>Auto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'text' && styles.modeButtonActive]}
            onPress={() => setMode('text')}
          >
            <Text style={styles.modeButtonText}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'query' && styles.modeButtonActive]}
            onPress={() => setMode('query')}
          >
            <Text style={styles.modeButtonText}>Query</Text>
          </TouchableOpacity>
        </View>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
          onPress={captureAndProcess}
          disabled={isProcessing}
        >
          <Text style={styles.captureButtonText}>
            {isProcessing ? 'Processing...' : 'Capture & Analyze'}
          </Text>
        </TouchableOpacity>

        {/* Query Input (for query mode) */}
        {mode === 'query' && (
          <View style={styles.queryContainer}>
            <Text style={styles.inputLabel}>Ask a question:</Text>
            <Text
              style={styles.queryInput}
              onPress={() => {
                // In production, open voice input here
                Alert.alert('Voice Input', 'Voice input will be implemented');
              }}
            >
              {queryText || 'Tap to speak or type...'}
            </Text>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendQuery}
              disabled={!queryText.trim() || isProcessing}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Results Panel */}
      <ResultsPanel
        textResult={textResult}
        collisionResult={collisionResult}
        llmResponse={llmResponse}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  statusBar: {
    backgroundColor: '#000',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    backgroundColor: '#1C1C1E',
    padding: 15,
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  captureButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  captureButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  queryContainer: {
    marginTop: 15,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 8,
  },
  queryInput: {
    backgroundColor: '#2C2C2E',
    color: '#FFF',
    padding: 12,
    borderRadius: 8,
    minHeight: 44,
    marginBottom: 10,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

