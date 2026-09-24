import './NoirScene.css';

// The detective's office at night, drawn once: the window onto the city, the detective at it, the desk.
// Decoration only; it carries no case data.

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIN = { x: 230, y: 40, w: 530, h: 600 };
const GROUND = WIN.y + WIN.h;
const BUILDINGS = [[222, 64, 200], [280, 48, 268], [322, 74, 160], [390, 58, 318], [442, 84, 214], [520, 52, 352], [566, 72, 186], [630, 58, 290], [682, 90, 236]];

const rand = seeded(1984);
const LIT = BUILDINGS.flatMap(([x, w, h]) => {
  const out = [];
  for (let wy = GROUND - h + 14; wy < GROUND - 10; wy += 17) {
    for (let wx = x + 7; wx < x + w - 8; wx += 12) if (rand() < 0.3) out.push([wx, wy, rand() < 0.2]);
  }
  return out;
});
const RAIN = Array.from({ length: 70 }, () => [WIN.x + rand() * (WIN.w + 80) - 40, WIN.y + rand() * WIN.h, 14 + rand() * 18, rand() * 1.2]);
const SLATS = Array.from({ length: 13 }, (_, i) => WIN.y + 4 + i * 8);

export default function NoirScene({ className = '' }) {
  return (
    <svg className={`noir ${className}`} viewBox="0 0 800 900" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="noir-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="noir__stop-sky" />
          <stop offset="1" className="noir__stop-haze" />
        </linearGradient>
        <radialGradient id="noir-spill" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" className="noir__stop-spill" />
          <stop offset="1" className="noir__stop-none" />
        </radialGradient>
        <radialGradient id="noir-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" className="noir__stop-pool" />
          <stop offset="1" className="noir__stop-none" />
        </radialGradient>
        <linearGradient id="noir-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="noir__stop-desk-top" />
          <stop offset="1" className="noir__stop-desk-bottom" />
        </linearGradient>
        <clipPath id="noir-glass"><rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} /></clipPath>
        <clipPath id="noir-face-clip"><path d="M466 398C466 430 472 452 484 462 490 467 502 467 508 462 520 452 526 430 526 398Z" /></clipPath>
        <linearGradient id="noir-brim-shade" gradientUnits="userSpaceOnUse" x1="0" y1="398" x2="0" y2="436">
          <stop offset="0" className="noir__stop-shade" />
          <stop offset="1" className="noir__stop-clear" />
        </linearGradient>
        <filter id="noir-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>

      <ellipse cx={WIN.x + WIN.w / 2} cy={WIN.y + WIN.h / 2} rx="420" ry="420" fill="url(#noir-spill)" />

      <g clipPath="url(#noir-glass)">
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill="url(#noir-sky)" />
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} className="noir__lightning" />
        <g className="noir__skyline">
          {BUILDINGS.map(([x, w, h]) => <rect key={x} x={x} y={GROUND - h} width={w} height={h} className="noir__building" />)}
          <path d="M540 288h24v-16h-24zM544 288v8M560 288v8M536 272l16-10 16 10" className="noir__building noir__tower" />
          <rect x="400" y={GROUND - 318 - 34} width="3" height="34" className="noir__building" />
          <circle cx="401.5" cy={GROUND - 318 - 36} r="3" className="noir__beacon" />
        </g>
        {LIT.map(([x, y, warm], i) => <rect key={i} x={x} y={y} width="5" height="8" className={warm ? 'noir__lit noir__lit--flicker' : 'noir__lit'} style={warm ? { animationDelay: `${(i % 9) * 0.7}s` } : undefined} />)}
        <g className="noir__neon">
          <rect x="642" y="360" width="26" height="118" rx="3" className="noir__neon-box" />
          {'HOTEL'.split('').map((ch, i) => <text key={ch} x="655" y={384 + i * 22} textAnchor="middle" className="noir__neon-text">{ch}</text>)}
          <rect x="642" y="360" width="26" height="118" rx="3" className="noir__neon-halo" filter="url(#noir-glow)" />
        </g>
        <g className="noir__rain">
          {RAIN.map(([x, y, len, d], i) => <line key={i} x1={x} y1={y} x2={x - len * 0.28} y2={y + len} style={{ animationDelay: `${-d}s` }} />)}
        </g>
        {SLATS.map((y) => <rect key={y} x={WIN.x - 4} y={y} width={WIN.w + 8} height="6" className="noir__slat" />)}
      </g>

      <g className="noir__frame">
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} className="noir__frame-outer" />
        <path d={`M${WIN.x + WIN.w / 2} ${WIN.y + 112}V${GROUND}M${WIN.x} ${WIN.y + 330}H${WIN.x + WIN.w}`} className="noir__mullion" />
        <rect x={WIN.x - 16} y={GROUND} width={WIN.w + 32} height="14" className="noir__sill" />
        <path d={`M${WIN.x + WIN.w - 22} ${WIN.y + 108}V${WIN.y + 400}`} className="noir__cord" />
        <rect x={WIN.x + WIN.w - 26} y={WIN.y + 400} width="8" height="16" rx="3" className="noir__tassel" />
      </g>

      <g className="noir__detective">
        <path d="M470 470C448 474 428 482 412 496 398 508 392 522 390 540L382 640 376 770H614L608 640 600 540C598 522 592 508 578 496 562 482 542 474 522 470Z" className="noir__figure" />
        <path d="M424 524 418 700M568 524 574 700" className="noir__seam" />
        <path d="M398 664H594" className="noir__belt" />
        <rect x="487" y="656" width="18" height="16" rx="2" className="noir__buckle" />
        {[[474, 568], [518, 568], [474, 606], [518, 606]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" className="noir__button" />)}

        <path d="M481 458H511V482H481Z" className="noir__neck" />
        <path d="M482 470 496 514 510 470Z" className="noir__shirt" />
        <path d="M492 474H500L503 481 499 524 496 530 493 524 489 481Z" className="noir__tie" />
        <path d="M480 466 456 440 448 478 482 536 496 516Z" className="noir__collar" />
        <path d="M512 466 536 440 544 478 510 536 496 516Z" className="noir__collar" />

        <ellipse cx="464" cy="424" rx="5" ry="10" className="noir__ear" />
        <ellipse cx="528" cy="424" rx="5" ry="10" className="noir__ear" />
        <path d="M466 398C466 430 472 452 484 462 490 467 502 467 508 462 520 452 526 430 526 398Z" className="noir__face" />
        <g clipPath="url(#noir-face-clip)">
          <path d="M466 398H526V436H466Z" fill="url(#noir-brim-shade)" />
          <path d="M466 398C468 434 476 452 490 464L466 470Z" className="noir__cheek-shade" />
        </g>
        <path d="M477 410 489 413M515 410 503 413" className="noir__brow" />
        <path d="M480 419Q484 416 489 419M503 419Q508 416 512 419" className="noir__eye" />
        <circle cx="485" cy="419" r="1.1" className="noir__glint" />
        <circle cx="508" cy="419" r="1.1" className="noir__glint" />
        <path d="M496 416C497 425 500 432 501 437 498 439 494 439 491 437" className="noir__nose" />
        <path d="M490 453Q496 455 502 453" className="noir__mouth" />
        <path d="M474 447C479 440 488 438 496 443 504 438 513 440 518 447 520 450 517 452 514 449 509 446 503 449 496 448 489 449 483 446 478 449 475 452 472 450 474 447Z" className="noir__moustache" />

        <path d="M503 453 538 463" className="noir__cigar" />
        <path d="M509 454.8 513 456" className="noir__cigar-band" />
        <path d="M535 462 540 463.6" className="noir__cigar-ash" />
        <circle cx="541.5" cy="464" r="2.6" className="noir__ember" />
        <path d="M543 460C550 446 538 434 546 420 554 406 542 394 550 380" className="noir__smoke" />
        <path d="M545 459C554 443 546 427 556 411" className="noir__smoke noir__smoke--late" />

        <path d="M455 395C453 371 457 351 468 344 482 351 508 351 522 344 533 351 537 371 535 395Z" className="noir__figure" />
        <path d="M468 344C476 356 482 368 482 392M522 344C514 356 508 368 508 392" className="noir__hat-crease" />
        <path d="M455 385H535V394H455Z" className="noir__band" />
        <path d="M418 400C438 385 554 385 574 400 560 410 432 410 418 400Z" className="noir__figure" />
        <path d="M418 400C438 385 554 385 574 400M468 344C482 351 508 351 522 344M412 496C398 508 392 522 390 540M578 496C592 508 598 522 600 540" className="noir__rim" />
      </g>

      <ellipse cx="560" cy="775" rx="290" ry="70" fill="url(#noir-pool)" />
      <rect x="120" y="742" width="700" height="170" fill="url(#noir-desk)" />
      <rect x="120" y="742" width="700" height="3" className="noir__desk-edge" />

      <g transform="rotate(-6 330 812)">
        <path d="M232 770h70l8 -10h96v122H232Z" className="noir__folder-back" />
        <rect x="236" y="774" width="178" height="110" className="noir__folder" />
        <rect x="258" y="786" width="130" height="3" className="noir__line" />
        <rect x="258" y="796" width="110" height="3" className="noir__line" />
        <rect x="258" y="806" width="122" height="3" className="noir__line" />
        <g transform="rotate(-12 300 842)">
          <rect x="248" y="828" width="112" height="26" className="noir__stamp-box" />
          <text x="304" y="847" textAnchor="middle" className="noir__stamp">CONFIDENTIAL</text>
        </g>
        <g transform="rotate(9 402 794)">
          <rect x="370" y="760" width="62" height="70" className="noir__photo" />
          <rect x="376" y="766" width="50" height="46" className="noir__photo-image" />
          <circle cx="401" cy="782" r="9" className="noir__photo-face" />
          <path d="M386 812c4-12 26-12 30 0" className="noir__photo-face" />
        </g>
      </g>

      <g className="noir__glass">
        <path d="M594 828 646 872" className="noir__glass-handle" />
        <circle cx="570" cy="806" r="33" className="noir__glass-lens" />
        <circle cx="570" cy="806" r="33" className="noir__glass-rim" />
        <path d="M552 790a22 22 0 0 1 16-8" className="noir__glass-shine" />
      </g>

      <g>
        <path d="M680 776h54v42a14 14 0 0 1-14 14h-26a14 14 0 0 1-14-14Z" className="noir__cup" />
        <path d="M734 786h8a9 9 0 0 1 0 18h-8" className="noir__cup-handle" />
        <ellipse cx="707" cy="777" rx="27" ry="6" className="noir__coffee" />
        <path d="M698 766c-6-10 6-16 0-28M714 766c-6-10 6-16 0-30" className="noir__steam" />
      </g>
    </svg>
  );
}
