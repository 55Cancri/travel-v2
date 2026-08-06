import { Block, Button, Text, X } from "atoms";
import { Eyebrow, IconButton } from "alloys";
import {
  forgetSearch,
  frequentSearches,
  saveSearch,
  useScoutDb,
} from "entities/scout-maps";

// What to search before anything is typed: saved queries, the often-typed
// ones, and the recent ones, each a one-tap refill. Typing narrows every
// section to the entries still matching, so a saved search is reachable
// by its first letters.

const RECENT_ROWS = 6;

export function SuggestionRows(props: { typed: string; onPick: (query: string) => void }) {
  const scoutDb = useScoutDb();
  const needle = props.typed.trim().toLowerCase();
  const matches = (query: string) => needle === "" || query.toLowerCase().includes(needle);

  const saved = scoutDb.searches.saved.filter((entry) => matches(entry.query));
  const frequent = frequentSearches(scoutDb).filter((entry) => matches(entry.query));
  const frequentQueries = new Set(frequent.map((entry) => entry.query.toLowerCase()));
  const savedQueries = new Set(saved.map((entry) => entry.query.toLowerCase()));
  const recent = scoutDb.searches.recents
    .filter(
      (entry) =>
        matches(entry.query) &&
        !frequentQueries.has(entry.query.toLowerCase()) &&
        !savedQueries.has(entry.query.toLowerCase()),
    )
    .slice(0, RECENT_ROWS);

  const typedIsSaved = savedQueries.has(needle);

  if (saved.length === 0 && frequent.length === 0 && recent.length === 0 && needle === "") {
    return null;
  }

  const pickRow = (query: string, key: string) => (
    <Button
      key={key}
      type="button"
      onPress={() => props.onPick(query)}
      justifyContent="start"
      w="100%"
      px="xs"
      py="0.15lh"
      borderRadius="xs"
      _hover={{ bg: "surface-hover" }}
    >
      <Text fontSize="sm" color="text-primary" textAlign="start">
        {query}
      </Text>
    </Button>
  );

  return (
    <Block flow="sm" pb="sm">
      {saved.length > 0 ? (
        <Block flow="0.1lh">
          <Eyebrow>Saved</Eyebrow>
          {saved.map((entry) => (
            <Block key={entry.id} grid cols="1fr auto" alignItems="center">
              {pickRow(entry.query, entry.id)}
              <IconButton
                type="button"
                aria-label={`Forget the saved search ${entry.query}`}
                onPress={() => forgetSearch(entry.id)}
              >
                <X size={14} />
              </IconButton>
            </Block>
          ))}
        </Block>
      ) : null}
      {frequent.length > 0 ? (
        <Block flow="0.1lh">
          <Eyebrow>Often searched</Eyebrow>
          {frequent.map((entry) => pickRow(entry.query, `frequent:${entry.query}`))}
        </Block>
      ) : null}
      {recent.length > 0 ? (
        <Block flow="0.1lh">
          <Eyebrow>Recent</Eyebrow>
          {recent.map((entry) => pickRow(entry.query, `recent:${entry.query}`))}
        </Block>
      ) : null}
      {needle.length >= 3 && !typedIsSaved ? (
        <Button
          type="button"
          onPress={() => saveSearch(props.typed.trim())}
          justifyContent="start"
          px="xs"
          borderRadius="xs"
          color="text-muted"
          fontSize="xs"
          fontWeight={550}
          _hover={{ color: "text-primary" }}
        >
          Save "{props.typed.trim()}" for later
        </Button>
      ) : null}
    </Block>
  );
}
