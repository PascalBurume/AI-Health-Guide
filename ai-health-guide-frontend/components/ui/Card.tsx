import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = ({ className, ...props }: CardProps) => (
  <div
    className={cn(
      "rounded-2xl border border-gray-200 bg-white shadow-sm",
      className
    )}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }: CardHeaderProps) => (
  <div
    className={cn("border-b border-gray-100 px-6 py-4", className)}
    {...props}
  />
);

export const CardBody = ({ className, ...props }: CardBodyProps) => (
  <div className={cn("px-6 py-4", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: CardFooterProps) => (
  <div
    className={cn("border-t border-gray-100 px-6 py-4", className)}
    {...props}
  />
);
