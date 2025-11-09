import { NativeModules, Platform } from 'react-native';

const { DepthModelBridge } = NativeModules;

/**
 * Depth Estimation Service
 * Handles real-time depth estimation using MiDaS v3.1 small (TFLite)
 * Returns normalized depth map [0,1] for collision detection
 */
class DepthEstimationService {
  constructor() {
    this.isInitialized = false;
    this.modelLoaded = false;
    this.apiBaseUrl = __DEV__ 
      ? 'http://localhost:5000' 
      : 'https://your-production-api.com';
  }

  /**
   * Initialize the depth estimation service
   */
  async initialize() {
    try {
      // Check if native module is available
      if (!DepthModelBridge) {
        console.warn('DepthModelBridge native module not found. Depth estimation will be disabled.');
        this.isInitialized = true; // Mark as initialized but without model
        this.modelLoaded = false;
        return { success: false, error: 'Native module not available', degraded: true };
      }

      // Try to load MiDaS model
      try {
        const modelPath = await this._getModelPath();
        await DepthModelBridge.loadModel(modelPath);
        this.modelLoaded = true;
      } catch (modelError) {
        console.warn('MiDaS model could not be loaded:', modelError.message);
        console.warn('Depth estimation will work in degraded mode using position-based estimation.');
        this.modelLoaded = false;
      }

      this.isInitialized = true;
      
      if (this.modelLoaded) {
        return { success: true };
      } else {
        return { success: false, error: 'Model not available', degraded: true };
      }
    } catch (error) {
      console.warn('DepthEstimationService initialization failed:', error.message);
      this.isInitialized = true; // Still mark as initialized to allow degraded mode
      this.modelLoaded = false;
      return { success: false, error: error.message, degraded: true };
    }
  }

  /**
   * Estimate depth for a camera frame
   * @param {Object} frame - Frame object with uri or base64 data
   * @param {Object} options - Estimation options
   * @returns {Promise<Object>} Normalized depth map [0,1]
   */
  async estimateDepth(frame, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // If model is not loaded, generate a mock depth map based on position
    if (!this.modelLoaded || !DepthModelBridge) {
      return this._generateMockDepthMap(frame);
    }

    try {
      // Generate depth map using MiDaS
      const depthMap = await this._generateDepthMap(frame);

      return {
        success: true,
        depth_map: depthMap, // Normalized [0,1] depth map
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Depth estimation error, using fallback:', error.message);
      // Fallback to mock depth map if MiDaS fails
      return this._generateMockDepthMap(frame);
    }
  }

  /**
   * Generate depth map using MiDaS TFLite model
   */
  async _generateDepthMap(frame) {
    try {
      let imageUri = frame.uri || frame.path;
      
      if (!imageUri && frame.base64) {
        // Handle base64 if needed
        imageUri = await this._saveBase64ToTemp(frame.base64);
      }

      if (!imageUri) {
        throw new Error('Invalid frame format: missing uri or base64');
      }

      // Call native bridge to run MiDaS inference
      const result = await DepthModelBridge.estimateDepth(imageUri, {
        width: frame.width || 640,
        height: frame.height || 640,
      });

      if (!result || !result.depthMap) {
        throw new Error('Failed to generate depth map');
      }

      // Convert React Native array to JavaScript array
      const depthMap = [];
      for (let y = 0; y < result.depthMap.length; y++) {
        const row = [];
        for (let x = 0; x < result.depthMap[y].length; x++) {
          row.push(result.depthMap[y][x]);
        }
        depthMap.push(row);
      }

      return depthMap; // 2D array of normalized depth values [0,1]
    } catch (error) {
      console.error('MiDaS depth generation failed:', error);
      throw error;
    }
  }

  /**
   * Get model path (platform-specific)
   */
  async _getModelPath() {
    if (Platform.OS === 'ios') {
      return 'midas_v3.1_small.tflite';
    } else if (Platform.OS === 'android') {
      return 'midas_v3.1_small.tflite';
    }
    throw new Error('Unsupported platform');
  }

  /**
   * Save base64 to temporary file (helper)
   */
  async _saveBase64ToTemp(base64) {
    // This would need native file system access
    return null;
  }

  /**
   * Generate a mock depth map based on image position
   * Used as fallback when MiDaS model is not available
   * Creates a simple depth gradient: objects higher in image (lower y) are closer
   */
  _generateMockDepthMap(frame) {
    const width = frame.width || 256;
    const height = frame.height || 256;
    const depthMap = [];

    // Generate a simple depth gradient
    // Lower y values (top of image) = closer objects (lower depth values)
    // Higher y values (bottom of image) = farther objects (higher depth values)
    for (let y = 0; y < height; y++) {
      const row = [];
      // Normalize y position to [0, 1] depth range
      // Objects at top (y=0) have depth ~0.2, objects at bottom (y=height) have depth ~0.8
      const baseDepth = 0.2 + (y / height) * 0.6;
      
      for (let x = 0; x < width; x++) {
        // Add slight variation based on x position for realism
        const variation = (Math.sin(x * 0.1) + Math.cos(y * 0.1)) * 0.1;
        const depth = Math.max(0, Math.min(1, baseDepth + variation));
        row.push(depth);
      }
      depthMap.push(row);
    }

    return {
      success: true,
      depth_map: depthMap,
      timestamp: new Date().toISOString(),
      degraded: true, // Indicate this is a fallback
    };
  }
}

// Export singleton instance
export default new DepthEstimationService();

