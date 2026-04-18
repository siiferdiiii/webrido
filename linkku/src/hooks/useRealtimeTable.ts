"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  /** Table name to subscribe to */
  table: string;
  /** Schema (default: "public") */
  schema?: string;
  /** Event types to listen for (default: "*" = all) */
  event?: PostgresChangeEvent;
  /** Callback when any change occurs — typically used to refetch data */
  onUpdate: () => void;
  /** Whether the subscription is active (default: true) */
  enabled?: boolean;
}

/**
 * Custom hook to subscribe to Supabase Realtime changes on a table.
 *
 * Usage:
 * ```tsx
 * useRealtimeTable({
 *   table: "transactions",
 *   onUpdate: () => fetchTransactions(),
 * });
 * ```
 */
export function useRealtimeTable({
  table,
  schema = "public",
  event = "*",
  onUpdate,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep callback ref fresh without re-subscribing
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) return;

    // Don't subscribe if Supabase is not configured
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || key.startsWith("BELUM_DIISI")) return;

    const channelName = `realtime-${schema}-${table}-${event}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event,
          schema,
          table,
        },
        (_payload) => {
          // When a change is detected, call the update handler.
          // We don't use the payload directly — instead we refetch
          // the full list to keep things simple and consistent with
          // existing pagination/filter state.
          onUpdateRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, schema, event, enabled]);
}

/**
 * Subscribe to multiple tables at once.
 *
 * Usage:
 * ```tsx
 * useRealtimeTables({
 *   tables: ["transactions", "users", "stock_accounts"],
 *   onUpdate: () => refetchAll(),
 * });
 * ```
 */
export function useRealtimeTables({
  tables,
  schema = "public",
  event = "*",
  onUpdate,
  enabled = true,
}: {
  tables: string[];
  schema?: string;
  event?: PostgresChangeEvent;
  onUpdate: () => void;
  enabled?: boolean;
}) {
  const onUpdateRef = useRef(onUpdate);
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || key.startsWith("BELUM_DIISI")) return;

    const channels: RealtimeChannel[] = [];

    for (const table of tables) {
      const channel = supabase
        .channel(`realtime-multi-${table}`)
        .on(
          "postgres_changes",
          { event, schema, table },
          () => onUpdateRef.current()
        )
        .subscribe();
      channels.push(channel);
    }

    channelsRef.current = channels;

    return () => {
      for (const ch of channelsRef.current) {
        supabase.removeChannel(ch);
      }
      channelsRef.current = [];
    };
  }, [tables.join(","), schema, event, enabled]);
}
