// OpenStreetMap plumbing, version-neutral: the one throttled door to the
// Overpass API, and the opening_hours grammar its tags speak.

export {
  clockLabel,
  formatHours,
  isOpenAt,
  nextChange,
  parseOpeningHours,
  type DayRule,
} from "./opening-hours";
export { overpassQuery } from "./overpass";
