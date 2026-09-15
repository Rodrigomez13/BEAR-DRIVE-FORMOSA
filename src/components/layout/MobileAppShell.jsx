import React from 'react';
import BottomNav from '@/components/bear/BottomNav';
import AnimatedOutlet from '@/components/bear/AnimatedOutlet';

export default function MobileAppShell({ items, basePath }) {
  return <div className="mobile-app-shell bg-background">
    <main className="mobile-app-main relative">
      <AnimatedOutlet />
    </main>
    <BottomNav items={items} basePath={basePath} />
  </div>;
}
