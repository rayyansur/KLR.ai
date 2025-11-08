import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

/**
 * Voice Service
 * Handles text-to-speech and speech-to-text for accessibility
 */
class VoiceService {
  constructor() {
    this.isSpeaking = false;
    this.sound = null;
  }

  /**
   * Speak text using device TTS
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   */
  async speak(text, options = {}) {
    if (!text || this.isSpeaking) {
      return;
    }

    try {
      this.isSpeaking = true;
      
      await Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9, // Slightly slower for clarity
        ...options,
      });

      // Wait for speech to complete
      await new Promise((resolve) => {
        Speech.addEventListener('onDone', resolve);
        Speech.addEventListener('onError', resolve);
      });
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * Stop current speech
   */
  stop() {
    Speech.stop();
    this.isSpeaking = false;
  }

  /**
   * Play audio file (for backend TTS responses)
   * @param {string} audioUri - URI of audio file
   */
  async playAudio(audioUri) {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      this.sound = sound;
      
      // Wait for playback to complete
      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Audio playback error:', error);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }
    this.stop();
  }
}

// Export singleton instance
export default new VoiceService();

