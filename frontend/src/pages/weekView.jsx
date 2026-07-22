import { useState } from 'react';

export default function WeekView() {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getWeekDays = (date) => {
        const curr = new Date(date);
        const first = curr.getDate() - curr.getDay();
        const days = [];

        for (let i = 0; i < 7; i++) {
            const day = new Date(curr.setDate(first + i));
            days.push(new Date(day));
        }

        return days;
    };

    const weekDays = getWeekDays(currentDate);

    const handlePrevWeek = () => {
        setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
    };

    const handleNextWeek = () => {
        setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
    };

    return (
        <div className="week-view">
            <button onClick={handlePrevWeek}>← Previous</button>
            <button onClick={handleNextWeek}>Next →</button>

            <div className="week-grid">
                {weekDays.map((day) => (
                    <div key={day.toISOString()} className="day-cell">
                        <h3>{day.toLocaleDateString('en-US', { weekday: 'short' })}</h3>
                        <p>{day.getDate()}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}