import { Block } from "atoms";
import { Subtext, Title } from "alloys";
import { Canvas } from "../canvas";
import { UiVersionPicker } from "../../picker";

// Generation v2 lands on the editable canvas. The picker stays in the
// header so a device can flip back to v1 at any time, the contract every
// generation's shelf carries.
export function TripsShelf() {
  return (
    <Block as="main" maxW="42rem" mx="auto" px="md" pt="lg" pb="2xl" flow="md">
      <Block grid cols="1fr auto" alignItems="baseline" gap="sm">
        <Title as="h1" fontSize="2xl">
          v2
        </Title>
        <UiVersionPicker />
      </Block>
      <Subtext as="p">Markers as you type: "- " bullets, "[] " checkboxes, "1. " numbers.</Subtext>
      <Canvas />
    </Block>
  );
}
