import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import CollisionDetectionService from '../services/CollisionDetectionService';
import VoiceService from '../services/VoiceService';

/**
 * Results Panel Component
 * Displays text detection, collision analysis, and LLM responses
 * With accessibility features for visually impaired users
 */
export default function ResultsPanel({ textResult, collisionResult, llmResponse, onSpeak }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Text Detection Results */}
      {textResult && textResult.regions && textResult.regions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 Detected Text</Text>
            <TouchableOpacity
              onPress={() => {
                const text = textResult.regions.map(r => r.text).join('. ');
                VoiceService.speak(text);
              }}
              style={styles.speakButton}
            >
              <Text style={styles.speakButtonText}>🔊 Speak</Text>
            </TouchableOpacity>
          </View>
          {textResult.regions.slice(0, 5).map((region, index) => (
            <View key={index} style={styles.textItem}>
              <Text style={styles.textContent}>{region.text}</Text>
              <Text style={styles.textConfidence}>
                Confidence: {(region.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Collision Detection Results */}
      {collisionResult && collisionResult.objects && collisionResult.objects.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⚠️ Collision Analysis</Text>
            <TouchableOpacity
              onPress={() => {
                const critical = collisionResult.objects.filter(
                  obj => obj.dangerLevel === 'CRITICAL_COLLISION' || obj.dangerLevel === 'HIGH_WARNING'
                );
                if (critical.length > 0) {
                  const warning = `Warning: ${critical.length} object(s) detected nearby. ` +
                    critical.map(obj => `${obj.label} ${obj.direction}`).join('. ');
                  VoiceService.speak(warning);
                } else {
                  VoiceService.speak('No immediate threats detected');
                }
              }}
              style={styles.speakButton}
            >
              <Text style={styles.speakButtonText}>🔊 Speak</Text>
            </TouchableOpacity>
          </View>
          {collisionResult.objects.map((obj, index) => {
            const dangerColor = CollisionDetectionService.getDangerLevelColor(obj.dangerLevel);
            const dangerLabel = CollisionDetectionService.getDangerLevelLabel(obj.dangerLevel);
            
            return (
              <View key={index} style={[styles.collisionItem, { borderLeftColor: dangerColor }]}>
                <View style={styles.collisionHeader}>
                  <Text style={styles.collisionLabel}>{obj.label}</Text>
                  <View style={[styles.dangerBadge, { backgroundColor: dangerColor }]}>
                    <Text style={styles.dangerBadgeText}>{dangerLabel}</Text>
                  </View>
                </View>
                <Text style={styles.collisionDetail}>
                  Direction: {obj.direction} | Angle: {obj.angleDeg.toFixed(1)}°
                </Text>
                <Text style={styles.collisionDetail}>
                  Confidence: {(obj.confidenceScore * 100).toFixed(0)}%
                </Text>
                {obj.reasonForDanger && (
                  <Text style={styles.collisionReason}>{obj.reasonForDanger}</Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    const description = `${obj.label} detected ${obj.direction} at ${obj.angleDeg.toFixed(0)} degrees. ${dangerLabel} danger. ${obj.reasonForDanger || ''}`;
                    VoiceService.speak(description);
                  }}
                  style={styles.detailButton}
                >
                  <Text style={styles.detailButtonText}>🔊 Hear Details</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* LLM Response */}
      {llmResponse && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💬 Assistant Response</Text>
            <TouchableOpacity
              onPress={() => VoiceService.speak(llmResponse)}
              style={styles.speakButton}
            >
              <Text style={styles.speakButtonText}>🔊 Speak</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.llmResponse}>{llmResponse}</Text>
        </View>
      )}

      {/* Empty State */}
      {!textResult && !collisionResult && !llmResponse && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Capture an image to see results here
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  content: {
    padding: 15,
  },
  section: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  speakButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  speakButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  textItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  textContent: {
    color: '#FFF',
    fontSize: 15,
    marginBottom: 4,
  },
  textConfidence: {
    color: '#AAA',
    fontSize: 12,
  },
  collisionItem: {
    marginBottom: 15,
    paddingLeft: 12,
    borderLeftWidth: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  collisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collisionLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dangerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dangerBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  collisionDetail: {
    color: '#AAA',
    fontSize: 13,
    marginBottom: 4,
  },
  collisionReason: {
    color: '#FF9500',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  detailButton: {
    marginTop: 8,
    backgroundColor: '#3A3A3C',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  detailButtonText: {
    color: '#FFF',
    fontSize: 12,
  },
  llmResponse: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
});

