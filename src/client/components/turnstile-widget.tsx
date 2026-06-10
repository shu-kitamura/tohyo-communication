import { useEffect, useRef } from "react";

import { createRoomTurnstileAction } from "../../shared/api";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  remove(widgetId: string): void;
  render(
    container: HTMLElement,
    options: {
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
    },
  ): string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | undefined;

export function TurnstileWidget({
  onError,
  onToken,
  resetKey,
  siteKey,
}: {
  onError: () => void;
  onToken: (token: string) => void;
  resetKey: number;
  siteKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  const onTokenRef = useRef(onToken);

  onErrorRef.current = onError;
  onTokenRef.current = onToken;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let isCancelled = false;
    let widgetId: string | undefined;

    loadTurnstile()
      .then((turnstile) => {
        if (isCancelled) {
          return;
        }

        widgetId = turnstile.render(container, {
          action: createRoomTurnstileAction,
          callback: (token) => onTokenRef.current(token),
          "error-callback": () => {
            onTokenRef.current("");
            onErrorRef.current();
          },
          "expired-callback": () => onTokenRef.current(""),
          sitekey: siteKey,
        });
      })
      .catch(() => {
        if (!isCancelled) {
          onTokenRef.current("");
          onErrorRef.current();
        }
      });

    return () => {
      isCancelled = true;

      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [resetKey, siteKey]);

  return <div ref={containerRef} />;
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID);
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error("Turnstile API was not initialized."));
      }
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Turnstile.")), {
      once: true,
    });

    if (!existingScript) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.setAttribute("async", "");
      script.setAttribute("defer", "");
      script.setAttribute("src", TURNSTILE_SCRIPT_URL);
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
}
