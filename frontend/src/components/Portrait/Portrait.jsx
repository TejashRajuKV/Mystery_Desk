import { useState } from 'react';
import './Portrait.css';

// Everything here is drawn from the suspect's `look` (tones and styles by name, never colours)
// and the current mood. Supplying `portraits: { mood: url }` in the data swaps in real artwork.

const v = (name) => ({ fill: `var(--${name})` });
const HEAD = { oval: [36, 45], round: [40, 42], square: [39, 44], long: [33, 49] };
const CX = 100;
const CY = 108;

function Hair({ style, back }) {
  const f = { className: 'portrait__hair' };
  if (back) {
    if (style === 'long') return <path {...f} d="M58 92 Q56 150 62 196 L138 196 Q144 150 142 92 Q100 70 58 92Z" />;
    if (style === 'bob') return <path {...f} d="M60 94 Q58 130 66 150 L134 150 Q142 130 140 94 Q100 72 60 94Z" />;
    if (style === 'wavy') return <path {...f} d="M60 96 Q54 126 64 146 Q70 156 62 168 L138 168 Q130 156 136 146 Q146 126 140 96 Q100 74 60 96Z" />;
    return null;
  }
  switch (style) {
    case 'short': return <path {...f} d="M64 96 Q64 60 100 58 Q136 60 136 96 Q128 78 100 76 Q72 78 64 96Z" />;
    case 'slick': return <path {...f} d="M63 98 Q60 58 102 56 Q140 58 137 98 Q134 76 112 70 Q86 66 72 80 Q66 88 63 98Z" />;
    case 'curly': return (
      <g {...f}>{[[70, 74], [84, 62], [100, 58], [116, 62], [130, 74], [64, 90], [136, 90], [92, 66], [108, 66]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="13" />)}</g>
    );
    case 'receding': return <path {...f} d="M63 100 Q62 84 70 76 Q74 90 72 104Z M137 100 Q138 84 130 76 Q126 90 128 104Z M84 66 Q100 62 116 66 Q100 70 84 66Z" />;
    case 'bun': return <g {...f}><circle cx="100" cy="50" r="15" /><path d="M64 98 Q64 60 100 60 Q136 60 136 98 Q124 76 100 74 Q76 76 64 98Z" /></g>;
    case 'bob': return <path {...f} d="M62 110 Q58 62 100 60 Q142 62 138 110 Q136 84 118 76 Q100 86 82 76 Q64 84 62 110Z" />;
    case 'long': return <path {...f} d="M62 108 Q58 60 100 58 Q142 60 138 108 Q132 80 100 74 Q68 80 62 108Z" />;
    case 'wavy': return <path {...f} d="M62 104 Q58 62 100 58 Q142 62 138 104 Q132 86 120 78 Q110 88 100 78 Q90 88 80 78 Q68 86 62 104Z" />;
    default: return null;
  }
}

function Outfit({ outfit, color }) {
  const cloth = v(`cloth-${color}`);
  const shirt = v('paper');
  const body = 'M20 250 Q24 196 64 182 Q100 172 136 182 Q176 196 180 250Z';
  return (
    <g className="portrait__outfit">
      <path d={body} style={cloth} />
      {['suit', 'tweed', 'uniform'].includes(outfit) && <>
        <path d="M84 180 L100 214 L116 180 Q100 176 84 180Z" style={shirt} />
        {outfit !== 'uniform' && <path d="M96 186 L100 222 L104 186Z" style={v('red')} />}
        <path d="M76 184 L100 232 L86 250 L64 250 L58 190Z M124 184 L100 232 L114 250 L136 250 L142 190Z" className="portrait__shade" />
        {outfit === 'uniform' && <><circle cx="100" cy="228" r="2.5" style={v('brass')} /><circle cx="100" cy="242" r="2.5" style={v('brass')} /><rect x="126" y="206" width="12" height="8" style={v('brass')} /></>}
        {outfit === 'tweed' && <path d="M30 240 L170 240 M36 226 L164 226 M44 212 L156 212" className="portrait__weave" />}
      </>}
      {outfit === 'labcoat' && <><path d="M86 180 L100 204 L114 180Z" style={v('cloth-navy')} /><path d="M78 184 L100 250 M122 184 L100 250" className="portrait__seam" /></>}
      {outfit === 'sweater' && <path d="M78 182 Q100 200 122 182" className="portrait__seam portrait__seam--thick" />}
      {outfit === 'cardigan' && <><path d="M86 180 L100 212 L114 180Z" style={shirt} /><circle cx="100" cy="222" r="2" style={v('paper-ink')} /><circle cx="100" cy="236" r="2" style={v('paper-ink')} /></>}
      {outfit === 'overalls' && <><path d="M84 180 Q100 190 116 180 L116 184 Q100 196 84 184Z" style={shirt} /><path d="M78 250 L82 196 M122 250 L118 196" className="portrait__seam portrait__seam--thick" /></>}
      {outfit === 'dress' && <path d="M78 182 Q100 204 122 182" className="portrait__skin-edge" />}
      {outfit === 'jacket' && <><path d="M84 180 L100 196 L116 180Z" style={shirt} /><path d="M100 196 L100 250" className="portrait__seam" /><path d="M74 184 L92 200 L84 212Z M126 184 L108 200 L116 212Z" className="portrait__shade" /></>}
    </g>
  );
}

// Eyes, brows and mouth for each mood. Offsets are from the head's centre.
function Face({ mood, ry }) {
  const eyeY = CY - 4;
  const browY = eyeY - 11;
  const mouthY = CY + ry * 0.55;
  const eye = { neutral: 3.2, suspicious: 1.4, nervous: 4.2, angry: 2.4, surprised: 5, defeated: 1.6, defensive: 2.4 }[mood] ?? 3.2;
  const look = mood === 'defeated' ? 2 : mood === 'suspicious' ? 1 : 0;
  const brows = {
    neutral: [[-22, 0, -6, 0], [6, 0, 22, 0]],
    suspicious: [[-22, -5, -6, -3], [6, 2, 22, 1]],
    nervous: [[-22, 2, -6, -4], [6, -4, 22, 2]],
    angry: [[-22, -4, -6, 3], [6, 3, 22, -4]],
    surprised: [[-22, -6, -6, -8], [6, -8, 22, -6]],
    defeated: [[-22, 3, -6, -1], [6, -1, 22, 3]],
    defensive: [[-22, 1, -6, 2], [6, 2, 22, 1]],
  }[mood] ?? [[-22, 0, -6, 0], [6, 0, 22, 0]];
  const mouth = {
    neutral: `M${CX - 9} ${mouthY} Q${CX} ${mouthY + 2} ${CX + 9} ${mouthY}`,
    suspicious: `M${CX - 9} ${mouthY + 1} Q${CX + 2} ${mouthY - 1} ${CX + 10} ${mouthY - 3}`,
    nervous: `M${CX - 9} ${mouthY} Q${CX - 4} ${mouthY - 2} ${CX} ${mouthY} Q${CX + 4} ${mouthY + 2} ${CX + 9} ${mouthY}`,
    angry: `M${CX - 10} ${mouthY + 3} Q${CX} ${mouthY - 4} ${CX + 10} ${mouthY + 3}`,
    defeated: `M${CX - 9} ${mouthY + 3} Q${CX} ${mouthY - 1} ${CX + 9} ${mouthY + 3}`,
    defensive: `M${CX - 9} ${mouthY} L${CX + 9} ${mouthY}`,
  }[mood];
  return (
    <g className="portrait__face">
      <g className="portrait__eyes">
        {[-14, 14].map((dx) => (
          <g key={dx}>
            {mood === 'surprised' && <ellipse cx={CX + dx} cy={eyeY} rx="6" ry="5.5" style={v('white')} />}
            <ellipse cx={CX + dx} cy={eyeY + look} rx={mood === 'surprised' ? 2.6 : 3.4} ry={eye} style={v('paper-ink')} />
          </g>
        ))}
      </g>
      {brows.map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${CX + x1} ${browY + y1} L${CX + x2} ${browY + y2}`} className="portrait__brow" />
      ))}
      <path d={`M${CX - 1} ${eyeY + 6} Q${CX - 5} ${CY + 14} ${CX + 1} ${CY + 16}`} className="portrait__line" />
      {mood === 'surprised'
        ? <ellipse cx={CX} cy={mouthY + 1} rx="5" ry="6" style={v('paper-ink')} />
        : <path d={mouth} className="portrait__mouth" />}
      {mood === 'nervous' && <path d={`M${CX + 30} ${eyeY - 6} q3 6 0 9 q-3 -3 0 -9Z`} className="portrait__sweat" />}
      {mood === 'angry' && <path d={`M${CX - 4} ${browY - 5} L${CX} ${browY - 1} L${CX + 4} ${browY - 5}`} className="portrait__line" />}
    </g>
  );
}

function Extras({ extras, rx, ry, hairColor }) {
  const has = (x) => extras.includes(x);
  const mouthY = CY + ry * 0.55;
  return (
    <g>
      {has('beard') && <path d={`M${CX - rx + 4} ${CY + 6} Q${CX - rx + 6} ${CY + ry + 12} ${CX} ${CY + ry + 14} Q${CX + rx - 6} ${CY + ry + 12} ${CX + rx - 4} ${CY + 6} Q${CX + 20} ${mouthY + 10} ${CX} ${mouthY + 8} Q${CX - 20} ${mouthY + 10} ${CX - rx + 4} ${CY + 6}Z`} style={v(`hair-${hairColor}`)} />}
      {has('moustache') && <path d={`M${CX - 13} ${mouthY - 3} Q${CX} ${mouthY - 10} ${CX + 13} ${mouthY - 3} Q${CX} ${mouthY - 5} ${CX - 13} ${mouthY - 3}Z`} style={v(`hair-${hairColor}`)} />}
      {has('glasses') && <g className="portrait__glasses"><circle cx={CX - 14} cy={CY - 4} r="9" /><circle cx={CX + 14} cy={CY - 4} r="9" /><path d={`M${CX - 5} ${CY - 5} L${CX + 5} ${CY - 5}`} /></g>}
      {has('cigar') && <g><rect x={CX + 8} y={mouthY - 1} width="24" height="5" rx="2" style={v('cloth-brown')} transform={`rotate(12 ${CX + 8} ${mouthY})`} /><circle cx={CX + 32} cy={mouthY + 6} r="2" style={v('red-bright')} className="portrait__ember" /></g>}
      {has('cap') && <path d={`M${CX - rx - 6} ${CY - ry + 20} Q${CX} ${CY - ry - 14} ${CX + rx + 6} ${CY - ry + 20} Q${CX + rx + 18} ${CY - ry + 26} ${CX + rx + 2} ${CY - ry + 28} L${CX - rx - 4} ${CY - ry + 26}Z`} style={v('cloth-olive')} />}
      {has('earrings') && <><circle cx={CX - rx - 1} cy={CY + 12} r="2.6" style={v('brass')} /><circle cx={CX + rx + 1} cy={CY + 12} r="2.6" style={v('brass')} /></>}
      {has('pearls') && <g>{Array.from({ length: 11 }, (_, i) => { const t = (i / 10) * Math.PI; return <circle key={i} cx={CX - 26 * Math.cos(t)} cy={186 + 12 * Math.sin(t)} r="2.4" style={v('white')} />; })}</g>}
    </g>
  );
}

/**
 * A suspect drawn from their data. Mood moves the eyes, brows and mouth; `defeated` bows the
 * head and `defensive` squares the shoulders. They breathe and blink while you wait.
 */
export default function Portrait({ suspect, mood = 'neutral', className = '' }) {
  const src = suspect.portraits?.[mood] ?? suspect.portraits?.neutral ?? null;
  const [broken, setBroken] = useState(null);
  const look = suspect.look ?? { skin: 'fair', hair: 'short', hairColor: 'brown', face: 'oval', outfit: 'suit', outfitColor: 'charcoal', extras: [] };
  const [rx, ry] = HEAD[look.face] ?? HEAD.oval;
  const tilt = mood === 'defeated' ? 5 : mood === 'suspicious' ? -3 : 0;
  const lift = mood === 'defensive' ? -4 : mood === 'defeated' ? 4 : 0;

  return (
    <figure className={`portrait portrait--${mood} ${className}`} aria-label={`${suspect.name}, looking ${mood}`}>
      {src && broken !== src ? (
        <img className="portrait__img" src={src} alt="" onError={() => setBroken(src)} />
      ) : (
        <svg viewBox="0 0 200 250" className="portrait__svg" aria-hidden="true" style={{ '--hair': `var(--hair-${look.hairColor})`, '--skin': `var(--skin-${look.skin})` }}>
          <defs>
            <radialGradient id={`lamp-${suspect.id}`} cx="0.35" cy="0.2" r="0.9">
              <stop offset="0" stopColor="var(--wood-grain)" />
              <stop offset="1" stopColor="var(--bg-base)" />
            </radialGradient>
            <linearGradient id={`side-${suspect.id}`} x1="0" x2="1">
              <stop offset="0.45" stopColor="var(--bg-base)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--bg-base)" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <rect width="200" height="250" fill={`url(#lamp-${suspect.id})`} />
          <g className="portrait__body" style={{ transform: `translateY(${lift}px)` }}>
            <Outfit outfit={look.outfit} color={look.outfitColor} />
            <rect x={CX - 12} y={CY + ry - 12} width="24" height="30" className="portrait__skin" />
          </g>
          <g className="portrait__head" style={{ transform: `rotate(${tilt}deg) translateY(${lift / 2}px)` }}>
            <Hair style={look.hair} back />
            <ellipse cx={CX - rx} cy={CY + 2} rx="5" ry="8" className="portrait__skin" />
            <ellipse cx={CX + rx} cy={CY + 2} rx="5" ry="8" className="portrait__skin" />
            {look.face === 'square'
              ? <rect x={CX - rx} y={CY - ry} width={rx * 2} height={ry * 2} rx={rx * 0.7} className="portrait__skin" />
              : <ellipse cx={CX} cy={CY} rx={rx} ry={ry} className="portrait__skin" />}
            <ellipse cx={CX + rx * 0.45} cy={CY + 4} rx={rx * 0.55} ry={ry * 0.9} className="portrait__cheek-shade" />
            <g key={mood} className="portrait__react"><Face mood={mood} ry={ry} /></g>
            <Hair style={look.hair} />
            <Extras extras={look.extras ?? []} rx={rx} ry={ry} hairColor={look.hairColor} />
          </g>
          <rect width="200" height="250" fill={`url(#side-${suspect.id})`} />
        </svg>
      )}
    </figure>
  );
}
