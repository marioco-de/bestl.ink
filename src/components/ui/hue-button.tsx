import { Button, type ButtonProps } from "@/components/ui/button";
import { hueStyle } from "@/lib/docbay/palette";
import { cn } from "@/lib/utils";

export function HueButton({
  hue,
  className,
  style,
  ...props
}: ButtonProps & { hue: string }) {
  return (
    <Button
      className={cn("hue-action", className)}
      style={{ ...hueStyle(hue), ...style }}
      {...props}
    />
  );
}
