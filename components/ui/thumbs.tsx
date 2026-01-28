import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "./button";
import { useState } from "react";

export function Thumbs({ onUp, onDown }: { onUp?: () => void; onDown?: () => void }) {
  const [up, setUp] = useState(false);
  const [down, setDown] = useState(false);

  return (
    <div className="flex gap-2 items-center">
      <Button
        variant={up ? "default" : "outline"}
        size="icon-sm"
        aria-label="Thumb up"
        onClick={() => {
          setUp(!up);
          setDown(false);
          onUp?.();
        }}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant={down ? "destructive" : "outline"}
        size="icon-sm"
        aria-label="Thumb down"
        onClick={() => {
          setDown(!down);
          setUp(false);
          onDown?.();
        }}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
