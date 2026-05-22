"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterTask, setFilterTask] = useState("");

  const [, setTick] = useState(0);

  // ✅ Time formatter
  function formatTime(ms: number) {
    if (!ms || ms < 0) ms = 0;

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  // ✅ Fetch tickets
  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select(`
        *,
        departments(name),
        tasks(name),
        operators(name)
      `)
      .order("created_at", { ascending: false });

    setTickets(data || []);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  
    useEffect(() => {
    const interval = setInterval(() => {
        setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
    }, []);


  // ✅ Dropdown options
  const departmentsList = Array.from(
    new Set(tickets.map((t) => t.departments?.name).filter(Boolean))
  );

  const tasksList = Array.from(
    new Set(tickets.map((t) => t.tasks?.name).filter(Boolean))
  );

  // ✅ Filtering logic
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      !search ||
      t.case_number?.toLowerCase().includes(search.toLowerCase());

    const matchesDept =
      !filterDept || t.departments?.name === filterDept;

    const matchesTask =
      !filterTask || t.tasks?.name === filterTask;

    return matchesSearch && matchesDept && matchesTask;
  });

  // ✅ UI
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">All Tickets</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {/* Search */}
        <input
          className="border p-2"
          placeholder="Search Case #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Department */}
        <select
          className="border p-2"
          value={filterDept}
          onChange={(e) => {
            setFilterDept(e.target.value);
            setFilterTask("");
          }}
        >
          <option value="">All Departments</option>
          {departmentsList.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        {/* Task */}
        <select
          className="border p-2"
          value={filterTask}
          onChange={(e) => setFilterTask(e.target.value)}
          disabled={!filterDept}
        >
          <option value="">All Tasks</option>
          {tasksList
            .filter(
              (t) =>
                !filterDept ||
                tickets.some(
                  (tk) =>
                    tk.tasks?.name === t &&
                    tk.departments?.name === filterDept
                )
            )
            .map((t) => (
              <option key={t}>{t}</option>
            ))}
        </select>
      </div>

      {/* Ticket list */}
      <div>
        {filteredTickets.map((t) => {
          const now = Date.now();

          // ✅ WORK TIME
          let workTime = t.total_time || 0;
          if (t.is_active && t.start_time) {
            workTime += now - new Date(t.start_time).getTime();
          }

          // ✅ ELAPSED TIME
          let elapsed = t.elapsed_time || 0;
          if (t.is_elapsed_active && t.elapsed_start_time) {
            elapsed +=
              now - new Date(t.elapsed_start_time).getTime();
          }

          // ✅ CREATED TIME
          const created = new Date(
            t.created_at || t.start_time || now
          ).toLocaleString();

          return (
            <div key={t.id} className="border p-4 mb-3 rounded">
              <p>
                <strong>Ticket #{t.id}</strong>
              </p>
              <p>Department: {t.departments?.name}</p>
              <p>Task: {t.tasks?.name}</p>
              <p>Operator: {t.operators?.name}</p>
              <p>Case #: {t.case_number}</p>

              <p>Created: {created}</p>
              <p>🛠 Work Time: {formatTime(workTime)}</p>
              <p>⏱ Elapsed Time: {formatTime(elapsed)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}