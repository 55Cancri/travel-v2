import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Block, Button, Link, Text } from "atoms/blocks";
import { haptics } from "entities/haptics";
import { createTrip, resetToSeed, useDb, useMounted } from "entities/trips/store";

export const Route = createFileRoute("/")({ component: TripsScreen });

// Home: the trip shelf. Each card is a trip; tap through to plan it.
function TripsScreen() {
  const db = useDb();
  const mounted = useMounted();
  const navigate = useNavigate();

  const newTrip = () => {
    haptics.tap();
    const id = createTrip("Untitled trip");
    navigate({ to: "/trip/$tripId", params: { tripId: id } });
  };

  if (!mounted) return null;

  return (
    <Block as="main" maxW="42rem" mx="auto" px="md" pt="lg" pb="2xl" flow="md">
      <Block grid cols="1fr auto" alignItems="baseline">
        <Text as="h1" fontSize="2xl" fontWeight={700} letterSpacing="-0.02em">
          Trips
        </Text>
        <Button
          type="button"
          onClick={newTrip}
          px="sm"
          py="xs"
          borderRadius="sm"
          bg="accent"
          color="text-on-accent"
          fontSize="sm"
          fontWeight={550}
          _hover={{ bg: "accent-strong" }}
        >
          + New trip
        </Button>
      </Block>

      <Block flow="sm">
        {db.tripOrder.map((tripId) => {
          const trip = db.trips[tripId];
          if (!trip) return null;
          const segments = trip.segmentIds
            .map((id) => db.segments[id])
            .filter((segment) => segment !== undefined);
          const itemIds = segments.flatMap((segment) => [
            ...segment.poolItemIds,
            ...segment.dayIds.flatMap((dayId) => db.days[dayId]?.itemIds ?? []),
          ]);
          const active = itemIds
            .map((id) => db.items[id])
            .filter((entry) => entry && entry.status !== "cancelled");
          const done = active.filter((entry) => entry?.status === "done").length;
          return (
            <Link
              key={trip.id}
              to="/trip/$tripId"
              params={{ tripId: trip.id }}
              onClick={() => haptics.tap()}
              display="block"
              p="md"
              bg="surface-panel"
              borderWidth="1px"
              borderStyle="solid"
              borderColor="border-muted"
              borderRadius="sm"
              textDecoration="none"
              color="text-primary"
              boxShadow="0 1px 2px rgba(28, 25, 23, 0.04)"
              _hover={{ borderColor: "border-strong" }}
            >
              <Block grid cols="1fr auto" alignItems="baseline" gap="sm">
                <Text as="span" fontSize="lg" fontWeight={600}>
                  {trip.name}
                </Text>
                <Text as="span" fontSize="sm" color="text-muted">
                  {done}/{active.length} done
                </Text>
              </Block>
              {trip.dates ? (
                <Text as="p" fontSize="sm" color="text-muted" mt="xs">
                  {trip.dates}
                </Text>
              ) : null}
              {segments.length ? (
                <Block flex gap="xs" mt="sm" flexWrap="wrap">
                  {segments.map((segment) => (
                    <Text
                      key={segment.id}
                      as="span"
                      fontSize="xs"
                      fontWeight={550}
                      px="sm"
                      py="0.1lh"
                      bg="surface-muted"
                      borderRadius="9999px"
                      color="text-muted"
                    >
                      {segment.name}
                    </Text>
                  ))}
                </Block>
              ) : null}
            </Link>
          );
        })}
      </Block>

      <Button
        type="button"
        onClick={() => resetToSeed()}
        bg="transparent"
        color="text-muted"
        fontSize="xs"
        px="0"
        _hover={{ color: "text-primary" }}
      >
        Reset demo data
      </Button>
    </Block>
  );
}
