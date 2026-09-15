"use client";

import type { ComponentType } from "react";

import { useSea } from "@/lib/store";
import { Anglerfish } from "./Anglerfish";
import { Atolla } from "./Atolla";
import { CombJelly } from "./CombJelly";
import { Amphipods, DumboOctopus, Snailfish } from "./Dark";
import { FireflySquid } from "./FireflySquid";
import { Loosejaw } from "./Loosejaw";
import { Siphonophore } from "./Siphonophore";
import { VampireSquid } from "./VampireSquid";

// The backend decides which animals live in the sea and at what depth; each
// one it knows about that has a body here is placed at its home depth. Sea
// sparkle has no body of its own: it's the plankton everywhere.
const BODIES: Record<string, ComponentType<{ depth: number }>> = {
  "firefly-squid": FireflySquid,
  "comb-jelly": CombJelly,
  "vampire-squid": VampireSquid,
  siphonophore: Siphonophore,
  atolla: Atolla,
  "stoplight-loosejaw": Loosejaw,
  anglerfish: Anglerfish,
  "dumbo-octopus": DumboOctopus,
  snailfish: Snailfish,
  amphipod: Amphipods,
};

export function Creatures() {
  const creatures = useSea((s) => s.creatures);
  return (
    <>
      {creatures.map((creature) => {
        const Body = BODIES[creature.slug];
        return Body ? <Body key={creature.slug} depth={creature.home} /> : null;
      })}
    </>
  );
}
