"use client";

import { useState } from "react";

const labelCls = "flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted";

/** Open the native calendar on the first click instead of making the user click twice. */
function openPicker(e: React.SyntheticEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker();
  } catch {
    // showPicker unsupported or not user-activated — the input still works normally
  }
}

/**
 * Coupled «Вылет с / По» native date inputs used in every search form.
 * «По» defaults to «С» (one date pick covers both) and picking «С» keeps duplicating
 * into «По»; «По» can then be pushed later for a range and can never precede «С» (min).
 * The native calendar (month → day) opens on a single click. No library.
 */
export function DateRange({
  defaultFrom = "",
  defaultTo = "",
  inputClassName = "",
}: {
  defaultFrom?: string;
  defaultTo?: string;
  inputClassName?: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo || defaultFrom);

  return (
    <>
      <label className={labelCls}>
        Вылет с
        <input
          type="date"
          name="from"
          value={from}
          className={inputClassName}
          onFocus={openPicker}
          onClick={openPicker}
          onChange={(e) => {
            const v = e.target.value;
            setFrom(v);
            setTo(v); // «С» duplicates straight into «По»; extend «По» afterwards for a range
          }}
        />
      </label>
      <label className={labelCls}>
        По
        <input
          type="date"
          name="to"
          value={to}
          min={from || undefined}
          className={inputClassName}
          onFocus={openPicker}
          onClick={openPicker}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
    </>
  );
}
