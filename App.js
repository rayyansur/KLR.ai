// App.js
// Barebone React Native (Expo) app with Camera + Audio recorder that makes two API fetch calls.
// How to run:
// 1) npm install -g expo-cli
// 2) expo init MyApp (choose blank)
// 3) Replace App.js with this file
// 4) npm install expo-camera expo-av expo-file-system
// 5) expo start

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function App() {
    const cameraRef = useRef(null);
    const [hasCameraPermission, setHasCameraPermission] = useState(null);
    const [hasAudioPermission, setHasAudioPermission] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            const cameraStatus = await Camera.requestCameraPermissionsAsync();
            setHasCameraPermission(cameraStatus.status === 'granted');
            const audioStatus = await Audio.requestPermissionsAsync();
            setHasAudioPermission(audioStatus.status === 'granted');
        })();
    }, []);

    async function takePhotoAndSend() {
        if (!cameraRef.current) return;
        setBusy(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ base64: true });
            // API call #1: send base64 image to endpoint
            await fetch('https://example.com/api/photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'photo.jpg', imageBase64: photo.base64 }),
            });
            Alert.alert('Photo sent', 'Photo upload request completed.');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to take/send photo');
        } finally {
            setBusy(false);
        }
    }

    async function startRecording() {
        try {
            if (!hasAudioPermission) {
                Alert.alert('No microphone permission');
                return;
            }
            setBusy(true);
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            const rec = new Audio.Recording();
            await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
            rec.setOnRecordingStatusUpdate(null);
            await rec.startAsync();
            setRecording(rec);
            setIsRecording(true);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not start recording');
        } finally {
            setBusy(false);
        }
    }

    async function stopRecordingAndSend() {
        if (!recording) return;
        setBusy(true);
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            setIsRecording(false);

            // Read file as base64 (API call #2)
            const b64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Post the base64 audio to a server endpoint
            await fetch('https://example.com/api/audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'audio.m4a', audioBase64: b64 }),
            });

            Alert.alert('Recording sent', 'Audio upload request completed.');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to stop/send recording');
        } finally {
            setBusy(false);
        }
    }

    if (hasCameraPermission === null || hasAudioPermission === null) {
        return (
            <View style={styles.center}>
                <Text>Requesting permissions…</Text>
            </View>
        );
    }

    if (hasCameraPermission === false) {
        return (
            <View style={styles.center}>
                <Text>No access to camera</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera style={styles.camera} ref={cameraRef} ratio={'16:9'} />

            <View style={styles.controls}>
                <TouchableOpacity style={styles.button} onPress={takePhotoAndSend} disabled={busy}>
                    {busy ? <ActivityIndicator /> : <Text style={styles.btnText}>Take Photo & Send</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, isRecording ? styles.recording : null]}
                    onPress={isRecording ? stopRecordingAndSend : startRecording}
                    disabled={busy}
                >
                    <Text style={styles.btnText}>{isRecording ? 'Stop Recording & Send' : 'Start Recording'}</Text>
                </TouchableOpacity>

                <Text style={styles.hint}>This example posts base64 payloads to two endpoints.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 3 },
    controls: { flex: 1, padding: 16, backgroundColor: '#111' },
    button: {
        padding: 12,
        backgroundColor: '#2196F3',
        marginBottom: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    recording: { backgroundColor: '#D32F2F' },
    btnText: { color: '#fff', fontWeight: '600' },
    hint: { color: '#ccc', marginTop: 8, fontSize: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
