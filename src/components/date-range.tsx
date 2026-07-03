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
 * Two separate native date inputs («С» / «По», relabelled «Туда» / «Обратно» for
 * round-trip). «По» defaults to «С» and picking «С» duplicates into «По» (one entry
 * covers both), «По» can never precede «С» (min), and the calendar opens in one click.
 */
export function DateRange({
  defaultFrom = "",
  defaultTo = "",
  inputClassName = "",
  labelFrom = "Вылет с",
  labelTo = "По",
}: {
  defaultFrom?: string;
  defaultTo?: string;
  inputClassName?: string;
  labelFrom?: string;
  labelTo?: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo || defaultFrom);

  return (
    <>
      <label className={labelCls}>
        {labelFrom}
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
            setTo(v); // «С» duplicates into «По»; extend «По» afterwards for a range
          }}
        />
      </label>
      <label className={labelCls}>
        {labelTo}
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
