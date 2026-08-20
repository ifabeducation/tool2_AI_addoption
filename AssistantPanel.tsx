"use client";

import { ReactNode, useState } from "react";
import { PanelRightClose, Sparkles } from "lucide-react";

/**
 * Pannello laterale fisso che ospita l'assistente AI accanto ai form.
 * Da lg in su resta agganciato al bordo destro per tutta l'altezza dello
 * schermo (la pagina riserva lo spazio corrispondente); sotto lg si apre come
 * sovrapposizione dal pulsante flottante, per non rubare spazio al form.
 */
export default function AssistantPanel({
  title = "Assistente AI",
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  // Sovrapposizione su mobile (chiusa di default) e riduzione a icona su desktop.
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function open() {
    setOpenOnMobile(true);
    setCollapsed(false);
  }

  function close() {
    setOpenOnMobile(false);
    setCollapsed(true);
  }

  return (
    <>
      {openOnMobile && (
        <div
          onClick={close}
          className="fixed inset-0 z-30 bg-ifab-navy/30 lg:hidden"
          aria-hidden
        />
      )}

      {/* data-assistant: la pagina usa :has() per riservare lo spazio a destra
          solo quando il pannello è effettivamente aperto. */}
      <aside
        data-assistant={collapsed ? "closed" : "open"}
        className={`fixed inset-y-0 right-0 z-40 w-full max-w-md flex-col border-l border-ifab-border bg-white shadow-xl lg:w-[380px] lg:max-w-none lg:shadow-none ${
          openOnMobile ? "flex" : "hidden"
        } ${collapsed ? "lg:hidden" : "lg:flex"}`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-ifab-border px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ifab-navy">
              <Sparkles size={15} className="text-ifab-blue" /> {title}
            </p>
            {subtitle && <p className="mt-0.5 text-xs text-ifab-text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            title="Nascondi assistente"
            className="rounded-lg p-1.5 text-ifab-text-muted transition hover:bg-ifab-bg-soft hover:text-ifab-navy"
          >
            <PanelRightClose size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>

      <button
        type="button"
        onClick={open}
        className={`fixed bottom-5 right-5 z-30 items-center gap-2 rounded-full bg-ifab-blue px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-ifab-blue-dark ${
          openOnMobile ? "hidden" : "flex"
        } ${collapsed ? "lg:flex" : "lg:hidden"}`}
      >
        <Sparkles size={16} /> {title}
      </button>
    </>
  );
}
