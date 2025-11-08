/**
 * Backend Service
 * Integrates with Flask backend for YOLO detection and LLM responses
 */
class BackendService {
  constructor() {
    // Use 10.0.2.2 for Android emulator (points to host machine's localhost)
    // Use localhost for iOS simulator or physical device on same network
    this.apiBaseUrl = __DEV__ 
      ? 'http://10.0.2.2:5000'  // Android emulator uses 10.0.2.2 to access host
      : 'https://your-production-api.com';
  }

  /**
   * Get YOLO object detections from backend
   * @param {string} imageBase64 - Base64 encoded image
   * @param {number} imageWidth - Original image width (for bbox scaling)
   * @param {number} imageHeight - Original image height (for bbox scaling)
   * @returns {Promise<Object>} YOLO detection results with labeled objects
   */
  async getObjectDetections(imageBase64, imageWidth = 640, imageHeight = 480) {
    try {
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${this.apiBaseUrl}/auto-detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Convert backend YOLO format to labeled objects format
      // Backend returns: { "result": { "response_text": "...", "detections": [...] } }
      const detections = data.result?.detections || [];
      
      // Convert to labeled objects format for collision detection
      // Backend YOLO returns position as {x1, y1, x2, y2} but we need [x1, y1, x2, y2] array
      // Scale bboxes from original image size to 256x256 (MiDaS output size)
      const scaleX = 256 / imageWidth;
      const scaleY = 256 / imageHeight;
      
      const labeledObjects = detections.map((det, index) => {
        const pos = det.position || {};
        
        return {
          objectId: `${det.class || 'object'}_${index}`,
          label: det.class || 'unknown',
          bbox: [
            Math.max(0, Math.min(255, Math.round((pos.x1 || 0) * scaleX))),      // x1
            Math.max(0, Math.min(255, Math.round((pos.y1 || 0) * scaleY))),      // y1
            Math.max(0, Math.min(255, Math.round((pos.x2 || 0) * scaleX))),      // x2
            Math.max(0, Math.min(255, Math.round((pos.y2 || 0) * scaleY))),       // y2
          ],
          detectionConfidence: det.confidence || 0.5,
        };
      });

      return {
        success: true,
        labeledObjects,
        detections,
        responseText: data.result?.response_text,
      };
    } catch (error) {
      console.error('Backend detection error:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message.includes('Network request failed') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend. Make sure the backend is running on http://10.0.2.2:5000';
      }
      
      return {
        success: false,
        error: errorMessage,
        labeledObjects: [],
        detections: [],
      };
    }
  }

  /**
   * Send query with image to backend for LLM response
   * @param {string} query - Text query
   * @param {string} imageBase64 - Base64 encoded image
   * @returns {Promise<Object>} LLM response
   */
  async sendQuery(query, imageBase64) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          image: imageBase64,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        responseText: data.result?.response_text || data.result,
      };
    } catch (error) {
      console.error('Backend query error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export default new BackendService();

