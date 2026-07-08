import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Block, Input } from "atoms";
import { ErrorNote, PrimaryButton, Subtext, Title } from "alloys";

// The site's front door: an allowed email plus the shared password. The
// failure line stays identical for an unknown email and a wrong password,
// so the form never confirms which emails exist.

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [email, storeEmail] = React.useState("");
  const [password, storePassword] = React.useState("");
  const [phase, storePhase] = React.useState<"idle" | "checking" | "failed">("idle");

  const enter = async () => {
    storePhase("checking");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        storePhase("failed");
        return;
      }
      navigate({ to: "/" });
    } catch (error) {
      console.warn("[door] login request failed:", error);
      storePhase("failed");
    }
  };

  return (
    <Block grid h="100svh" placeItems="center" px="md" bg="surface-page">
      <Block
        as="form"
        grid
        gap="sm"
        w="100%"
        maxW="20rem"
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          enter();
        }}
      >
        <Title as="h1" fontSize="2xl">
          travel
        </Title>
        <Subtext as="p" mb="xs">
          Sign in to open the planner.
        </Subtext>
        <Input
          type="email"
          value={email}
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          onChange={(event) => storeEmail(event.currentTarget.value)}
        />
        <Input
          type="password"
          value={password}
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          onChange={(event) => storePassword(event.currentTarget.value)}
        />
        {/* onPress covers clicks and taps (react-aria buttons re-route
            native clicks through press events); the form's onSubmit covers
            the Enter key from either field. Sized up to the fields' own
            type and height so the trio reads as one unit. */}
        <PrimaryButton
          type="submit"
          onPress={enter}
          isLoading={phase === "checking"}
          mt="xs"
          fontSize="md"
          paddingBlock="0.75rem"
        >
          Enter
        </PrimaryButton>
        {phase === "failed" ? <ErrorNote>That didn't match. Try again.</ErrorNote> : null}
      </Block>
    </Block>
  );
}
