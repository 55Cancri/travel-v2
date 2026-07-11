import { Block } from "atoms";
import { Subtext, Title } from "alloys";
import { UiVersionPicker } from "../../picker";

// Generation v2 starts as a bare canvas: nothing here is designed yet.
// The picker stays in the header so a device can flip back to v1 at any
// time, the contract every generation's shelf carries.
export function TripsShelf() {
  return (
    <Block as="main" maxW="42rem" mx="auto" px="md" pt="lg" flow="md">
      <Block grid cols="1fr auto" alignItems="baseline" gap="sm">
        <Title as="h1" fontSize="2xl">
          v2
        </Title>
        <UiVersionPicker />
      </Block>
      <Subtext as="p">A blank canvas. The next generation of the planner starts here.</Subtext>
    </Block>
  );
}
