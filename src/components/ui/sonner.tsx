import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-card text-card-foreground border-border paper-shadow",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
