import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast vdj-toast",
          title: "vdj-toast-title",
          description: "vdj-toast-description",
          actionButton: "vdj-toast-action",
          cancelButton: "vdj-toast-cancel",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
