'use client';

import { useMemo, useState } from 'react';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const buildMonthGrid = (year, month) => {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();

  const cells = [];
  let currentDay = 1;
  let nextMonthDay = 1;

  for (let i = 0; i < 42; i += 1) {
    if (i < firstDayOfWeek) {
      const prevMonthRaw = month - 1;
      const prevMonth = (prevMonthRaw + 12) % 12;
      const prevYear = prevMonthRaw < 0 ? year - 1 : year;
      const day = daysInPreviousMonth - firstDayOfWeek + i + 1;

      cells.push({
        day,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
      });
      continue;
    }

    if (currentDay <= daysInCurrentMonth) {
      cells.push({
        day: currentDay,
        month,
        year,
        isCurrentMonth: true,
      });
      currentDay += 1;
      continue;
    }

    const nextMonthRaw = month + 1;
    const nextMonth = nextMonthRaw % 12;
    const nextYear = nextMonthRaw > 11 ? year + 1 : year;

    cells.push({
      day: nextMonthDay,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
    nextMonthDay += 1;
  }

  return cells;
};

export const ContinuousCalendar = ({ onClick }) => {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState({
    day: today.getDate(),
    month: today.getMonth(),
    year: today.getFullYear(),
  });

  const monthOptions = monthNames.map((monthName, index) => ({
    name: monthName,
    value: `${index}`,
  }));

  const calendarDays = useMemo(() => buildMonthGrid(year, selectedMonth), [year, selectedMonth]);

  const handlePrevMonth = () => {
    setSelectedMonth((prevMonth) => {
      if (prevMonth === 0) {
        setYear((prevYear) => prevYear - 1);
        return 11;
      }

      return prevMonth - 1;
    });
  };

  const handleNextMonth = () => {
    setSelectedMonth((prevMonth) => {
      if (prevMonth === 11) {
        setYear((prevYear) => prevYear + 1);
        return 0;
      }

      return prevMonth + 1;
    });
  };

  const handleMonthChange = (event) => {
    setSelectedMonth(Number.parseInt(event.target.value, 10));
  };

  const handleTodayClick = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setSelectedDate({
      day: now.getDate(),
      month: now.getMonth(),
      year: now.getFullYear(),
    });
  };

  const handleDayClick = (cell) => {
    setSelectedDate({
      day: cell.day,
      month: cell.month,
      year: cell.year,
    });

    if (onClick) {
      onClick(cell.day, cell.month, cell.year);
    }
  };

  return (
    <div className="rounded-t-2xl bg-white pb-8 text-slate-800 shadow-xl">
      <div className="sticky -top-px z-50 w-full rounded-t-2xl bg-white px-5 pt-7 sm:px-8 sm:pt-8">
        <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Select name="month" value={`${selectedMonth}`} options={monthOptions} onChange={handleMonthChange} />
            <button
              onClick={handleTodayClick}
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100 lg:px-5 lg:py-2.5"
            >
              Today
            </button>
            <button
              type="button"
              className="whitespace-nowrap rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-gradient-to-bl focus:outline-none focus:ring-4 focus:ring-cyan-300 sm:rounded-xl lg:px-5 lg:py-2.5"
            >
              + Add Event
            </button>
          </div>
          <div className="flex w-fit items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="rounded-full border border-slate-300 p-1 transition-colors hover:bg-slate-100 sm:p-2"
            >
              <svg className="size-5 text-slate-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 19-7-7 7-7" />
              </svg>
            </button>
            <h1 className="min-w-28 px-2 text-center text-lg font-semibold sm:min-w-36 sm:text-xl">
              {monthNames[selectedMonth]} {year}
            </h1>
            <button
              onClick={handleNextMonth}
              className="rounded-full border border-slate-300 p-1 transition-colors hover:bg-slate-100 sm:p-2"
            >
              <svg className="size-5 text-slate-800" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="grid w-full grid-cols-7 justify-between text-slate-500">
          {daysOfWeek.map((day) => (
            <div key={day} className="w-full border-b border-slate-200 py-2 text-center font-semibold">
              {day}
            </div>
          ))}
        </div>
      </div>

      <div className="grid w-full grid-cols-7 gap-1 px-5 pt-4 sm:gap-2 sm:px-8 sm:pt-6">
        {calendarDays.map((cell, index) => {
          const isToday =
            cell.day === today.getDate() &&
            cell.month === today.getMonth() &&
            cell.year === today.getFullYear();

          const isSelected =
            cell.day === selectedDate.day &&
            cell.month === selectedDate.month &&
            cell.year === selectedDate.year;

          const dayTextClass = cell.isCurrentMonth ? 'text-slate-900' : 'text-slate-400';

          return (
            <button
              key={`${cell.year}-${cell.month}-${cell.day}-${index}`}
              type="button"
              onClick={() => handleDayClick(cell)}
              className={`group relative aspect-square rounded-xl border p-2 text-left transition-all hover:border-cyan-400 sm:rounded-2xl sm:p-2.5 lg:rounded-3xl ${
                isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'
              } ${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50'}`}
            >
              <span
                className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-medium sm:size-7 sm:text-sm ${dayTextClass} ${
                  isToday ? 'bg-blue-500 font-semibold text-white' : ''
                }`}
              >
                {cell.day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const Select = ({ name, value, label, options = [], onChange, className = '' }) => (
  <div className={`relative ${className}`}>
    {label && (
      <label htmlFor={name} className="mb-2 block font-medium text-slate-800">
        {label}
      </label>
    )}
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="cursor-pointer rounded-lg border border-gray-300 bg-white py-1.5 pl-2 pr-6 text-sm font-medium text-gray-900 hover:bg-gray-100 sm:rounded-xl sm:py-2.5 sm:pl-3 sm:pr-8"
      required
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.name}
        </option>
      ))}
    </select>
    <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-1 sm:pr-2">
      <svg className="size-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
      </svg>
    </span>
  </div>
);
