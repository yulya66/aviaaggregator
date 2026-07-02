"use client";

import { useState } from "react";

const labelCls = "flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted";

/**
 * Coupled «Вылет с / По» native date inputs used in every search form.
 * Picking «С» duplicates the date straight into «По» (one entry covers both);
 * «По» can then be pushed later for a range and can never precede «С» (min).
 * Native pickers, no library.
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
  const [to, setTo] = useState(defaultTo);

  return (
    <>
      <label className={labelCls}>
        Вылет с
        <input
          type="date"
          name="from"
          value={from}
          className={inputClassName}
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
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
    </>
  );
}
