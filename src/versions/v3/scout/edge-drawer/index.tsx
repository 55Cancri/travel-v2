import { Block, Button, Text } from "atoms";
import { GhostButton } from "alloys";
import {
  activeMap,
  ALL_RIDE_MODES,
  removeEdge,
  setEdgeModes,
  useScoutDb,
  type RideMode,
} from "entities/scout-maps";
import { Sheet } from "../sheet";

// One connection's editor: which transport may carry it, and the way to
// remove it. Toggling a mode writes the document immediately, so the
// route redraws live behind the sheet.

const MODE_LABELS: Record<RideMode, string> = {
  walk: "Walking",
  bus: "Bus",
  tram: "Tram",
  train: "Train",
  metro: "Metro",
  ferry: "Ferry",
};

export function EdgeDrawer(props: {
  mapId: string;
  edgeId: string | null;
  onClose: () => void;
}) {
  const scoutDb = useScoutDb();
  const map = activeMap(scoutDb);
  const edge = props.edgeId ? map.edges.find((entry) => entry.id === props.edgeId) : undefined;
  const from = edge ? map.places[edge.fromId] : undefined;
  const to = edge ? map.places[edge.toId] : undefined;

  const toggleMode = (mode: RideMode) => {
    if (!edge) return;
    const next = edge.modes.includes(mode)
      ? edge.modes.filter((entry) => entry !== mode)
      : edge.modes.concat(mode);
    // The store refuses an empty list; reflecting that here keeps the
    // last lit chip visibly lit instead of appearing to turn off.
    if (next.length > 0) setEdgeModes(props.mapId, edge.id, next);
  };

  return (
    <Sheet open={edge !== undefined} onClose={props.onClose} label="Connection" size="half">
      <Block flow="md" pt="xs">
        <Text fontSize="md" fontWeight="600">
          {from?.label ?? "?"} to {to?.label ?? "?"}
        </Text>
        <Text fontSize="sm" color="text-muted">
          What may carry this leg. Fewer choices bend the route: tram only
          follows the rails, walking only follows the sidewalks.
        </Text>
        <Block flex gap="sm" flexWrap="wrap">
          {ALL_RIDE_MODES.map((mode) => {
            const active = edge?.modes.includes(mode) ?? false;
            return (
              <Button
                key={mode}
                type="button"
                aria-pressed={active}
                onPress={() => toggleMode(mode)}
                px="sm"
                py="0.2lh"
                borderRadius="9999px"
                borderWidth="1.5px"
                borderStyle="solid"
                borderColor={active ? "accent" : "border-muted"}
                bg={active ? "accent-soft" : "transparent"}
                color={active ? "text-primary" : "text-muted"}
                fontSize="sm"
                fontWeight={550}
              >
                {MODE_LABELS[mode]}
              </Button>
            );
          })}
        </Block>
        <Block flex justifyContent="end">
          <GhostButton
            type="button"
            onPress={() => {
              if (edge) removeEdge(props.mapId, edge.id);
              props.onClose();
            }}
          >
            Remove connection
          </GhostButton>
        </Block>
      </Block>
    </Sheet>
  );
}
