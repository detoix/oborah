"use client";

import { CatalogView } from "@oborah/catalog";

interface DesktopSidebarProps {
  setIsCatalogDragging: (isDragging: boolean) => void;
}

export function DesktopSidebar({ setIsCatalogDragging }: DesktopSidebarProps) {
  return (
    <CatalogView
      onItemDragStart={() => setIsCatalogDragging(true)}
      onItemDragEnd={() => setIsCatalogDragging(false)}
    />
  );
}
