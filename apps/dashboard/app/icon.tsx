import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#07111f",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#57a4ff" }} />
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#57a4ff" }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#35d49a" }} />
      </div>
    ),
    { ...size }
  );
}
