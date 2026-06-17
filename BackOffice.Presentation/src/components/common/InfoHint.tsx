import React from "react";

interface InfoHintProps {
  text: string;
  label?: string;
  className?: string;
}

const InfoHint: React.FC<InfoHintProps> = ({ text, label = "Info", className = "" }) => {
  return (
    <span
      className={`inline-flex shrink-0 align-middle items-center justify-center w-4 h-4 rounded-full border border-sidebar-text-muted/50 text-[10px] leading-none text-sidebar-text-muted ${className}`.trim()}
      title={text}
      aria-label={label}
    >
      ?
    </span>
  );
};

export default InfoHint;
