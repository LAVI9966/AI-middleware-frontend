import React, { useEffect } from "react";

const Modal = ({ MODAL_ID, children, onClose }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const onCloseRef = React.useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const modalElement = document.getElementById(MODAL_ID);
    if (!modalElement) return;

    const handleDialogClose = () => {
      setIsOpen(false);
      if (typeof onCloseRef.current === "function") {
        onCloseRef.current();
      }
    };

    if (modalElement.hasAttribute("open")) {
      setIsOpen(true);
    }
    const observer = new MutationObserver(() => {
      if (modalElement.hasAttribute("open")) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    });
    observer.observe(modalElement, { attributes: true, attributeFilter: ["open"] });
    modalElement.addEventListener("close", handleDialogClose);

    return () => {
      observer.disconnect();
      modalElement.removeEventListener("close", handleDialogClose);
    };
  }, [MODAL_ID]);

  return (
    <dialog
      data-testid={MODAL_ID}
      id={MODAL_ID}
      className="modal"
      style={{ pointerEvents: isOpen ? undefined : "none" }}
    >
      {isOpen ? children : null}
    </dialog>
  );
};

export default Modal;
