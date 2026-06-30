import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — AI apps, MVPs & websites that ship`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F8F5EF",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 18,
              height: 18,
              background: "#2A5C3F",
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              color: "#6E6860",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Development studio · Available
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 132,
              fontWeight: 800,
              color: "#1A1714",
              lineHeight: 1,
              letterSpacing: -4,
            }}
          >
            Maximum
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 132,
              fontWeight: 800,
              color: "#2A5C3F",
              lineHeight: 1,
              letterSpacing: -4,
            }}
          >
            Developer
          </div>
        </div>

        <div style={{ color: "#6E6860", fontSize: 34, maxWidth: 900 }}>
          AI-powered apps & MVPs for startups. Fast, working sites for
          businesses. Built and shipped.
        </div>
      </div>
    ),
    { ...size },
  );
}
