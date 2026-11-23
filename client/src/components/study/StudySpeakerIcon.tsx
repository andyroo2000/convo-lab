import './studySpeaker.css';

/** The selected four-frame rhythm: 800 ms quiet, 400 + 400 ms, 960 ms full. */
const StudySpeakerIcon = ({ playing }: { playing: boolean }) => (
  <svg
    viewBox="0 0 44 44"
    className="study-speaker-icon"
    data-playing={playing}
    aria-hidden="true"
    fill="none"
  >
    <path
      className="study-speaker-cone"
      d="M19.33 9.84a1.18 1.18 0 0 0-2-.83l-5.64 5.64a2.33 2.33 0 0 1-1.65.68H6a1.67 1.67 0 0 0-1.67 1.67v10A1.67 1.67 0 0 0 6 28.67h4.04a2.33 2.33 0 0 1 1.65.68l5.64 5.64a1.18 1.18 0 0 0 2-.83Z"
    />
    {[6, 11.8, 17.6].map((radius, index) => {
      const diagonal = radius / Math.SQRT2;
      return (
        <path
          key={radius}
          className={`study-speaker-wave study-speaker-wave-${String(index + 1)}`}
          d={`M${String(22.3 + diagonal)} ${String(22 - diagonal)} A${String(radius)} ${String(radius)} 0 0 1 ${String(22.3 + diagonal)} ${String(22 + diagonal)}`}
        />
      );
    })}
  </svg>
);

export default StudySpeakerIcon;
