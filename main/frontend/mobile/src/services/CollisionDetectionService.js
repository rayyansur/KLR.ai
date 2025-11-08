import { NativeModules, Platform } from 'react-native';

const { CollisionDetectorBridge } = NativeModules;

/**
 * Collision Detection Service
 * Analyzes labeled objects with depth maps to determine collision threats
 * Uses RelativeCollisionDetector for pure relative depth analysis
 */
class CollisionDetectionService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the collision detection service
   */
  async initialize() {
    try {
      if (!CollisionDetectorBridge) {
        console.warn('CollisionDetectorBridge native module not found. Collision detection will use JavaScript fallback.');
        this.isInitialized = true; // Mark as initialized but without native module
        return { success: false, error: 'Native module not available', degraded: true };
      }
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      console.warn('CollisionDetectionService initialization failed:', error.message);
      this.isInitialized = true; // Allow degraded mode
      return { success: false, error: error.message, degraded: true };
    }
  }

  /**
   * Analyze labeled objects for collision threats
   * @param {Array<Array<number>>} depthMap - Normalized depth map [0,1] from MiDaS
   * @param {Array<Object>} labeledObjects - Objects with bboxes from YOLO
   * @returns {Promise<Object>} Collision analysis results
   */
  async analyzeLabeledObjects(depthMap, labeledObjects) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!depthMap || depthMap.length === 0) {
      return {
        success: false,
        error: 'Invalid depth map',
        objects: [],
      };
    }

    if (!labeledObjects || labeledObjects.length === 0) {
      return {
        success: true,
        objects: [],
        message: 'No objects to analyze',
      };
    }

    try {
      // If native bridge is not available, use JavaScript fallback
      if (!CollisionDetectorBridge) {
        return this._analyzeWithJavaScriptFallback(depthMap, labeledObjects);
      }

      // Convert labeled objects to bridge format
      const labeledObjectsArray = labeledObjects.map(obj => ({
        objectId: obj.objectId || `object_${Math.random().toString(36).substr(2, 9)}`,
        label: obj.label || 'unknown',
        bbox: obj.bbox || [0, 0, 0, 0], // [x1, y1, x2, y2] in 256x256 space
        detectionConfidence: obj.detectionConfidence || 0.5,
      }));

      // Call native bridge
      const result = await CollisionDetectorBridge.analyzeLabeledObjects(
        depthMap,
        labeledObjectsArray
      );

      if (!result.success) {
        // Fallback to JavaScript if native fails
        return this._analyzeWithJavaScriptFallback(depthMap, labeledObjects);
      }

      // Process results
      const objects = (result.objects || []).map(obj => ({
        objectId: obj.objectId,
        label: obj.label,
        bbox: obj.bbox,
        centerX: obj.centerX,
        centerY: obj.centerY,
        direction: obj.direction,
        angleDeg: obj.angleDeg,
        dangerLevel: obj.dangerLevel,
        confidenceScore: obj.confidenceScore,
        reasonForDanger: obj.reasonForDanger,
        maxDepth: obj.maxDepth,
        medianDepth: obj.medianDepth,
        depthVariance: obj.depthVariance,
        depthGradient: obj.depthGradient,
      }));

      return {
        success: true,
        objects,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Collision detection error, using fallback:', error.message);
      // Fallback to JavaScript implementation
      return this._analyzeWithJavaScriptFallback(depthMap, labeledObjects);
    }
  }

  /**
   * Get danger level color for UI
   */
  getDangerLevelColor(dangerLevel) {
    switch (dangerLevel) {
      case 'CRITICAL_COLLISION':
        return '#FF0000'; // Red
      case 'HIGH_WARNING':
        return '#FF6600'; // Orange
      case 'MODERATE_WARNING':
        return '#FFAA00'; // Yellow
      case 'LOW_WARNING':
        return '#FFFF00'; // Light yellow
      case 'SAFE':
        return '#00FF00'; // Green
      default:
        return '#CCCCCC'; // Gray
    }
  }

  /**
   * Get danger level label for UI
   */
  getDangerLevelLabel(dangerLevel) {
    switch (dangerLevel) {
      case 'CRITICAL_COLLISION':
        return 'CRITICAL';
      case 'HIGH_WARNING':
        return 'HIGH';
      case 'MODERATE_WARNING':
        return 'MODERATE';
      case 'LOW_WARNING':
        return 'LOW';
      case 'SAFE':
        return 'SAFE';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * JavaScript fallback for collision detection when native module is not available
   * Uses simple depth-based analysis
   */
  _analyzeWithJavaScriptFallback(depthMap, labeledObjects) {
    if (!depthMap || depthMap.length === 0) {
      return {
        success: false,
        error: 'Invalid depth map',
        objects: [],
      };
    }

    const depthHeight = depthMap.length;
    const depthWidth = depthMap[0]?.length || 0;
    
    if (depthHeight === 0 || depthWidth === 0) {
      return {
        success: false,
        error: 'Invalid depth map dimensions',
        objects: [],
      };
    }

    const objects = labeledObjects.map(obj => {
      const bbox = obj.bbox || [0, 0, 0, 0];
      const [x1, y1, x2, y2] = bbox;
      
      // Clamp bbox to depth map bounds
      const clampedX1 = Math.max(0, Math.min(depthWidth - 1, Math.floor(x1)));
      const clampedY1 = Math.max(0, Math.min(depthHeight - 1, Math.floor(y1)));
      const clampedX2 = Math.max(0, Math.min(depthWidth - 1, Math.floor(x2)));
      const clampedY2 = Math.max(0, Math.min(depthHeight - 1, Math.floor(y2)));

      // Sample depth values in the bbox
      const depthSamples = [];
      for (let y = clampedY1; y <= clampedY2; y++) {
        for (let x = clampedX1; x <= clampedX2; x++) {
          if (depthMap[y] && depthMap[y][x] !== undefined) {
            depthSamples.push(depthMap[y][x]);
          }
        }
      }

      // Calculate depth statistics
      const medianDepth = depthSamples.length > 0
        ? depthSamples.sort((a, b) => a - b)[Math.floor(depthSamples.length / 2)]
        : 0.5;
      
      const minDepth = depthSamples.length > 0 ? Math.min(...depthSamples) : 0.5;
      const maxDepth = depthSamples.length > 0 ? Math.max(...depthSamples) : 0.5;

      // Calculate center
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;

      // Determine direction based on position
      let direction = 'center';
      if (centerX < depthWidth * 0.33) direction = 'left';
      else if (centerX > depthWidth * 0.67) direction = 'right';
      if (centerY < depthHeight * 0.33) direction += ' top';
      else if (centerY > depthHeight * 0.67) direction += ' bottom';

      // Calculate angle (simplified)
      const angleDeg = Math.atan2(centerY - depthHeight / 2, centerX - depthWidth / 2) * (180 / Math.PI);

      // Determine danger level based on depth
      // Lower depth values = closer objects = higher danger
      let dangerLevel = 'SAFE';
      let reasonForDanger = '';

      if (minDepth < 0.3) {
        dangerLevel = 'CRITICAL_COLLISION';
        reasonForDanger = 'Object very close (depth < 0.3)';
      } else if (minDepth < 0.4) {
        dangerLevel = 'HIGH_WARNING';
        reasonForDanger = 'Object close (depth < 0.4)';
      } else if (minDepth < 0.5) {
        dangerLevel = 'MODERATE_WARNING';
        reasonForDanger = 'Object at moderate distance (depth < 0.5)';
      } else if (minDepth < 0.6) {
        dangerLevel = 'LOW_WARNING';
        reasonForDanger = 'Object detected (depth < 0.6)';
      }

      return {
        objectId: obj.objectId || `object_${Math.random().toString(36).substr(2, 9)}`,
        label: obj.label || 'unknown',
        bbox: bbox,
        centerX: centerX,
        centerY: centerY,
        direction: direction.trim(),
        angleDeg: angleDeg,
        dangerLevel: dangerLevel,
        confidenceScore: obj.detectionConfidence || 0.5,
        reasonForDanger: reasonForDanger,
        maxDepth: maxDepth,
        medianDepth: medianDepth,
        depthVariance: 0, // Simplified fallback
        depthGradient: 0, // Simplified fallback
      };
    });

    return {
      success: true,
      objects: objects,
      timestamp: new Date().toISOString(),
      degraded: true, // Indicate this is a fallback
    };
  }
}

// Export singleton instance
export default new CollisionDetectionService();

