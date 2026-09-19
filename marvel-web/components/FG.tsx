"use client";
// next/dynamic does not pass refs through, so the graph ref travels as a normal prop.
import ForceGraph2D, { type ForceGraphMethods, type ForceGraphProps } from "react-force-graph-2d";
import type { MutableRefObject } from "react";

export type FGRef = MutableRefObject<ForceGraphMethods | undefined>;

export default function FG({ fgRef, ...props }: ForceGraphProps & { fgRef: FGRef }) {
  return <ForceGraph2D ref={fgRef} {...props} />;
}
