"""
Frame preprocessing utilities for model input preparation.
Handles resizing, normalization, rotation, and tensor conversion.
NOTE: This is backend/server-side code. For mobile frontend, preprocessing is done in native bridges.
"""

import cv2
import numpy as np
from typing import Tuple, Optional


def preprocess_frame(
    frame: np.ndarray,
    target_size: Tuple[int, int] = (224, 224),
    normalize: bool = True
) -> np.ndarray:
    """
    Preprocess frame for model input.
    
    Args:
        frame: Input frame (BGR format from OpenCV)
        target_size: Target dimensions (width, height)
        normalize: Whether to normalize pixel values to [0, 1]
    
    Returns:
        Preprocessed frame as numpy array
    """
    if frame is None:
        raise ValueError("Frame is None")
    
    # Resize frame
    resized = cv2.resize(frame, target_size, interpolation=cv2.INTER_LINEAR)
    
    # Convert BGR to RGB (if needed for model)
    rgb_frame = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    
    # Normalize if requested
    if normalize:
        normalized = normalize_frame(rgb_frame)
        return normalized
    
    return rgb_frame


def normalize_frame(frame: np.ndarray, method: str = "0-1") -> np.ndarray:
    """
    Normalize frame pixel values.
    
    Args:
        frame: Input frame
        method: Normalization method ("0-1" or "-1-1")
    
    Returns:
        Normalized frame
    """
    if method == "0-1":
        # Normalize to [0, 1]
        return frame.astype(np.float32) / 255.0
    elif method == "-1-1":
        # Normalize to [-1, 1]
        return (frame.astype(np.float32) / 127.5) - 1.0
    else:
        raise ValueError(f"Unknown normalization method: {method}")


def rotate_frame(frame: np.ndarray, angle: float) -> np.ndarray:
    """
    Rotate frame based on IMU orientation.
    
    Args:
        frame: Input frame
        angle: Rotation angle in degrees (positive = counterclockwise)
    
    Returns:
        Rotated frame
    """
    if frame is None:
        raise ValueError("Frame is None")
    
    # Get image center
    h, w = frame.shape[:2]
    center = (w // 2, h // 2)
    
    # Get rotation matrix
    rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Apply rotation
    rotated = cv2.warpAffine(frame, rotation_matrix, (w, h), flags=cv2.INTER_LINEAR)
    
    return rotated


def frame_to_tensor(frame: np.ndarray, add_batch_dim: bool = True) -> np.ndarray:
    """
    Convert frame to tensor format (add batch dimension if needed).
    
    Args:
        frame: Input frame (H, W, C) or (H, W)
        add_batch_dim: Whether to add batch dimension
    
    Returns:
        Tensor array (B, H, W, C) or (H, W, C)
    """
    if frame is None:
        raise ValueError("Frame is None")
    
    tensor = frame.copy()
    
    # Add batch dimension if needed
    if add_batch_dim:
        if len(tensor.shape) == 3:
            tensor = np.expand_dims(tensor, axis=0)
        elif len(tensor.shape) == 2:
            tensor = np.expand_dims(np.expand_dims(tensor, axis=0), axis=-1)
    
    return tensor


def preprocess_for_inference(
    frame: np.ndarray,
    target_size: Tuple[int, int] = (224, 224),
    rotation_angle: float = 0.0,
    normalize: bool = True,
    add_batch_dim: bool = True
) -> np.ndarray:
    """
    Complete preprocessing pipeline for inference.
    
    Args:
        frame: Input frame (BGR format)
        target_size: Target dimensions
        rotation_angle: Rotation angle in degrees
        normalize: Whether to normalize
        add_batch_dim: Whether to add batch dimension
    
    Returns:
        Preprocessed tensor ready for model input
    """
    # Rotate if needed
    if rotation_angle != 0.0:
        frame = rotate_frame(frame, rotation_angle)
    
    # Preprocess
    processed = preprocess_frame(frame, target_size, normalize)
    
    # Convert to tensor
    tensor = frame_to_tensor(processed, add_batch_dim)
    
    return tensor

