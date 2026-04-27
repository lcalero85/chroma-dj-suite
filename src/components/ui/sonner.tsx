import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      offset={72}
      expand={false}
      richColors
      toastOptions={{
        style: {
          maxWidth: 360,
        },
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
