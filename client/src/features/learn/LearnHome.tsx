import { Link } from 'react-router-dom';
import { BookOpen, MessageCircle } from 'lucide-react';
import type { LearnCollection, LearnLesson } from './types';

const LessonContents = ({ lesson }: { lesson: LearnLesson }) => (
  <p>
    {lesson.checkCount} explanations ·{' '}
    {lesson.exerciseCount ? `${lesson.exerciseCount} workbook questions` : 'Textbook examples'}
  </p>
);

const LearnHome = ({ lessons, sessions }: LearnCollection) => (
  <section className="learn-home" aria-labelledby="learn-title">
    <p className="learn-eyebrow">Your learning notebook · Quartet 1</p>
    <h1 id="learn-title">
      A little understanding.
      <br />A lot more Japanese.
    </h1>
    <p className="learn-lead">
      Chapter 1 · Learn the idea, talk it through, then make it your own.
    </p>
    <div className="learn-home-grid">
      {lessons.map((lesson) => {
        const session = sessions.find((value) => value.lessonId === lesson.id);
        const startLabel = session ? 'Continue learning' : 'Start here';
        const completed =
          session?.state.completed ||
          session?.state.phase === 'complete' ||
          session?.state.reviewing;
        return (
          <article key={lesson.id} className="learn-sheet learn-lesson-card">
            <span className="learn-badge">{completed ? 'Worked through' : startLabel}</span>
            <h2 lang="ja">{lesson.title}</h2>
            <p className="learn-lead">{lesson.subtitle}</p>
            <div className="learn-sequence">
              <span>Understand</span>
              <span>Practice</span>
              <span>Use</span>
            </div>
            <LessonContents lesson={lesson} />
            <Link className="learn-button" to={`/app/learn/${lesson.id}`}>
              {session ? 'Open lesson' : 'Begin with your tutor'}
            </Link>
            <p className="learn-source">{lesson.source}</p>
          </article>
        );
      })}
    </div>
    <div className="learn-home-notes">
      <p>
        <MessageCircle size={20} aria-hidden="true" /> Ask questions whenever you need to. Your
        tutor waits for you.
      </p>
      <p>
        <BookOpen size={20} aria-hidden="true" /> Your answers stay yours—with tappable correction
        notes.
      </p>
    </div>
  </section>
);

export default LearnHome;
