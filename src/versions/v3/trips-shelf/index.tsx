import { Scout } from "../scout";

// Generation v3 has one screen: the map, with the query panel floating on
// it. The shelf lands straight there, so nothing stands between opening the
// app and asking the map a question.
export function TripsShelf() {
  return <Scout />;
}
