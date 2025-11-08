import { NativeModules, Platform } from 'react-native';

const { MLKitBridge } = NativeModules;

/**
 * Text Detection Service
 * Handles real-time text detection using ML Kit (on-device) with Cloud Vision fallback
 */
class TextDetectionService {
  constructor() {
    this.isInitialized = false;
    this.apiBaseUrl = __DEV__ 
      ? 'http://localhost:5000' 
      : 'https://your-production-api.com';
  }

  /**
   * Initialize the text detection service
   */
  async initialize() {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        if (!MLKitBridge) {
          console.warn('MLKitBridge native module not found. Text detection will be disabled.');
          this.isInitialized = true; // Mark as initialized but without native module
          return { success: false, error: 'Native module not available', degraded: true };
        }
        try {
          await MLKitBridge.initialize();
        } catch (initError) {
          console.warn('MLKit initialization failed:', initError.message);
          this.isInitialized = true; // Still mark as initialized
          return { success: false, error: initError.message, degraded: true };
        }
      }
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      console.warn('TextDetectionService initialization failed:', error.message);
      this.isInitialized = true; // Allow degraded mode
      return { success: false, error: error.message, degraded: true };
    }
  }

  /**
   * Detect text in a camera frame
   * @param {Object} frame - Frame object with uri or base64 data
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Detected text regions with metadata
   */
  async detectText(frame, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Try on-device ML Kit first
      let result = await this._detectWithMLKit(frame);

      return result;
    } catch (error) {
      console.error('Text detection error:', error);
      return {
        success: false,
        error: error.message,
        regions: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Detect text using ML Kit (on-device)
   */
  async _detectWithMLKit(frame) {
    try {
      // Check if native module is available
      if (!MLKitBridge) {
        return {
          success: false,
          error: 'MLKitBridge not available',
          regions: [],
          confidence: 0,
        };
      }

      let imageUri = frame.uri || frame.path;
      
      if (!imageUri && frame.base64) {
        imageUri = await this._saveBase64ToTemp(frame.base64);
      }

      if (!imageUri) {
        return {
          success: false,
          error: 'Invalid frame format: missing uri or base64',
          regions: [],
          confidence: 0,
        };
      }

      // Use ML Kit Text Recognition via native bridge
      const recognizedText = await MLKitBridge.recognizeText(imageUri);

      if (!recognizedText || !recognizedText.text) {
        return {
          success: false,
          regions: [],
          confidence: 0,
        };
      }

      // Process ML Kit results into our format
      const regions = this._processMLKitResults(recognizedText);
      
      return {
        success: true,
        regions,
        confidence: this._calculateAverageConfidence(regions),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('ML Kit detection failed:', error.message);
      return {
        success: false,
        error: error.message,
        regions: [],
        confidence: 0,
      };
    }
  }

  /**
   * Process ML Kit results into standardized format
   */
  _processMLKitResults(recognizedText) {
    const regions = [];

    if (!recognizedText.blocks) {
      return regions;
    }

    recognizedText.blocks.forEach(block => {
      block.lines.forEach(line => {
        const text = line.text.trim();
        if (!text) return;

        // Calculate bounding box from corner points
        const bbox = this._calculateBBox(line.cornerPoints);
        const center = this._calculateCenter(bbox);

        regions.push({
          text,
          confidence: line.confidence || 0.9,
          bbox: bbox,
          center: center,
          language: 'en',
        });
      });
    });

    return regions;
  }

  /**
   * Calculate bounding box from corner points
   */
  _calculateBBox(cornerPoints) {
    if (!cornerPoints || cornerPoints.length < 4) {
      return [0, 0, 0, 0];
    }

    // ML Kit provides [left, top, right, bottom]
    return [
      cornerPoints[0], // x1
      cornerPoints[1], // y1
      cornerPoints[2], // x2
      cornerPoints[3], // y2
    ];
  }

  /**
   * Calculate center point of bounding box
   */
  _calculateCenter(bbox) {
    return [
      (bbox[0] + bbox[2]) / 2, // cx
      (bbox[1] + bbox[3]) / 2, // cy
    ];
  }

  /**
   * Calculate average confidence from regions
   */
  _calculateAverageConfidence(regions) {
    if (regions.length === 0) return 0;
    const sum = regions.reduce((acc, r) => acc + (r.confidence || 0), 0);
    return sum / regions.length;
  }

  /**
   * Save base64 to temporary file (helper)
   */
  async _saveBase64ToTemp(base64) {
    // This would need native file system access
    return null;
  }
}

// Export singleton instance
export default new TextDetectionService();

