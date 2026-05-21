import type { CSSProperties } from 'react';

/**
 * Camera-viewfinder style overlay marking the 1:1 region that
 * `captureCurrentFrame` will export as a thumbnail. Pure presentation — it
 * doesn't read the canvas or talk to the viewer; the parent measures the
 * available space and passes the centered crop dimensions.
 *
 * Sits inside the same `position: relative` wrapper that holds ModelViewer
 * and is `pointerEvents: none` so OrbitControls still receives all drags.
 */
interface Props {
  /** Edge length in CSS px of the centered 1:1 region. */
  size: number;
}

const FRAME_COLOR = 'rgba(255, 255, 255, 0.85)';
const BRACKET_LEN = 18;
const BRACKET_STROKE = 2;

export function CropOverlay({ size }: Props) {
  if (size <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }}
    >
      <Brackets />
      <CenterCross />
      <Label />
    </div>
  );
}

function Brackets() {
  const base: CSSProperties = {
    position: 'absolute',
    width: BRACKET_LEN,
    height: BRACKET_LEN
  };
  return (
    <>
      <div
        style={{
          ...base,
          top: 0,
          left: 0,
          borderTop: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`,
          borderLeft: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`
        }}
      />
      <div
        style={{
          ...base,
          top: 0,
          right: 0,
          borderTop: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`,
          borderRight: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`
        }}
      />
      <div
        style={{
          ...base,
          bottom: 0,
          left: 0,
          borderBottom: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`,
          borderLeft: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`
        }}
      />
      <div
        style={{
          ...base,
          bottom: 0,
          right: 0,
          borderBottom: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`,
          borderRight: `${BRACKET_STROKE}px solid ${FRAME_COLOR}`
        }}
      />
    </>
  );
}

function CenterCross() {
  // Subtle marker: thin semi-transparent white with a 1px low-opacity dark
  // halo for just enough contrast against light areas of the model.
  const armLen = 10;
  const stroke = 1;
  const bar = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    background: 'rgba(255, 255, 255, 0.55)',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.35)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none' as const,
    zIndex: 10
  };
  return (
    <>
      <div style={{ ...bar, width: armLen * 2, height: stroke }} />
      <div style={{ ...bar, width: stroke, height: armLen * 2 }} />
    </>
  );
}

function Label() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        padding: '1px 6px',
        borderRadius: 2,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        background: 'rgba(0, 0, 0, 0.55)',
        color: FRAME_COLOR,
        fontFamily: 'var(--mantine-font-family-monospace, monospace)'
      }}
    >
      1:1
    </div>
  );
}
