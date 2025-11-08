"""
Camera capture module for frame acquisition using OpenCV.
Handles camera initialization, frame capture, and thread-safe operations.
"""

import cv2
import threading
import time
import base64
import numpy as np
from typing import Optional, Tuple


class CameraCapture:
    """Thread-safe camera capture manager."""
    
    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False
        self.latest_frame: Optional[np.ndarray] = None
        self.frame_lock = threading.Lock()
        self.capture_thread: Optional[threading.Thread] = None
        self.fps = 0.0
        self.frame_count = 0
        self.start_time = None
        
    def start_camera(self) -> Tuple[bool, str]:
        """
        Initialize and start camera capture.
        Returns: (success: bool, message: str)
        """
        if self.is_running:
            return False, "Camera is already running"
        
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                return False, f"Failed to open camera {self.camera_index}"
            
            # Set camera properties
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            
            self.is_running = True
            self.frame_count = 0
            self.start_time = time.time()
            
            # Start capture thread
            self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
            self.capture_thread.start()
            
            return True, "Camera started successfully"
            
        except Exception as e:
            return False, f"Error starting camera: {str(e)}"
    
    def stop_camera(self) -> Tuple[bool, str]:
        """
        Stop camera capture and release resources.
        Returns: (success: bool, message: str)
        """
        if not self.is_running:
            return False, "Camera is not running"
        
        try:
            self.is_running = False
            
            # Wait for thread to finish
            if self.capture_thread and self.capture_thread.is_alive():
                self.capture_thread.join(timeout=2.0)
            
            if self.cap:
                self.cap.release()
                self.cap = None
            
            with self.frame_lock:
                self.latest_frame = None
            
            return True, "Camera stopped successfully"
            
        except Exception as e:
            return False, f"Error stopping camera: {str(e)}"
    
    def _capture_loop(self):
        """Background thread loop for continuous frame capture."""
        while self.is_running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    with self.frame_lock:
                        self.latest_frame = frame.copy()
                        self.frame_count += 1
                        
                        # Calculate FPS
                        if self.start_time is not None:
                            elapsed = time.time() - self.start_time
                            if elapsed > 0:
                                self.fps = self.frame_count / elapsed
                else:
                    time.sleep(0.01)
            else:
                break
            time.sleep(0.01)  # Small delay to prevent CPU spinning
    
    def get_frame(self) -> Optional[np.ndarray]:
        """
        Get the latest captured frame.
        Returns: numpy array (BGR format) or None
        """
        with self.frame_lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
        return None
    
    def get_frame_base64(self) -> Optional[str]:
        """
        Get the latest frame as base64 encoded JPEG.
        Returns: base64 string or None
        """
        frame = self.get_frame()
        if frame is None:
            return None
        
        try:
            # Encode frame as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            return frame_base64
        except Exception as e:
            print(f"Error encoding frame: {e}")
            return None
    
    def is_camera_active(self) -> bool:
        """Check if camera is currently active."""
        return self.is_running and self.cap is not None and self.cap.isOpened()
    
    def get_fps(self) -> float:
        """Get current FPS."""
        return self.fps


# Global camera instance
_camera_instance: Optional[CameraCapture] = None


def get_camera_instance(camera_index: int = 0) -> CameraCapture:
    """Get or create global camera instance."""
    global _camera_instance
    if _camera_instance is None:
        _camera_instance = CameraCapture(camera_index)
    return _camera_instance


def start_camera(camera_index: int = 0) -> Tuple[bool, str]:
    """Start camera capture."""
    global _camera_instance
    # If camera instance exists with different index, stop and recreate
    if _camera_instance is not None and _camera_instance.camera_index != camera_index:
        if _camera_instance.is_running:
            _camera_instance.stop_camera()
        _camera_instance = None
    
    camera = get_camera_instance(camera_index)
    return camera.start_camera()


def stop_camera() -> Tuple[bool, str]:
    """Stop camera capture."""
    camera = get_camera_instance()
    if camera:
        return camera.stop_camera()
    return False, "Camera instance not found"


def get_frame() -> Optional[np.ndarray]:
    """Get latest frame."""
    camera = get_camera_instance()
    if camera:
        return camera.get_frame()
    return None


def get_frame_base64() -> Optional[str]:
    """Get latest frame as base64."""
    camera = get_camera_instance()
    if camera:
        return camera.get_frame_base64()
    return None


def is_camera_active() -> bool:
    """Check if camera is active."""
    camera = get_camera_instance()
    if camera:
        return camera.is_camera_active()
    return False


def get_fps() -> float:
    """Get current FPS."""
    camera = get_camera_instance()
    if camera:
        return camera.get_fps()
    return 0.0

