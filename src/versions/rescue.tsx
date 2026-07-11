import * as React from "react";
import { Block } from "atoms";
import { Subtext, Title } from "alloys";
import { UiVersionPicker } from "./picker";

// The way out of a broken UI generation. Each generation renders its own
// picker in normal use, but that picker lives INSIDE the lazy screen: if
// a generation's chunk fails to load or its screen throws on render, the
// generation can never offer the exit itself. This boundary sits in the
// version-neutral route shell, catches the crash, and hands the device a
// working picker.
type RescueProps = { children: React.ReactNode };
type Crash = { error: Error | null };

export class UiVersionRescue extends React.Component<RescueProps, Crash> {
  state: Crash = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[versions] the active UI generation crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Block as="main" maxW="42rem" mx="auto" px="md" pt="lg" flow="md">
        <Title as="h1" fontSize="lg">
          This UI generation crashed
        </Title>
        <Subtext as="p">{String(this.state.error)}</Subtext>
        <Block>
          <UiVersionPicker />
        </Block>
      </Block>
    );
  }
}
