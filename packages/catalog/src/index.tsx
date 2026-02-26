"use client";

import React from "react";
import { Box, Cuboid, Triangle } from "lucide-react"; // Sample icons

export type CatalogItem = {
  id: string;
  name: string;
  type: "glb" | "procedural";
  icon: React.ReactNode;
  visualConfig?: {
    args: [number, number, number];
    color: string;
    soilColor?: string;
    opacity?: number;
    transparent?: boolean;
    modelUrl?: string;
  };
};

export type CatalogItemId = CatalogItem["id"];
export type CatalogItemKind = CatalogItem["type"];

export const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: "raised-bed",
    name: "Raised Bed",
    type: "procedural",
    icon: <Box className="w-4 h-4" />,
    visualConfig: {
      args: [6, 1.5, 3],
      color: "#795548", // Wood Brown
      soilColor: "#3E2723", // Dark Soil
    },
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    type: "glb",
    icon: <Triangle className="w-4 h-4" />,
    visualConfig: {
      args: [8, 10, 12],
      color: "#B2DFDB", // Glassy Teal
      opacity: 0.6,
      transparent: true,
    },
  },
  {
    id: "planter-box",
    name: "Planter Box",
    type: "procedural",
    icon: <Cuboid className="w-4 h-4" />,
    visualConfig: {
      args: [2, 2, 2],
      color: "#8D6E63",
      soilColor: "#3E2723",
    },
  },
  {
    id: "compost-bin",
    name: "Compost Bin",
    type: "glb",
    icon: <Box className="w-4 h-4" />,
    visualConfig: {
      args: [3, 4, 3],
      color: "#424242", // Dark Grey
      modelUrl:
        "https://pub-e9b147ce12714178ac88c0aefdf3b47f.r2.dev/3d_models/Untitled.glb",
    },
  },
];

export interface CatalogViewProps {
  onItemDragStart?: (item: CatalogItem) => void;
  onItemDragEnd?: (item: CatalogItem) => void;
}

export function CatalogView({
  onItemDragStart,
  onItemDragEnd,
}: CatalogViewProps = {}) {
  return (
    <div className="w-64 border-r border-border bg-background p-4 flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Catalog</h2>
      <div className="flex flex-col gap-2">
        {CATALOG_ITEMS.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData(
                "application/oborah-item",
                JSON.stringify(item),
              );
              // Fallback for browsers/UIs that ignore custom MIME-only payloads.
              e.dataTransfer.setData("text/plain", JSON.stringify(item));
              onItemDragStart?.(item);
            }}
            onDragEnd={() => {
              onItemDragEnd?.(item);
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
