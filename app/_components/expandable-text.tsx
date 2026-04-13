"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ExpandableTextProps {
  text: string;
  maxLength?: number; // default 50
}

export function ExpandableText({ text, maxLength = 50 }: ExpandableTextProps) {
  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }

  const truncated = text.slice(0, maxLength) + "...";

  // Long text (>200 chars): use Popover (click to expand)
  if (text.length > 200) {
    return (
      <Popover>
        <PopoverTrigger className="cursor-pointer text-left underline decoration-dotted underline-offset-2">
          {truncated}
        </PopoverTrigger>
        <PopoverContent className="max-w-sm whitespace-pre-wrap">
          {text}
        </PopoverContent>
      </Popover>
    );
  }

  // Medium text (>maxLength, <=200 chars): use Tooltip (hover)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-default text-left underline decoration-dotted underline-offset-2">
          {truncated}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-sm whitespace-pre-wrap">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
