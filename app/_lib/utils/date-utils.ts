import { differenceInYears, getMonth, getDate, getYear, getDayOfYear } from "date-fns";

export interface ClientBirthdayFields {
  age: number | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthDayOfYear: number | null;
}

export function computeBirthdayFields(birthday: Date | null): ClientBirthdayFields {
  if (!birthday) {
    return { age: null, birthYear: null, birthMonth: null, birthDay: null, birthDayOfYear: null };
  }
  return {
    age: differenceInYears(new Date(), birthday),
    birthYear: getYear(birthday),
    birthMonth: getMonth(birthday) + 1,
    birthDay: getDate(birthday),
    birthDayOfYear: getDayOfYear(birthday),
  };
}
