import React from "react";
import { Card } from "@/components/ui/card";

export default function SkeletonCard({ lines = 3 }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
          <div className="h-3 w-32 bg-secondary/60 rounded animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-secondary rounded animate-pulse" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full bg-secondary/60 rounded animate-pulse mb-2" />
      ))}
      <div className="h-px bg-border my-3" />
      <div className="flex gap-4">
        <div className="h-3 w-12 bg-secondary/60 rounded animate-pulse" />
        <div className="h-3 w-12 bg-secondary/60 rounded animate-pulse" />
        <div className="h-3 w-12 bg-secondary/60 rounded animate-pulse" />
      </div>
    </Card>
  );
}

export function SkeletonList({ count = 4, lines = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}