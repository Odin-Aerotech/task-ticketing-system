"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function Analytics() {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [filterDept, setFilterDept] = useState("");
    const [filterTask, setFilterTask] = useState("");

    const [tickets, setTickets] = useState<any[]>([]);

    const departmentsList = Array.from(
    new Set(tickets.map((t) => t.departments?.name).filter(Boolean))
    );

    const tasksList = Array.from(
    new Set(tickets.map((t) => t.tasks?.name).filter(Boolean))
    );

  // ✅ Fetch tickets
  const fetchTickets = async () => {
    const { data } = await supabase
        .from("tickets")
        .select(`
            *,
            departments(name),
            tasks(name),
            operators(name)
        `);

    setTickets(data || []);
  };

  // ✅ Load + realtime
  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel("analytics-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          fetchTickets(); // update chart live
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

    // Filter tickets by date
    const filteredTickets = tickets.filter((t) => {
    if (!t.end_time) return false;

    const time = new Date(t.end_time);

    if (startDate && time < new Date(startDate)) return false;

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // include full day
        if (time > end) return false;
    }

    return true;
    });

    // ✅ Count completed tickets per department
    const departmentCounts: Record<string, number> = {};

    filteredTickets.forEach((t) => {
    if (t.end_time && t.departments?.name) {
        const dept = t.departments.name;
        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    }
    });

  
    // ✅ Count completed tickets per assignee (case-insensitive)
    const assigneeCounts: Record<string, number> = {};

    const filteredForAssignee = filteredTickets.filter((t) => {
    const matchesDept =
        !filterDept || t.departments?.name === filterDept;

    const matchesTask =
        !filterTask || t.tasks?.name === filterTask;

    return matchesDept && matchesTask;
    });

    // ✅ THIS WAS MISSING
    filteredForAssignee.forEach((t) => {
    if (t.end_time && t.operators?.name) {
        const name = t.operators.name;

        assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
    }
    });
    
    const assigneeData = Object.entries(assigneeCounts)
    .map(([name, count]) => ({
        name,
        count,
    }))
    .sort((a, b) => b.count - a.count);

    const chartData = Object.entries(departmentCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count); // ✅ sort biggest first

  return (
    <div className="p-6">
    <h1 className="text-2xl font-bold mb-6">
        Completed Tickets by Department
      </h1>

      <div className="mb-6 flex gap-4">
        <div>
            <label className="block text-sm">Start Date</label>
            <input
            type="date"
            className="border p-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            />
        </div>

        <div>
            <label className="block text-sm">End Date</label>
            <input
            type="date"
            className="border p-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            />
        </div>
    </div>

      {/* By Department data */}
      <div className="bg-white p-4 rounded shadow">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
        <h2 className="text-xl font-bold mt-8 mb-4">
        Completed Tickets by Assignee
        </h2>

        <div className="flex gap-4 mb-4">
        {/* Department Filter */}
        <select
            className="border p-2"
            value={filterDept}
            onChange={(e) => {
            setFilterDept(e.target.value);
            setFilterTask(""); // reset task when dept changes
            }}
        >
            <option value="">All Departments</option>
            {departmentsList.map((d) => (
            <option key={d} value={d}>
                {d}
            </option>
            ))}
        </select>

        {/* Task Filter */}
        <select
            className="border p-2"
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            disabled={!filterDept}
        >
            <option value="">All Tasks</option>
            {tasksList
            .filter((t) => {
                if (!filterDept) return true;
                return tickets.some(
                (tk) =>
                    tk.tasks?.name === t &&
                    tk.departments?.name === filterDept
                );
            })
            .map((t) => (
                <option key={t} value={t}>
                {t}
                </option>
            ))}
        </select>
        </div>

        <div className="bg-white p-4 rounded shadow">
        <ResponsiveContainer width="100%" height={400}>
            <BarChart data={assigneeData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" />
            </BarChart>
        </ResponsiveContainer>
        </div>


      {/* Total Completed */}
      <p className="mt-4 font-semibold">
        Total Completed:{" "}
        {filteredTickets.length}
      </p>
    </div>
  );
}