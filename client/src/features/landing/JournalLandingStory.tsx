import { useEffect, useRef } from 'react';
import landingChapters from './landingChapters';
import { startLandingStory, goToLandingChapter } from './landingScroll';

const JournalLandingStory = () => {
  const story = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (story.current) return startLandingStory(story.current);
    return undefined;
  }, []);
  return (
    <div className="landing-story" ref={story}>
      <div className="landing-stage">
        {landingChapters.map((chapter, index) => (
          <section
            className={`landing-chapter landing-chapter-${index}`}
            key={chapter.film}
            aria-labelledby={`landing-heading-${index}`}
          >
            <div className="landing-copy">
              {index === 0 ? (
                <h1 id={`landing-heading-${index}`}>{chapter.title}</h1>
              ) : (
                <h2 id={`landing-heading-${index}`}>{chapter.title}</h2>
              )}
              <p>{chapter.body}</p>
              {index === 0 && (
                <a className="landing-cta" href="#request-access">
                  Request access
                </a>
              )}
            </div>
            <figure className={`landing-film landing-film-${chapter.film}`}>
              <video
                muted
                loop
                playsInline
                preload="none"
                tabIndex={0}
                poster={`/journal-landing/${chapter.film}.jpg`}
                aria-label={`${chapter.description} Select to pause or resume.`}
              >
                <source src={`/journal-landing/${chapter.film}.mp4`} type="video/mp4" />
              </video>
            </figure>
          </section>
        ))}
        <nav className="landing-chapter-nav" aria-label="Page sections">
          {landingChapters.map((chapter, index) => (
            <button
              type="button"
              key={chapter.film}
              data-chapter={index}
              aria-label={chapter.title}
              title={chapter.title}
              onClick={() => goToLandingChapter(story.current, index)}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default JournalLandingStory;
