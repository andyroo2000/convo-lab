import type { CounterIllustrationId } from '../logic/counterPractice';

interface CounterObjectIllustrationProps {
  illustrationId: CounterIllustrationId;
  className?: string;
}

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const CounterObjectIllustration = ({
  illustrationId,
  className,
}: CounterObjectIllustrationProps) => {
  switch (illustrationId) {
    case 'paper-sheet':
      return (
        <svg
          className={className}
          viewBox="-650 -750 4700 6200"
          aria-label="sheet of paper"
          role="img"
        >
          <g transform="translate(0,4700) scale(1,-1)" fill="currentColor" stroke="none">
            <path d="M66 4639 l-26 -20 0 -1692 0 -1692 598 -597 597 -598 1036 0 c1033 0 1036 0 1063 21 l26 20 0 2269 0 2269 -26 20 -27 21 -1607 0 -1607 0 -27 -21z m3154 -2289 l0 -2160 -955 0 -955 0 0 548 c0 413 -3 551 -12 560 -9 9 -148 12 -565 12 l-553 0 0 1600 0 1600 1520 0 1520 0 0 -2160z m-2000 -1605 c0 -261 -1 -475 -3 -475 -1 0 -216 214 -477 475 l-475 475 478 0 477 0 0 -475z" />
            <path d="M737 3122 c-21 -23 -21 -36 -1 -56 14 -14 115 -16 964 -16 849 0 950 2 964 16 21 20 20 37 -2 57 -17 16 -98 17 -964 17 -903 0 -946 -1 -961 -18z" />
            <path d="M728 2615 c-9 -21 -8 -28 7 -45 18 -20 30 -20 956 -20 515 0 945 3 953 6 26 10 38 41 26 64 -11 20 -21 20 -971 20 l-959 0 -12 -25z" />
            <path d="M752 2143 c-22 -9 -34 -41 -22 -63 11 -20 21 -20 970 -20 l959 0 11 21 c9 16 8 26 -5 45 l-15 24 -943 -1 c-518 0 -948 -3 -955 -6z" />
          </g>
        </svg>
      );

    case 'postcard':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="postcard" role="img">
          <rect x="20" y="20" width="100" height="68" rx="5" {...STROKE_PROPS} />
          <line x1="20" y1="54" x2="120" y2="54" {...STROKE_PROPS} />
          <line x1="78" y1="33" x2="109" y2="33" {...STROKE_PROPS} />
          <line x1="78" y1="43" x2="109" y2="43" {...STROKE_PROPS} />
        </svg>
      );

    case 'tshirt':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="t-shirt" role="img">
          <path d="M44 27l15-10h22l15 10 14 8-12 20-10-6v44H52V49l-10 6-12-20z" {...STROKE_PROPS} />
          <path d="M60 18c0 6 4 11 10 11s10-5 10-11" {...STROKE_PROPS} />
        </svg>
      );

    case 'pencil':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="pencil" role="img">
          <path d="M22 78l69-69 20 20-69 69-24 4z" {...STROKE_PROPS} />
          <line x1="79" y1="21" x2="99" y2="41" {...STROKE_PROPS} />
          <line x1="42" y1="98" x2="34" y2="90" {...STROKE_PROPS} />
        </svg>
      );

    case 'umbrella':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="umbrella" role="img">
          <path d="M20 56c12-20 34-32 50-32s38 12 50 32H20z" {...STROKE_PROPS} />
          <line x1="70" y1="24" x2="70" y2="76" {...STROKE_PROPS} />
          <path d="M70 76c0 9 5 14 12 14 6 0 10-4 10-9" {...STROKE_PROPS} />
        </svg>
      );

    case 'banana':
      return (
        <svg className={className} viewBox="0 0 768 768" aria-label="banana" role="img">
          <g transform="translate(209 644) scale(0.031 -0.031)" fill="currentColor" stroke="none">
            <path d="M5895 16664 c-185 -40 -403 -134 -550 -239 -306 -217 -437 -502 -345 -746 42 -113 94 -176 378 -459 314 -312 423 -430 597 -647 122 -153 304 -405 386 -537 l43 -69 -19 -31 c-181 -305 -245 -555 -245 -953 1 -286 28 -514 140 -1148 160 -903 198 -1264 187 -1770 -17 -774 -203 -1487 -589 -2260 -475 -950 -1181 -1834 -2273 -2850 -604 -562 -954 -840 -1885 -1500 -799 -566 -1078 -788 -1292 -1030 -242 -272 -348 -507 -348 -770 0 -290 112 -529 366 -777 158 -155 296 -258 499 -371 270 -151 653 -278 1055 -351 479 -87 1108 -102 1715 -40 1356 137 2790 649 3895 1392 1844 1241 3147 3375 3515 5755 177 1145 117 2317 -170 3322 -364 1275 -1160 2667 -1935 3385 -470 434 -893 644 -1348 667 l-123 6 -58 71 c-214 262 -401 583 -514 881 -25 66 -73 216 -107 333 -104 359 -144 446 -260 563 -86 87 -176 139 -298 170 -93 24 -310 25 -417 3z m706 -828 c38 -132 95 -303 125 -380 132 -333 339 -677 581 -965 121 -143 126 -147 224 -143 l80 2 51 -55 c522 -571 1036 -1655 1308 -2755 275 -1116 322 -2304 129 -3332 -65 -351 -204 -827 -344 -1178 -1072 -2701 -3875 -4854 -7010 -5385 -110 -19 -254 -41 -320 -50 -66 -8 -135 -18 -153 -21 -31 -5 -32 -4 -32 28 0 56 -28 209 -55 303 -47 163 -143 341 -262 487 l-55 68 23 20 c201 173 440 352 1044 780 803 569 1233 907 1695 1330 931 854 1525 1518 2019 2260 328 492 555 926 745 1418 268 697 388 1415 356 2132 -20 447 -54 718 -186 1460 -117 659 -152 966 -141 1220 14 305 78 513 222 725 82 121 90 155 50 230 -41 77 -261 406 -362 540 -183 245 -446 548 -631 728 -63 61 -77 79 -64 84 153 53 264 113 409 222 172 129 362 341 429 476 l27 57 14 -34 c8 -18 46 -141 84 -272z m1629 -1646 c635 -319 1360 -1201 1920 -2335 469 -948 686 -1719 772 -2735 20 -235 17 -913 -5 -1169 -117 -1358 -523 -2623 -1214 -3786 -353 -593 -756 -1109 -1250 -1596 -344 -339 -643 -585 -1018 -836 -1680 -1123 -4019 -1646 -5625 -1257 -235 57 -514 162 -698 261 -45 24 -82 45 -82 46 0 1 24 50 54 108 45 88 89 209 134 368 7 24 14 26 152 43 2498 314 4875 1632 6438 3570 921 1143 1493 2452 1641 3753 97 849 51 1754 -134 2655 -229 1112 -678 2199 -1210 2927 l-46 62 38 -16 c21 -8 81 -37 133 -63z" />
          </g>
        </svg>
      );

    case 'cat':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="cat" role="img">
          <circle cx="70" cy="58" r="28" {...STROKE_PROPS} />
          <path d="M50 39l-8-14 18 7" {...STROKE_PROPS} />
          <path d="M90 39l8-14-18 7" {...STROKE_PROPS} />
          <circle cx="60" cy="58" r="2.8" fill="currentColor" />
          <circle cx="80" cy="58" r="2.8" fill="currentColor" />
          <path d="M64 70c4 4 8 4 12 0" {...STROKE_PROPS} />
        </svg>
      );

    case 'dog':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="dog" role="img">
          <circle cx="70" cy="56" r="27" {...STROKE_PROPS} />
          <path d="M47 46l-12-13 5 21" {...STROKE_PROPS} />
          <path d="M93 46l12-13-5 21" {...STROKE_PROPS} />
          <circle cx="61" cy="57" r="2.5" fill="currentColor" />
          <circle cx="79" cy="57" r="2.5" fill="currentColor" />
          <ellipse cx="70" cy="66" rx="5" ry="4" {...STROKE_PROPS} />
        </svg>
      );

    case 'fish':
      return (
        <svg className={className} viewBox="0 0 140 110" aria-label="fish" role="img">
          <path
            d="M24 56c13-16 28-24 48-24 22 0 38 10 52 24-14 14-30 24-52 24-20 0-35-8-48-24z"
            {...STROKE_PROPS}
          />
          <path d="M24 56L10 44v24z" {...STROKE_PROPS} />
          <circle cx="83" cy="54" r="3" fill="currentColor" />
          <line x1="100" y1="56" x2="116" y2="56" {...STROKE_PROPS} />
        </svg>
      );

    default:
      return null;
  }
};

export default CounterObjectIllustration;
