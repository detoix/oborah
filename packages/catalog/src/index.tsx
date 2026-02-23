"use client";

import React from "react";
import { Box, Cuboid, Triangle } from "lucide-react"; // Sample icons

export type CatalogItem = {
  id: string;
  name: string;
  type: "glb" | "procedural";
  icon: React.ReactNode;
};

const SAMPLE_ITEMS: CatalogItem[] = [
  {
    id: "1",
    name: "Building A",
    type: "glb",
    icon: <Box className="w-4 h-4" />,
  },
  {
    id: "2",
    name: "Custom Roof",
    type: "procedural",
    icon: <Triangle className="w-4 h-4" />,
  },
  {
    id: "3",
    name: "Extruded Wall",
    type: "procedural",
    icon: <Cuboid className="w-4 h-4" />,
  },
];

export function CatalogView() {
  return (
    <div className="w-64 border-r border-border bg-background p-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Catalog</h2>
      <div className="flex flex-col gap-2">
        {SAMPLE_ITEMS.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/json", JSON.stringify(item));
            }}
            className="flex items-center gap-3 p-3 text-sm font-medium border border-border rounded-md hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
          >
            {item.icon}
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
}
