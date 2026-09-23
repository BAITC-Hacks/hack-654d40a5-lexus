import React from "react";
import {
  AbsoluteFill,
  Composition,
  registerRoot,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { DotFieldBg } from "./vendor/DotFieldBg";
type Scene = { text: string; label: string; from: number; duration: number };
type Props = {
  title: string;
  company: string;
  version: number;
  locale: string;
  duration: number;
  scenes: Scene[];
  captions: { from: number; to: number; text: string }[];
};
const purple = "#a77df2";
function BriefVideo(p: Props) {
  const frame = useCurrentFrame();
  const scene =
    p.scenes.find((s) => frame >= s.from && frame < s.from + s.duration) ||
    p.scenes.at(-1)!;
  const i = p.scenes.indexOf(scene);
  const local = frame - scene.from;
  const fade = interpolate(
    local,
    [0, 12, scene.duration - 12, scene.duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const zoom = interpolate(
    local,
    [12, Math.max(30, scene.duration - 48)],
    [1, 1.04],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.quad),
    },
  );
  const caption = p.captions.find((c) => frame >= c.from && frame < c.to);
  const words = scene.text.split(/\s+/);
  const visible = Math.min(
    words.length,
    Math.floor(
      interpolate(
        local,
        [8, Math.max(30, scene.duration - 48)],
        [0, words.length],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ),
    ),
  );
  const large = scene.text.length < 140;
  return (
    <AbsoluteFill
      style={{
        background: "#0b0c11",
        color: "white",
        fontFamily: "DejaVu Sans,Arial,sans-serif",
      }}
    >
      <DotFieldBg specs={[]} grain={false} />
      <div
        style={{
          position: "absolute",
          left: 55,
          top: 30,
          color: "#b3b7c5",
          fontSize: 20,
          letterSpacing: 2,
        }}
      >
        SANA QUEST <span style={{ color: purple }}>✦</span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 55,
          top: 30,
          fontSize: 19,
          color: "#b3b7c5",
        }}
      >
        {p.company} · v{p.version}
      </div>
      <div
        style={{
          position: "absolute",
          top: 88,
          left: 55,
          right: 55,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        {p.scenes.map((s, j) => (
          <React.Fragment key={j}>
            <div
              style={{
                padding: "10px 17px",
                borderRadius: 30,
                border: "1px solid " + (j === i ? purple : "#50505d"),
                background: j === i ? "#6630f8" : "#101118",
                color: j === i ? "#fff" : "#9896a5",
                fontSize: 21,
              }}
            >
              {s.label}
            </div>
            {j < p.scenes.length - 1 && (
              <span style={{ color: "#62616e" }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          inset: "165px 70px 130px",
          opacity: fade,
          transform: `scale(${zoom})`,
          display: "flex",
          gap: 50,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 200,
            flexShrink: 0,
            height: 240,
            position: "relative",
          }}
        >
          <svg
            width="220"
            height="240"
            viewBox="0 0 220 240"
            style={{ filter: "drop-shadow(0 0 24px #884dcd80)" }}
          >
            <rect
              x="15"
              y="12"
              width="180"
              height="212"
              rx="16"
              fill="#17121f"
              stroke={purple}
              strokeWidth="3"
            />
            {[0, 1, 2, 3, 4].map((j) => (
              <g key={j}>
                <rect
                  x="38"
                  y={42 + j * 33}
                  width="17"
                  height="17"
                  rx="3"
                  fill={local > 30 + j * 25 ? purple : "#2b223a"}
                />
                <rect
                  x="69"
                  y={46 + j * 33}
                  width={interpolate(
                    local,
                    [30 + j * 25, 75 + j * 25],
                    [0, 98],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  )}
                  height="8"
                  rx="3"
                  fill="#e8e0f5"
                />
              </g>
            ))}
          </svg>
          <div
            style={{
              position: "absolute",
              bottom: -8,
              right: 0,
              background: "#6630f8",
              border: "2px solid white",
              borderRadius: 16,
              width: 68,
              height: 68,
              display: "grid",
              placeItems: "center",
              fontSize: 37,
              fontWeight: 800,
            }}
          >
            {i + 1}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 22,
              color: purple,
              letterSpacing: 2,
              marginBottom: 22,
            }}
          >
            {scene.label.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: large ? 44 : 32,
              lineHeight: 1.42,
              fontWeight: 700,
              wordBreak: "break-word",
            }}
          >
            {words.map((word, j) => (
              <span key={j} style={{ color: j < visible ? "#fff" : "#8c8997" }}>
                {word}{" "}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 623,
          height: 57,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 600,
          textAlign: "center",
          textShadow: "2px 2px 5px #000",
          background: "#0008",
          borderRadius: 8,
        }}
      >
        {caption?.text || ""}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          height: 28,
          left: 0,
          right: 0,
          background: "#27232f",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: (100 * frame) / (p.duration * 30) + "%",
            background: "#7746bc",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 22px",
            fontSize: 12,
            color: "#ddd5ed",
          }}
        >
          <span>{p.title.slice(0, 100)}</span>
          <span>
            built by Anything2Explainer skill · {p.locale.toUpperCase()}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
const defaults: Props = {
  title: "Sana Quest",
  company: "Alem Coffee",
  version: 1,
  locale: "ru",
  duration: 30,
  scenes: [
    {
      text: "Понятная потребность. Подтверждённые детали. Реальный результат.",
      label: "Потребность",
      from: 0,
      duration: 900,
    },
  ],
  captions: [],
};
registerRoot(() => (
  <Composition
    id="Brief"
    component={BriefVideo}
    durationInFrames={900}
    fps={30}
    width={1280}
    height={720}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.duration * 30,
    })}
  />
));
