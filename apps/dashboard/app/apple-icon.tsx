import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "linear-gradient(145deg, #0d1b2f 0%, #07111f 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#57a4ff" }} />
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#57a4ff" }} />
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#35d49a" }} />
        </div>
        <div
          style={{
            color: "#c8dbff",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.12em",
            fontFamily: "sans-serif",
          }}
        >
          CORTEX
        </div>
      </div>
    ),
    { ...size }
  );
}
