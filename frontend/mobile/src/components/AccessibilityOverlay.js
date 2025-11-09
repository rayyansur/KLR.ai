import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import CollisionDetectionService from '../services/CollisionDetectionService';

/**
 * Accessibility Overlay Component
 * Visual indicators for collision threats and detected objects
 * Designed for visually impaired users with high contrast
 */
export default function AccessibilityOverlay({ collisionResult, textResult, onDangerPress }) {
  if (!collisionResult || !collisionResult.objects || collisionResult.objects.length === 0) {
    return null;
  }

  // Sort by danger level
  const sortedObjects = [...collisionResult.objects].sort((a, b) => {
    const dangerOrder = {
      'CRITICAL_COLLISION': 0,
      'HIGH_WARNING': 1,
      'MODERATE_WARNING': 2,
      'LOW_WARNING': 3,
      'SAFE': 4,
    };
    return dangerOrder[a.dangerLevel] - dangerOrder[b.dangerLevel];
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {sortedObjects.map((obj, index) => {
        const dangerColor = CollisionDetectionService.getDangerLevelColor(obj.dangerLevel);
        const dangerLabel = CollisionDetectionService.getDangerLevelLabel(obj.dangerLevel);
        
        // Calculate position (assuming 256x256 depth map scaled to screen)
        const screenWidth = 360; // Adjust based on actual screen
        const screenHeight = 640; // Adjust based on actual screen
        
        const left = (obj.bbox[0] / 256) * screenWidth;
        const top = (obj.bbox[1] / 256) * screenHeight;
        const width = ((obj.bbox[2] - obj.bbox[0]) / 256) * screenWidth;
        const height = ((obj.bbox[3] - obj.bbox[1]) / 256) * screenHeight;

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.dangerIndicator,
              {
                left,
                top,
                width,
                height,
                borderColor: dangerColor,
                backgroundColor: `${dangerColor}20`, // 20% opacity
              },
            ]}
            onPress={() => onDangerPress && onDangerPress(obj)}
            accessible={true}
            accessibilityLabel={`${obj.label}, ${dangerLabel} danger, ${obj.direction}`}
            accessibilityHint="Double tap for more information"
          >
            <View style={[styles.dangerBadge, { backgroundColor: dangerColor }]}>
              <Text style={styles.dangerBadgeText}>{dangerLabel}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dangerIndicator: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 8,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  dangerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    margin: 4,
  },
  dangerBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

