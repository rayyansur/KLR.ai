// src/App.jsx
import React, { useState, useEffect } from "react";
import { checkHealth } from "./api";
import CameraFeed from "./components/CameraFeed";
import AudioInterface from "./components/AudioInterface";
import "./App.css";

export default function App() {
  const [latestImage, setLatestImage] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [error, setError] = useState(null);

  // ✅ Check backend health on mount
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const res = await checkHealth();
        setHealthStatus(res.status);
        setError(null);
      } catch (err) {
        console.error("Health check error:", err);
        setError("Backend connection failed. Make sure Flask server is running on port 5000.");
        setHealthStatus("unhealthy");
      }
    };
    checkBackendHealth();
  }, []);

  // ✅ Manual health check when components are interacted with
  const handleComponentClick = async () => {
    try {
      const res = await checkHealth();
      setHealthStatus(res.status);
      setError(null);
    } catch (err) {
      console.error("Health check error:", err);
      setError("Backend connection failed.");
      setHealthStatus("unhealthy");
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>KLR Vision Assistant</h1>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* Camera Feed */}
      <section
        className="camera-feed-container card"
        onClick={handleComponentClick}
      >
        <CameraFeed onCapture={setLatestImage} />
      </section>

      {/* Audio Interface */}
      <section
        className="audio-interface-container card"
        onClick={handleComponentClick}
      >
        <AudioInterface latestImage={latestImage} />
      </section>

      {/* Health Status */}
      {healthStatus && (
        <div
          className={`health-status ${
            healthStatus === "healthy" ? "healthy" : "unhealthy"
          }`}
        >
          🩺 Flask backend status:{" "}
          <strong>{healthStatus.toUpperCase()}</strong>
        </div>
      )}
    </div>
  );
}
