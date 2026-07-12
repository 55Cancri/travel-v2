import { useNavigate } from "@tanstack/react-router";
import { Block, Button, Link, Text } from "atoms";
import { Numeric, PrimaryButton, Subtext, Title } from "alloys";
import { createTrip, resetToSeed, useDb } from "entities/trips/store";
import { UiVersionPicker } from "../../picker";

// Home: the trip shelf. Each card is a trip; tap through to plan it.
export function TripsShelf() {
  const db = useDb();
  const navigate = useNavigate();

  const newTrip = () => {
    const id = createTrip("Untitled trip");
    navigate({ to: "/trip/$tripId", params: { tripId: id } });
  };

  return (
    <Block as="main" maxW="42rem" mx="auto" px="md" pt="lg" pb="2xl" flow="md">
      <Block grid cols="1fr auto auto" alignItems="baseline" gap="sm">
        <Text as="h1" fontSize="2xl" fontWeight={650} letterSpacing="-0.02em">
          Trips
        </Text>
        <UiVersionPicker />
        <PrimaryButton onPress={newTrip} px="sm">
          + New trip
        </PrimaryButton>
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
                <Title fontSize="lg">{trip.name}</Title>
                <Numeric fontSize="sm" color="text-muted">
                  {done}/{active.length} done
                </Numeric>
              </Block>
              {trip.dates ? (
                <Subtext as="p" fontSize="sm" mt="xs">
                  {trip.dates}
                </Subtext>
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
        onPress={() => resetToSeed()}
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
