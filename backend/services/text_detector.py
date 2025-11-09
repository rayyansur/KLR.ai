"""
Text Detection Service
Implements ML Kit text recognition functionality from TestActivity.java
"""

import os
import base64
from io import BytesIO
from PIL import Image
from typing import Dict, List, Optional
import pytesseract
from pytesseract import Output


class TextDetectorService:
    """Service for text recognition using OCR (pytesseract as ML Kit alternative)"""
    
    def __init__(self):
        self.initialized = False
    
    def initialize(self) -> bool:
        """Initialize text recognition service"""
        try:
            # Test pytesseract availability
            pytesseract.get_tesseract_version()
            self.initialized = True
            return True
        except Exception as e:
            print(f"Text detector initialization failed: {e}")
            self.initialized = False
            return False
    
    def is_initialized(self) -> bool:
        """Check if service is initialized"""
        return self.initialized
    
    def recognize(self, image: Image.Image) -> Dict:
        """
        Recognize text in image
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with text recognition results:
            {
                'text': str,  # Full detected text
                'blocks': List[Dict]  # Text blocks with bounding boxes
            }
        """
        if not self.initialized:
            self.initialize()
        
        try:
            # Use pytesseract to detect text
            # Get detailed data with bounding boxes
            data = pytesseract.image_to_data(image, output_type=Output.DICT)  # Output.DICT = 'dict'
            
            # Extract full text
            full_text = pytesseract.image_to_string(image)
            
            # Process blocks (group by block_num)
            blocks = []
            current_block = None
            current_block_num = None
            
            n_boxes = len(data['level'])
            for i in range(n_boxes):
                level = data['level'][i]
                block_num = data['block_num'][i]
                text = data['text'][i].strip()
                conf = int(data['conf'][i])
                
                # Skip empty text or low confidence
                if not text or conf < 0:
                    continue
                
                # Start new block
                if block_num != current_block_num:
                    if current_block is not None:
                        blocks.append(current_block)
                    
                    current_block = {
                        'blockNum': block_num,
                        'lines': [],
                        'bbox': None
                    }
                    current_block_num = block_num
                
                # Add line to current block
                if level == 4:  # Line level
                    line_data = {
                        'text': text,
                        'confidence': conf / 100.0,  # Normalize to 0-1
                        'bbox': [
                            data['left'][i],
                            data['top'][i],
                            data['left'][i] + data['width'][i],
                            data['top'][i] + data['height'][i]
                        ]
                    }
                    current_block['lines'].append(line_data)
                    
                    # Update block bbox
                    if current_block['bbox'] is None:
                        current_block['bbox'] = line_data['bbox'].copy()
                    else:
                        # Expand bbox to include this line
                        bbox = current_block['bbox']
                        bbox[0] = min(bbox[0], line_data['bbox'][0])
                        bbox[1] = min(bbox[1], line_data['bbox'][1])
                        bbox[2] = max(bbox[2], line_data['bbox'][2])
                        bbox[3] = max(bbox[3], line_data['bbox'][3])
            
            # Add last block
            if current_block is not None:
                blocks.append(current_block)
            
            return {
                'text': full_text.strip(),
                'blocks': blocks
            }
            
        except Exception as e:
            print(f"Text recognition error: {e}")
            return {
                'text': '',
                'blocks': []
            }


# Global service instance
_text_detector_instance: Optional[TextDetectorService] = None


def get_text_detector() -> TextDetectorService:
    """Get or create global text detector instance"""
    global _text_detector_instance
    if _text_detector_instance is None:
        _text_detector_instance = TextDetectorService()
    return _text_detector_instance


def text_detect(image_path: str) -> Dict:
    """
    Detect text in image file
    
    Args:
        image_path: Path to image file
        
    Returns:
        Dictionary with text detection results
    """
    detector = get_text_detector()
    if not detector.is_initialized():
        detector.initialize()
    
    image = Image.open(image_path)
    return detector.recognize(image)

