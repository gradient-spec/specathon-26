export interface ScheduleEvent {
  id: string;
  name: string;
  timeLabel: string;
  startStr: string;
  endStr: string;
  iconName: "Rocket" | "Users" | "Utensils" | "UserCog" | "FileText" | "Trophy";
  day: number;
}

export const ALL_EVENTS: ScheduleEvent[] = [
  { id: "inaugural", name: "Inaugural", timeLabel: "9:30 AM", startStr: "09:30", endStr: "11:30", iconName: "Rocket", day: 1 },
  { id: "round-1", name: "Round 1 Evaluation", timeLabel: "11:30 AM", startStr: "11:30", endStr: "20:00", iconName: "Users", day: 1 },
  { id: "dinner", name: "Dinner", timeLabel: "8:00 PM – 9:00 PM", startStr: "20:00", endStr: "21:00", iconName: "Utensils", day: 1 },
  { id: "mentorship", name: "Mentorship / Internal Evaluation", timeLabel: "9:30 PM – 11:30 PM", startStr: "21:30", endStr: "23:30", iconName: "UserCog", day: 1 },
  { id: "round-2", name: "Round 2 Evaluation", timeLabel: "10:00 AM – 1:00 PM", startStr: "10:00", endStr: "13:00", iconName: "FileText", day: 2 },
  { id: "lunch", name: "Lunch", timeLabel: "1:00 PM – 2:00 PM", startStr: "13:00", endStr: "14:00", iconName: "Utensils", day: 2 },
  { id: "final-eval", name: "Final Evaluation", timeLabel: "2:30 PM", startStr: "14:30", endStr: "17:30", iconName: "Trophy", day: 2 },
];
