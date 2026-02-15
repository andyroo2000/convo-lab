import { useMemo } from 'react';

interface DateMiniCalendarProps {
  date: Date;
}

interface CalendarCell {
  key: string;
  day: number | null;
}

const getMonthLabel = (date: Date) => `${date.getMonth() + 1}月`;

const buildCalendarCells = (date: Date): CalendarCell[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayJs = new Date(year, month, 1).getDay();
  const firstDayMondayIndex = (firstDayJs + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstDayMondayIndex; index += 1) {
    cells.push({ key: `pad-start-${index + 1}`, day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `day-${day}`, day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-end-${cells.length}`, day: null });
  }

  return cells;
};

const DateMiniCalendar = ({ date }: DateMiniCalendarProps) => {
  const monthLabel = useMemo(() => getMonthLabel(date), [date]);
  const selectedDay = date.getDate();
  const calendarCells = useMemo(() => buildCalendarCells(date), [date]);

  return (
    <aside className="retro-date-mini-calendar" aria-label={`${monthLabel} calendar`}>
      <header className="retro-date-mini-calendar-header">
        <p className="retro-date-mini-calendar-month">{monthLabel}</p>
      </header>

      <div className="retro-date-mini-calendar-weekdays" aria-hidden>
        <span className="retro-date-mini-calendar-weekday">月</span>
        <span className="retro-date-mini-calendar-weekday">火</span>
        <span className="retro-date-mini-calendar-weekday">水</span>
        <span className="retro-date-mini-calendar-weekday">木</span>
        <span className="retro-date-mini-calendar-weekday">金</span>
        <span className="retro-date-mini-calendar-weekday">土</span>
        <span className="retro-date-mini-calendar-weekday">日</span>
      </div>

      <div className="retro-date-mini-calendar-grid">
        {calendarCells.map((cell) => {
          const isCurrentDay = cell.day === selectedDay;

          return (
            <div
              key={cell.key}
              className={`retro-date-mini-calendar-cell ${cell.day ? 'has-day' : ''} ${isCurrentDay ? 'is-current' : ''}`}
              aria-current={isCurrentDay ? 'date' : undefined}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default DateMiniCalendar;
