import { ImageResponse } from "next/og";

export const runtime = "edge";

const VALID_SIZES = new Set(["192", "512"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
): Promise<Response> {
  const { size: rawSize } = await params;
  const size = VALID_SIZES.has(rawSize) ? Number(rawSize) : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "linear-gradient(145deg, #0d1b2f 0%, #07111f 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.22,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: size * 0.04,
          }}
        >
          {/* Node cluster icon */}
          <div style={{ display: "flex", gap: size * 0.08, alignItems: "center" }}>
            <div
              style={{
                width: size * 0.14,
                height: size * 0.14,
                borderRadius: "50%",
                background: "#57a4ff",
                boxShadow: "0 0 12px rgba(87,164,255,0.8)",
              }}
            />
            <div
              style={{
                width: size * 0.22,
                height: size * 0.22,
                borderRadius: "50%",
                background: "#57a4ff",
                boxShadow: "0 0 20px rgba(87,164,255,0.9)",
              }}
            />
            <div
              style={{
                width: size * 0.14,
                height: size * 0.14,
                borderRadius: "50%",
                background: "#35d49a",
                boxShadow: "0 0 12px rgba(53,212,154,0.8)",
              }}
            />
          </div>
          <div
            style={{
              color: "#c8dbff",
              fontSize: size * 0.14,
              fontWeight: 700,
              letterSpacing: "0.12em",
              fontFamily: "sans-serif",
              textTransform: "uppercase",
            }}
          >
            CORTEX
          </div>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
