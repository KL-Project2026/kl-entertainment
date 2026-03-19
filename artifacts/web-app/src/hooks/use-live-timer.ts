import { useState, useEffect } from "react";
import { differenceInSeconds } from "date-fns";

export function useLiveTimer(startTime?: string | null) {
  const [duration, setDuration] = useState<string>("--:--:--");

  useEffect(() => {
    if (!startTime) {
      setDuration("--:--:--");
      return;
    }

    const start = new Date(startTime);
    
    const updateTimer = () => {
      const diff = Math.max(0, differenceInSeconds(new Date(), start));
      const hours = Math.floor(diff / 3600).toString().padStart(2, "0");
      const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, "0");
      const seconds = (diff % 60).toString().padStart(2, "0");
      setDuration(`${hours}:${minutes}:${seconds}`);
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);

  return duration;
}
