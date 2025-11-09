import React, { useRef, useState } from "react";
import "../App.css";

export default function AudioInterface({ onAction }) {
    const [recording, setRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunks = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (e) => chunks.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                chunks.current = [];
            };
            mediaRecorderRef.current.start();
            setRecording(true);
        } catch (err) {
            console.error("Microphone access error:", err);
            alert("Unable to access microphone.");
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setRecording(false);
    };

    return (
        <div className="audio-interface-container">
            <h2 className="api-response-title">🎤 Audio Interface</h2>

            <button
                className={`audio-button ${recording ? "recording" : ""}`}
                onClick={() => {
                    if (recording) stopRecording();
                    else startRecording();
                    onAction && onAction(); // trigger health check
                }}
            >
                {recording ? "Stop Listening" : "Start Listening"}
            </button>
        </div>
    );
}
