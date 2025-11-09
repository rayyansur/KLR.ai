import axios from "axios";

export const checkHealth = async () => {
  try {
    const res = await axios.get(`/api/health`, {
      withCredentials: false, // don't include cookies
      headers: {
        "Content-Type": "application/json",
      },
    });
    return res.data;
  } catch (err) {
    console.error("Health check failed:", err);
    return { status: "unhealthy" };
  }
};
// 🆕 NEW: call the /auto-detect endpoint
export const sendAutoDetect = async (imageBlob) => {
  try {
    // Convert the image blob to base64
    const base64Image = await blobToBase64(imageBlob);

    const res = await axios.post(
      `/api/auto-detect`,
      { image: base64Image },
      {
        withCredentials: false,
        headers: { "Content-Type": "application/json" },
      }
    );

    return res.data; // should be { result: ... }
  } catch (err) {
    console.error("Auto-detect failed:", err);
    throw err;
  }
};

export const sendQuery = async (textQuery, imageBlob) => {
  try {
    // Convert image blob to Base64
    const base64Image = await blobToBase64(imageBlob);

    const res = await axios.post(
      `/api/query`,
      {
        text: textQuery,
        image: base64Image,
      },
      {
        withCredentials: false,
        headers: { "Content-Type": "application/json" },
      }
    );

    return res.data; // should include { response_text, tts_audio, ... }
  } catch (err) {
    console.error("Query request failed:", err);
    throw err;
  }
};

// Helper: convert Blob → Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]); // remove data: prefix
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
