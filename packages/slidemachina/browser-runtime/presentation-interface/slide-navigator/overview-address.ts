import { useEffect, useState } from "react";
import { describeAddressWithParameter } from "../../presentation-core/page-address.ts";

const overviewParameter = "overview";

// /talk/?overview opens on the navigator, the showcase of every slide; opening and closing it keeps the address in step.
export function useOverviewAddress() {
  const [isNavigatorOpen, setNavigatorOpen] = useState(() => new URLSearchParams(location.search).has(overviewParameter));
  useEffect(() => {
    history.replaceState(history.state, "", describeAddressWithParameter(overviewParameter, isNavigatorOpen ? "" : undefined));
  }, [isNavigatorOpen]);
  return [isNavigatorOpen, setNavigatorOpen] as const;
}
