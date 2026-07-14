type ClassValue = string | false | null | undefined;

export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 font-body text-sm font-semibold leading-none transition-[transform,filter,background-color,border-color,color,box-shadow] duration-150 ease-out-snappy hover:brightness-110 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal disabled:pointer-events-none disabled:opacity-50";

export const button = {
  base: buttonBase,
  primary: `${buttonBase} bg-coin text-[#201800] shadow-[0_3px_0_var(--color-coin-deep)] active:translate-y-0.5 active:shadow-[0_1px_0_var(--color-coin-deep)]`,
  ghost: `${buttonBase} border-line-strong bg-transparent text-fog hover:border-[#4a4f8a] hover:text-moonlight`,
  danger: `${buttonBase} border-alert bg-transparent text-alert hover:bg-alert/10`,
  dangerSolid: `${buttonBase} border-alert bg-alert text-[#2a0a10] shadow-[0_3px_0_#c14257] active:translate-y-0.5 active:shadow-[0_1px_0_#c14257]`,
} as const;

export const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-midnight px-3 py-2 font-body text-[0.95rem] text-moonlight outline-none placeholder:text-fog/60 focus-visible:border-portal focus-visible:ring-2 focus-visible:ring-portal/35 disabled:cursor-not-allowed disabled:opacity-60";

export const labelClass = "mb-3 block min-w-0";
export const labelTextClass = "mb-1 block text-xs font-medium text-fog";
export const eyebrowClass =
  "mb-2 font-pixel text-[0.61rem] uppercase tracking-[0.06em] text-[#9299bb]";
export const mutedClass = "text-sm text-fog";
export const errorClass = "mt-2 text-sm text-alert";

export const modalBackdropClass =
  "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0a0b18cc] p-4 backdrop-blur-sm";
export const modalPanelClass =
  "w-full max-w-[560px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-line-strong bg-dusk p-6 shadow-[0_24px_60px_#0009]";
export const modalActionsClass =
  "mt-4 flex flex-wrap justify-end gap-2.5 max-[420px]:[&>*]:flex-1";

export const hudBaseClass = "absolute z-[5] flex items-center gap-2";
export const hudChipClass =
  "min-w-0 max-w-[min(32rem,calc(100vw-1.8rem))] rounded-lg border border-line bg-[#14162bd9] px-3 py-1.5 text-sm text-moonlight shadow-sm backdrop-blur-md";
