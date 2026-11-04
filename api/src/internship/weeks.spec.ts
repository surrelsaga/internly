import { currentWeek, generateWeeks } from './weeks.js';

const span = (w: { startDate: string; endDate: string }) => `${w.startDate} ${w.endDate}`;

describe('generateWeeks', () => {
  it('Monday start', () => {
    const w = generateWeeks('2026-10-05', '2026-10-18');
    expect(w.map(span)).toEqual(['2026-10-05 2026-10-11', '2026-10-12 2026-10-18']);
    expect(w.map((x) => x.number)).toEqual([1, 2]);
  });

  it('midweek start begins on the Monday before', () => {
    expect(generateWeeks('2026-10-07', '2026-10-09').map(span)).toEqual(['2026-10-05 2026-10-11']);
  });

  it('crosses a month boundary', () => {
    expect(generateWeeks('2026-10-26', '2026-11-02').map(span)).toEqual(['2026-10-26 2026-11-01', '2026-11-02 2026-11-08']);
  });

  it('crosses a year boundary', () => {
    expect(generateWeeks('2026-12-23', '2027-01-06').map(span)).toEqual([
      '2026-12-21 2026-12-27',
      '2026-12-28 2027-01-03',
      '2027-01-04 2027-01-10',
    ]);
  });

  it('end date midweek keeps a full last week', () => {
    const w = generateWeeks('2026-10-05', '2026-10-14');
    expect(w).toHaveLength(2);
    expect(w[1].endDate).toBe('2026-10-18');
  });

  it('end on a Sunday does not add a week', () => {
    expect(generateWeeks('2026-10-05', '2026-10-11')).toHaveLength(1);
  });
});

describe('currentWeek', () => {
  const weeks = generateWeeks('2026-10-05', '2026-10-18');

  it('Sun 23:00 Singapore is still that week', () => {
    expect(currentWeek(weeks, new Date('2026-10-11T15:00:00Z')).number).toBe(1);
  });

  it('Mon 00:30 Singapore is the next week', () => {
    expect(currentWeek(weeks, new Date('2026-10-11T16:30:00Z')).number).toBe(2);
  });

  it('before the start returns week 1', () => {
    expect(currentWeek(weeks, new Date('2026-09-01T00:00:00Z')).number).toBe(1);
  });

  it('after the end returns the last week', () => {
    expect(currentWeek(weeks, new Date('2027-01-01T00:00:00Z')).number).toBe(2);
  });
});
