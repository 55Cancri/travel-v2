import { Block, Input, Plus, Text, X } from "atoms";
import { GhostButton, IconButton } from "alloys";
import {
  createMap,
  deleteMap,
  renameMap,
  switchMap,
  useScoutDb,
} from "entities/scout-maps";
import { Sheet } from "../sheet";

// Every saved map, one current. The active map's name edits in place;
// pressing another row switches to it. Deleting asks first when the map
// holds anything, exactly like deleting a city in the planner.

export function MapsMenu(props: { open: boolean; onClose: () => void }) {
  const scoutDb = useScoutDb();

  const removeMap = (mapId: string) => {
    const map = scoutDb.maps[mapId];
    if (!map) return;
    const holdings = map.placeOrder.length;
    if (
      holdings > 0 &&
      !window.confirm(
        `Delete ${map.name} and everything on it? (${holdings} ${holdings === 1 ? "place" : "places"})`,
      )
    ) {
      return;
    }
    deleteMap(mapId);
  };

  return (
    <Sheet open={props.open} onClose={props.onClose} label="Your maps" size="half">
      <Block flow="sm" pt="xs">
        <Block grid cols="1fr auto" alignItems="center">
          <Text fontSize="md" fontWeight="600">
            Maps
          </Text>
          <IconButton
            type="button"
            aria-label="Start a new map"
            onPress={() => createMap(`Map ${scoutDb.mapOrder.length + 1}`)}
          >
            <Plus size={16} />
          </IconButton>
        </Block>
        {scoutDb.mapOrder.map((mapId) => {
          const map = scoutDb.maps[mapId];
          if (!map) return null;
          const active = mapId === scoutDb.activeMapId;
          const holdings = map.placeOrder.length;
          return (
            <Block key={mapId} grid cols="1fr auto" alignItems="center" gap="xs">
              {active ? (
                <Block flow="0">
                  <Input
                    value={map.name}
                    aria-label="Rename this map"
                    onChange={(event) => renameMap(mapId, event.target.value)}
                  />
                  <Text fontSize="xs" color="text-muted" pl="xs">
                    Current map · {holdings} {holdings === 1 ? "place" : "places"}
                  </Text>
                </Block>
              ) : (
                <GhostButton
                  type="button"
                  onPress={() => {
                    switchMap(mapId);
                    props.onClose();
                  }}
                  justifyContent="start"
                  textAlign="start"
                >
                  <Block grid justifyItems="start">
                    <Text fontSize="sm" fontWeight="550" color="text-primary">
                      {map.name}
                    </Text>
                    <Text fontSize="xs" color="text-muted">
                      {holdings} {holdings === 1 ? "place" : "places"}
                    </Text>
                  </Block>
                </GhostButton>
              )}
              <IconButton
                type="button"
                aria-label={`Delete ${map.name}`}
                onPress={() => removeMap(mapId)}
              >
                <X size={16} />
              </IconButton>
            </Block>
          );
        })}
      </Block>
    </Sheet>
  );
}
