"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ✅ Proper time formatter (MM:SS)
function formatTime(ms: number) {
  if (!ms || ms < 0) ms = 0;

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export default function Home() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [taskName, setTaskName] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [tick, setTick] = useState(0); // ✅ for live timer

  // ✅ Fetch tickets
  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("*")
      .order("id", { ascending: false });

    setTickets(data || []);
  };

  // Real-time updating
  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel("tickets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          console.log("Realtime event:", payload);
          fetchTickets();
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  // Update Every Second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ✅ Create ticket
  const createTicket = async () => {
    await supabase.from("tickets").insert([
      {
        task_name: taskName,
        assigned_to: assignedTo,
      },
    ]);

    setTaskName("");
    setAssignedTo("");
    fetchTickets();
  };

  // ✅ CLOCK TOGGLE
  const toggleClock = async (ticket: any) => {
    if (!ticket.start_time) {
      // clock in (first time)
      await supabase
        .from("tickets")
        .update({
          start_time: new Date(),
          is_active: true,
        })
        .eq("id", ticket.id);

    } else if (ticket.is_active) {
      // clock OUT (save time)
      const now = new Date();
      const start = new Date(ticket.start_time);

      const worked = now.getTime() - start.getTime();

      await supabase
        .from("tickets")
        .update({
          is_active: false,
          total_time: (ticket.total_time || 0) + worked,
          start_time: null,
        })
        .eq("id", ticket.id);

    } else {
      // resume work
      await supabase
        .from("tickets")
        .update({
          start_time: new Date(),
          is_active: true,
        })
        .eq("id", ticket.id);
    }

    fetchTickets();
  };

  // ✅ FINISH TASK
  const finishTicket = async (ticket: any) => {
    let total = ticket.total_time || 0;

    if (ticket.is_active && ticket.start_time) {
      const now = new Date();
      const start = new Date(ticket.start_time);
      total += now.getTime() - start.getTime();
    }

    await supabase
      .from("tickets")
      .update({
        end_time: new Date(),
        is_active: false,
        total_time: total,
      })
      .eq("id", ticket.id);

    fetchTickets();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Ticket System</h1>

      {/* Create Ticket */}
      <div className="mb-6">
        <input
          className="border p-2 mr-2"
          placeholder="Task Name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />

        <input
          className="border p-2 mr-2"
          placeholder="Assigned To"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        />

        <button
          className="bg-blue-500 text-white px-4 py-2"
          onClick={createTicket}
        >
          Create Ticket
        </button>
      </div>

      {/* Ticket List */}
      <div>
        {tickets.map((t) => {
          const now = Date.now();

          const start = t.start_time ? new Date(t.start_time).getTime() : null;
          const end = t.end_time ? new Date(t.end_time).getTime() : null;

          // ✅ ELAPSED TIME (since creation)
          const created = new Date(
            t.created_at || t.start_time || now
          ).getTime();

          const elapsed = Math.max(
            0,
            t.end_time
              ? new Date(t.end_time).getTime() - created
              : now - created
          );

          // ✅ WORK TIME (saved + active session)
          let workTime = t.total_time || 0;

          if (t.is_active && start) {
            workTime += now - start;
          }

          return (
            <div key={t.id} className="border p-4 mb-3">
              <p><strong>Ticket #{t.id}</strong></p>
              <p>Task: {t.task_name}</p>
              <p>Assigned: {t.assigned_to}</p>

              <p>
                Status:{" "}
                {end
                  ? "✅ Completed"
                  : t.is_active
                  ? "🟢 Working"
                  : start
                  ? "🟡 Paused"
                  : "⚪ Not Started"}
              </p>

              <p>
                Created: {new Date(created).toLocaleString()}
              </p>

              {start && (
                <p>Started: {new Date(start).toLocaleString()}</p>
              )}
              {end && (
                <p>Completed: {new Date(end).toLocaleString()}</p>
              )}

              <p>🛠 Work Time: {formatTime(workTime)}</p>
              <p>⏱ Elapsed Time: {formatTime(elapsed)}</p>

              {/* Clock Button */}
              {!end && (
                <button
                  className="mt-2 bg-green-500 text-white px-3 py-1 mr-2"
                  onClick={() => toggleClock(t)}
                >
                  {!start
                    ? "Clock In"
                    : t.is_active
                    ? "Clock Out"
                    : "Resume"}
                </button>
              )}

              {/* Finish Button */}
              {!end && (
                <button
                  className="mt-2 bg-red-500 text-white px-3 py-1"
                  onClick={() => finishTicket(t)}
                >
                  Finish Ticket
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
