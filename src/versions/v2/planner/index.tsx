import { Block, Link } from "atoms";
import { Subtext, Title } from "alloys";
import { UiVersionPicker } from "../../picker";

// The v2 planner does not exist yet. A device that flips to v2 while
// sitting on a trip URL still gets the picker and a way back to the
// shelf instead of a dead end.
export function Planner(props: { tripId: string }) {
  return (
    <Block as="main" maxW="42rem" mx="auto" px="md" pt="lg" flow="md">
      <Block grid cols="1fr auto" alignItems="baseline" gap="sm">
        <Title as="h1" fontSize="lg">
          {props.tripId}
        </Title>
        <UiVersionPicker />
      </Block>
      <Subtext as="p">The v2 planner is not built yet.</Subtext>
      <Link to="/">Back to trips</Link>
    </Block>
  );
}
