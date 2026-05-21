import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '謀略 – ブラフ × 心理戦カードゲーム';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080503',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Spotlight glow */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background:
              'radial-gradient(ellipse 90% 60% at 50% -5%, rgba(180,83,9,0.75) 0%, rgba(120,53,15,0.25) 45%, transparent 70%)',
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 160,
            fontWeight: 900,
            color: '#f59e0b',
            letterSpacing: '0.22em',
            lineHeight: 1,
            position: 'relative',
            textShadow: '0 0 80px rgba(217,119,6,0.9), 0 0 160px rgba(180,83,9,0.4)',
          }}
        >
          謀略
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginTop: 24,
            position: 'relative',
          }}
        >
          <div style={{ width: 160, height: 1, background: 'rgba(180,83,9,0.5)' }} />
          <div style={{ fontSize: 32, color: 'rgba(180,83,9,0.7)', letterSpacing: '0.3em' }}>
            ブラフ × 心理戦カードゲーム
          </div>
          <div style={{ width: 160, height: 1, background: 'rgba(180,83,9,0.5)' }} />
        </div>

        {/* Characters */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 40,
            fontSize: 22,
            color: 'rgba(217,180,120,0.45)',
            letterSpacing: '0.25em',
            position: 'relative',
          }}
        >
          将軍　刺客　海賊　忍者　女王
        </div>

        {/* Bottom tag */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 20,
            color: 'rgba(120,53,15,0.7)',
            letterSpacing: '0.15em',
          }}
        >
          bouryaku-two.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
