"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

/** Stores the browser's time zone in a cookie and re-renders once if the server guessed a different one. */
export function TimeZoneSync({ current }: { current: string | undefined }) {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || zone === current) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${zone}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [current, router]);
  return null;
}
