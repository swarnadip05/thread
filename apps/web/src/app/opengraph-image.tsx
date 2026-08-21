import { ImageResponse } from "next/og";

export const alt = "THREAD — fashion by SNAP CART";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#111111",
        color: "#F8F5EE",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: 72,
        width: "100%",
      }}
    >
      <div style={{ color: "#E8B923", fontSize: 28, letterSpacing: 12 }}>SNAP CART</div>
      <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -8, marginTop: 18 }}>THREAD</div>
      <div style={{ fontSize: 30, marginTop: 32 }}>Everyday pieces, considered clearly.</div>
    </div>,
    size,
  );
}
