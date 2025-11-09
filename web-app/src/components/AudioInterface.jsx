// src/components/AudioInterface.jsx
import React, { useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { sendQuery } from "../api";

export default function AudioInterface({ onResult }) {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  const [processing, setProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const silenceTimer = useRef(null);

  // 🎧 Start continuous listening when component mounts
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
    return () => SpeechRecognition.stopListening();
  }, []);

  // 🧠 Detect silence: restart timer whenever transcript changes
  useEffect(() => {
    if (!transcript.trim() || processing) return;

    // clear old timer if user keeps talking
    if (silenceTimer.current) clearTimeout(silenceTimer.current);

    // set a new timer to trigger after 2 seconds of silence
    silenceTimer.current = setTimeout(() => {
      // only process if the transcript changed
      if (transcript.trim() && transcript !== lastTranscript) {
        handleSpeech(transcript.trim());
        setLastTranscript(transcript.trim());
      }
    }, 2000); // 2s of silence
  }, [transcript]);

  // 🚀 Send query to backend
  const handleSpeech = async (spokenText) => {
    setProcessing(true);
    console.log("🎙 Detected phrase after silence:", spokenText);

    try {
      const imageBlob = await captureImage();
      const response = await sendQuery(spokenText, imageBlob);
      console.log("💬 AI Response:", response);

      if (onResult) onResult(response);

      // Optional: speak back response using browser TTS
      if (response["result"]) {
        const ttsRes = await fetch("/api/text-to-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: response["result"] }),
        });

      if (!ttsRes.ok) throw new Error("TTS request failed");

      // Convert backend response (MP3 bytes) to Blob
      const audioBlob = await ttsRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Play with HTML Audio element
      const audio = new Audio(audioUrl);
      audio.play();
      }


    } catch (err) {
      console.error("Error sending query:", err);
    } finally {
      resetTranscript();
      setProcessing(false);
    }
  };

  // 📸 Helper to capture camera frame
  const captureImage = async () => {
    const video = document.querySelector("video");
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg"));
  };

  return (
    <div style={{ textAlign: "center", marginTop: "1rem" }}>
      <div
        style={{
          background: listening ? "#4caf50" : "#f44336",
          color: "white",
          padding: "0.6rem 1rem",
          borderRadius: "12px",
          display: "inline-block",
          fontWeight: "500",
        }}
      >
        {processing
          ? "⏳ Processing your question..."
          : listening
          ? "🎧 Listening for speech..."
          : "🟡 Not listening"}
      </div>

      <p
        style={{
          marginTop: "0.5rem",
          fontSize: "1rem",
          fontStyle: "italic",
          color: "#ccc",
          minHeight: "1.5em",
        }}
      >
        {transcript && !processing ? `You said: "${transcript}"` : ""}
      </p>
    </div>
  );
}
