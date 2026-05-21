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
  const [tickets, setTickets] = useState<any[]>([]);

  // ✅ Fetch tickets
  const fetchTickets = async () => {
    const { data } = await supabase
      .from("tickets")
      .select("*");

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

  // ✅ Count completed tickets per department
  const departmentCounts: Record<string, number> = {};

  tickets.forEach((t) => {
    if (t.end_time) {
      const dept = t.task_name;
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    }
  });

  
    // ✅ Count completed tickets per assignee (case-insensitive)
    const assigneeCounts: Record<string, number> = {};

    tickets.forEach((t) => {
    if (t.end_time && t.assigned_to) {
        const name = t.assigned_to.trim().toLowerCase();

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
        {chartData.reduce((sum, d) => sum + d.count, 0)}
      </p>
    </div>
  );
}