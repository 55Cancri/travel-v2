import * as React from "react";
import { Block, Input, MapPin, Text } from "atoms";
import { FieldLabel, GhostButton, PrimaryButton } from "alloys";
import {
  removePlace,
  savePlace,
  updatePlace,
  useScoutDb,
  activeMap,
} from "entities/scout-maps";
import { attachGoogleHours } from "../attach-google-hours";
import type { Finding } from "../find-places";
import { googleTodayLine, openLine, placeOpenVerdict } from "../open-now";
import { Sheet } from "../sheet";
import { SwatchRow } from "./swatch-row";

// One place's editor: rename it, recolor its pin, save it into the map or
// remove it. Two lives: a SAVED place edits the document directly (every
// keystroke lands, like the trip item editor), while a search FINDING is
// a draft that only enters the document on Save.

export type PlaceDrawerTarget =
  | { kind: "saved"; placeId: string }
  | { kind: "finding"; lineColor: string; finding: Finding };

export function PlaceDrawer(props: {
  mapId: string;
  target: PlaceDrawerTarget | null;
  now: Temporal.Instant;
  onClose: () => void;
}) {
  const scoutDb = useScoutDb();
  const target = props.target;
  const saved =
    target?.kind === "saved" ? activeMap(scoutDb).places[target.placeId] : undefined;

  // The finding draft: local until Save. Reset whenever the drawer opens
  // onto a different place.
  const [draftLabel, storeDraftLabel] = React.useState("");
  const [draftColor, storeDraftColor] = React.useState("");
  const targetKey =
    target === null
      ? ""
      : target.kind === "saved"
        ? target.placeId
        : target.finding.id;
  const seededRef = React.useRef("");
  if (target?.kind === "finding" && seededRef.current !== targetKey) {
    seededRef.current = targetKey;
    storeDraftLabel(target.finding.name);
    storeDraftColor(target.lineColor);
  }

  // A saved target that vanished mid-edit (removed on another surface)
  // has nothing left to edit.
  const open = target !== null && (target.kind === "finding" || saved !== undefined);

  const label = target?.kind === "saved" ? (saved?.label ?? "") : draftLabel;
  const color = target?.kind === "saved" ? (saved?.color ?? "") : draftColor;
  const address = target?.kind === "saved" ? saved?.address : target?.finding.address;

  const hoursLine = (() => {
    if (target?.kind === "saved" && saved) {
      const verdict = placeOpenVerdict(saved, props.now);
      const today =
        saved.hours?.kind === "google" ? googleTodayLine(saved.hours, props.now) : null;
      return openLine(verdict) ?? today;
    }
    return null;
  })();

  const storeLabel = (text: string) => {
    if (target?.kind === "saved") updatePlace(props.mapId, target.placeId, { label: text });
    else storeDraftLabel(text);
  };

  const storeColor = (next: string) => {
    if (target?.kind === "saved") updatePlace(props.mapId, target.placeId, { color: next });
    else storeDraftColor(next);
  };

  const saveFinding = () => {
    if (target?.kind !== "finding") return;
    const finding = target.finding;
    if (finding.lng === undefined || finding.lat === undefined) return;
    const placeId = savePlace(props.mapId, {
      label: draftLabel.trim() || finding.name,
      color: draftColor,
      lng: finding.lng,
      lat: finding.lat,
      address: finding.address,
      hours: finding.spotHours
        ? { kind: "google", ...finding.spotHours }
        : finding.hours
          ? { kind: "osm", raw: finding.hours }
          : finding.hoursKnown
            ? { kind: "none" }
            : undefined,
      sourceRef: finding.id,
    });
    if (finding.placeId && !finding.spotHours && !finding.hours && !finding.hoursKnown) {
      attachGoogleHours(props.mapId, placeId, finding.placeId);
    }
    props.onClose();
  };

  const remove = () => {
    if (target?.kind !== "saved") return;
    removePlace(props.mapId, target.placeId);
    props.onClose();
  };

  return (
    <Sheet open={open} onClose={props.onClose} label="Place" size="half">
      {/* Two type sizes only: xs labels, md everything else. */}
      <Block flow="lg" pt="xs">
        <Block flow="0.25lh">
          <FieldLabel htmlFor="place-label" fontSize="xs">
            Name
          </FieldLabel>
          <Input
            id="place-label"
            value={label}
            placeholder="What do you call this place?"
            onChange={(event) => storeLabel(event.target.value)}
            py="0.35lh"
          />
        </Block>
        {address || hoursLine ? (
          <Block flow="sm">
            {address ? (
              <Block grid cols="auto 1fr" gap="sm" alignItems="start">
                <Block color="text-muted" display="grid" placeItems="center" mt="0.2rem">
                  <MapPin size={16} />
                </Block>
                <Text fontSize="md" color="text-primary">
                  {address}
                </Text>
              </Block>
            ) : null}
            {hoursLine ? (
              <Text fontSize="md" color="text-muted" pl={address ? "calc(16px + 0.5lh)" : undefined}>
                {hoursLine}
              </Text>
            ) : null}
          </Block>
        ) : null}
        <Block flow="0.25lh">
          <FieldLabel as="span" fontSize="xs">
            Pin color
          </FieldLabel>
          <SwatchRow color={color} onColor={storeColor} />
        </Block>
        <Block flex gap="sm" justifyContent="end" pt="xs">
          {target?.kind === "saved" ? (
            <GhostButton type="button" onPress={remove}>
              Remove from map
            </GhostButton>
          ) : null}
          {/* Matches the input's height (same vertical padding scale) so
              the sheet closes on two aligned rectangles. */}
          {target?.kind === "finding" ? (
            <PrimaryButton
              type="button"
              onPress={saveFinding}
              py="0.35lh"
              px="lg"
              fontSize="md"
              bg="blue.500"
              _dark={{ bg: "blue.400" }}
              _hover={{ bg: "blue.600", _dark: { bg: "blue.300" } }}
              color="white"
            >
              Save to map
            </PrimaryButton>
          ) : (
            <PrimaryButton
              type="button"
              onPress={props.onClose}
              py="0.35lh"
              px="lg"
              fontSize="md"
              bg="blue.500"
              _dark={{ bg: "blue.400" }}
              _hover={{ bg: "blue.600", _dark: { bg: "blue.300" } }}
              color="white"
            >
              Done
            </PrimaryButton>
          )}
        </Block>
      </Block>
    </Sheet>
  );
}
