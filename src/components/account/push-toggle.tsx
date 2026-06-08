"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type PermissionState =
  | "unsupported" // browser doesn't support Notification or Push APIs
  | "vapid-missing" // server-side keys not configured
  | "default" // permission not yet decided by user
  | "granted-subscribed"
  | "granted-not-subscribed" // permission yes, but no active sub on this device
  | "denied"; // user blocked notifications

/**
 * Browser Web Push opt-in. Three layers of state:
 *   1. Notification.permission ('default' | 'granted' | 'denied')
 *   2. Whether the SW has a subscription for this device
 *   3. Whether our server knows about it
 *
 * We POST the subscription on enable and DELETE on disable, so the cron
 * stops sending to revoked devices without waiting for 410s.
 */
export function PushToggle() {
  const [state, setState] = useState<PermissionState>("default");
  const [pending, setPending] = useState(false);

  // Detect current permission + subscription state on mount. Inlined
  // in the effect (not a separate function) so the react-hooks
  // immutability rule is happy.
  useEffect(() => {
    async function detect() {
      if (typeof window === "undefined") return;
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setState("unsupported");
        return;
      }
      if (!VAPID_PUBLIC) {
        setState("vapid-missing");
        return;
      }
      const perm = Notification.permission;
      if (perm === "denied") {
        setState("denied");
        return;
      }
      if (perm === "default") {
        setState("default");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "granted-subscribed" : "granted-not-subscribed");
      } catch {
        setState("granted-not-subscribed");
      }
    }
    void detect();
  }, []);

  async function enable() {
    if (typeof window === "undefined" || !VAPID_PUBLIC) return;
    setPending(true);
    try {
      // Request permission if needed.
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        toast.error("Tu navegador bloqueó las notificaciones.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      // Already subscribed? Reuse.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
      }

      const subJson = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const res = await fetch("/api/account/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });
      if (!res.ok) {
        toast.error("No pudimos registrar tu suscripción en el servidor.");
        return;
      }
      setState("granted-subscribed");
      toast.success("Notificaciones activadas en este dispositivo.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No pudimos activar las notificaciones.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/account/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("granted-not-subscribed");
      toast.success("Notificaciones desactivadas en este dispositivo.");
    } finally {
      setPending(false);
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Tu navegador no soporta notificaciones push. En iOS necesitás tener la
        app instalada en pantalla de inicio (iOS 16.4+).
      </p>
    );
  }
  if (state === "vapid-missing") {
    return (
      <p className="text-xs text-amber-400">
        Falta configurar VAPID keys. Setear{" "}
        <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> y{" "}
        <code>VAPID_PRIVATE_KEY</code> en Vercel.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="text-xs text-amber-400">
        Bloqueaste las notificaciones en este navegador. Cambialo en la
        configuración del sitio del navegador y recargá.
      </p>
    );
  }
  if (state === "granted-subscribed") {
    return (
      <Button variant="outline" size="sm" onClick={disable} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <BellOff />}
        Desactivar en este dispositivo
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={enable} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Bell />}
      Activar en este dispositivo
    </Button>
  );
}

/**
 * VAPID public keys come URL-safe base64 encoded. PushManager.subscribe
 * needs a BufferSource. We allocate an ArrayBuffer up front (rather than
 * letting Uint8Array pick its own ArrayBufferLike) so the resulting view
 * satisfies the strict BufferSource type expected by the DOM lib types.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}
