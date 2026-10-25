"use client";

// «أرِني» from outside the help panel (an item of «الخطوات الأولى», a button
// on an empty page): asks the help engine (HelpUI) to run one question's
// tour. On another page it goes there first and starts on arrival. When the
// tour ends, the focus goes back to the button that asked (when it is still
// on the page), not to «؟».

export type TourRequest = { page: string; question: string; from?: HTMLElement | null };

const EVENT = "guide:tour";

export function requestTour(request: TourRequest) {
  window.dispatchEvent(new CustomEvent<TourRequest>(EVENT, { detail: request }));
}

export function onTourRequest(handler: (request: TourRequest) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<TourRequest>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
