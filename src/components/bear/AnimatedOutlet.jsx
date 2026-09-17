import { Outlet } from "react-router-dom";

// Tab and account navigation is immediate. Keeping an exiting route mounted
// while the router context changes caused stale content and a blank fade.
export default function AnimatedOutlet() {
  return <div className="absolute inset-0 min-w-0"><Outlet /></div>;
}
