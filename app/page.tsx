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
  const [departments, setDepartments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);

  const [selectedDept, setSelectedDept] = useState<number | "">("");
  const [selectedTask, setSelectedTask] = useState<number | "">("");
  const [selectedOperator, setSelectedOperator] = useState<number | "">("");
  const [caseNumber, setCaseNumber] = useState("");
  const [comments, setComments] = useState("");

  const [, setTick] = useState(0); // ✅ for live timer

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTasks, setEditTasks] = useState<any[]>([]);
  const [editOperators, setEditOperators] = useState<any[]>([]);

  const [filterDept, setFilterDept] = useState<number | "">("");
  const [filterOperator, setFilterOperator] = useState<number | "">("");
  const [allOperators, setAllOperators] = useState<any[]>([]);


  // Fetch Department
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.from("departments").select("*");
      setDepartments(data || []);
    };

    fetchDepartments();
  }, []);


  // Fetch tasks and operators
  useEffect(() => {
    if (!selectedDept) {
      setTasks([]);
      setOperators([]);
      return;
    }


    const fetchData = async () => {
      // ✅ tasks
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("department_id", selectedDept);

      // ✅ operators via join table
      const { data: operatorData } = await supabase
        .from("department_operators")
        .select(`
          operator_id,
          operators!department_operators_operator_id_fkey (id, name)
        `)
        .eq("department_id", selectedDept);

      setOperators(
        (operatorData || [])
          .map((o) => o.operators)
      );


      
      console.log("Selected Dept:", selectedDept);
      console.log("Tasks returned:", taskData);
      console.log("Operators returned:", operatorData);


      setTasks(
        (taskData || []).sort((a, b) => {
          const num = (s: string) => parseInt(s.replace(/\D/g, "")) || 0;
          return num(a.name) - num(b.name);
        })
      );
      setOperators(operatorData?.map((o) => o.operators) || []);
    };
    fetchData();
  }, [selectedDept]);



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
      .order("id", { ascending: false })
      .is("end_time", null);

    setTickets(data || []);
  };


  // Get all operators
  useEffect(() => {
    const fetchAllOperators = async () => {
      const { data } = await supabase
        .from("operators")
        .select("*");

      setAllOperators(data || []);
    };

    fetchAllOperators();
  }, []);


  // Real-time updating new tasks being created
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

  // Update tickets after edit
  const updateTicket = async (ticket: any) => {
    if (!ticket.task_id || !ticket.operator_id || !ticket.case_number) {
      alert("Please fill out required fields");
      return;
    }

    await supabase
      .from("tickets")
      .update({
        department_id: ticket.department_id,
        task_id: ticket.task_id,
        operator_id: ticket.operator_id,
        case_number: ticket.case_number,
        comments: ticket.comments,
      })
      .eq("id", ticket.id);

    setEditingId(null);
    fetchTickets();
  };

  // Update Every Second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ✅ Create ticket
  const createTicket = async () => {
    if (!selectedDept || !selectedTask || !selectedOperator || !caseNumber) {
      alert("Please fill out all required fields");
      return;
    }

    await supabase.from("tickets").insert([
      {
        department_id: selectedDept,
        task_id: selectedTask,
        operator_id: selectedOperator,
        case_number: caseNumber,
        comments: comments,

        elapsed_start_time: new Date(),
        is_elapsed_active: true,
      },
    ]);

    // reset
    setCaseNumber("");
    setComments("");
  };


  // ✅ CLOCK TOGGLE
  const toggleClock = async (ticket: any) => {
    // 🔴 BLOCK if elapsed is paused
    if (!ticket.is_elapsed_active) {
      alert("Cannot start work while time is paused");
      return;
    }

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
      // clock OUT
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


  // Toggle Elapsed
  const toggleElapsed = async (ticket: any) => {
    const now = new Date();

    if (ticket.is_elapsed_active) {
      // 🔴 PAUSE ELAPSED

      let elapsed = ticket.elapsed_time || 0;

      if (ticket.elapsed_start_time) {
        elapsed +=
          now.getTime() - new Date(ticket.elapsed_start_time).getTime();
      }

      let total = ticket.total_time || 0;

      // ✅ ALSO pause work time if active
      if (ticket.is_active && ticket.start_time) {
        total += now.getTime() - new Date(ticket.start_time).getTime();
      }

      await supabase
        .from("tickets")
        .update({
          elapsed_time: elapsed,
          elapsed_start_time: null,
          is_elapsed_active: false,

          // ✅ pause work time too
          total_time: total,
          start_time: null,
          is_active: false,
        })
        .eq("id", ticket.id);
    } else {
      // 🟢 RESUME ELAPSED

      await supabase
        .from("tickets")
        .update({
          elapsed_start_time: now,
          is_elapsed_active: true,

          // ✅ resume working too
          start_time: now,
          is_active: true,
        })
        .eq("id", ticket.id);
    }

    fetchTickets();
  };


  // ✅ FINISH TASK
  const finishTicket = async (ticket: any) => {
      const now = new Date();

      // ✅ finalize WORK TIME
      let total = ticket.total_time || 0;

      if (ticket.is_active && ticket.start_time) {
        total += now.getTime() - new Date(ticket.start_time).getTime();
      }

      // ✅ finalize ELAPSED TIME (THIS IS STEP 5)
      let totalElapsed = ticket.elapsed_time || 0;

      if (ticket.is_elapsed_active && ticket.elapsed_start_time) {
        totalElapsed +=
          now.getTime() - new Date(ticket.elapsed_start_time).getTime();
      }

      await supabase
        .from("tickets")
        .update({
          end_time: now,

          // ✅ stop work timer
          is_active: false,
          total_time: total,
          start_time: null,

          // ✅ stop elapsed timer
          elapsed_time: totalElapsed,
          is_elapsed_active: false,
          elapsed_start_time: null,
        })
        .eq("id", ticket.id);

      fetchTickets();
    };

  // Editing operators
  const getDeptData = async (deptId: number) => {
    // ✅ fetch tasks
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("department_id", deptId);

    // ✅ fetch operators
    const { data: operatorData } = await supabase
      .from("department_operators")
      .select(`
        operator_id,
        operators!department_operators_operator_id_fkey (id, name)
      `)
      .eq("department_id", deptId);

    return {
      tasks: taskData || [],
      operators: (operatorData || []).map((o: any) => o.operators),
    };
  };


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">New Ticket</h1>

      {/* Create Ticket */}
        <div className="mb-6 flex flex-wrap gap-2">
      {/* ✅ Department */}
      <select
        className="border p-2 mr-2 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        value={selectedDept}
        onChange={(e) => {
          const value = Number(e.target.value);
          setSelectedDept(value);
          setSelectedTask("");
          setSelectedOperator("");
        }}
      >
        <option value="">Select Department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {/* ✅ Task (filtered by department) */}
      <select
        className="border p-2 mr-2 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        value={selectedTask}
        onChange={(e) => setSelectedTask(Number(e.target.value))}
        disabled={!selectedDept}
      >
        <option value="">Select Task</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* ✅ Operator (filtered by department via join table) */}
      <select
        className="border p-2 mr-2 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        value={selectedOperator}
        onChange={(e) => setSelectedOperator(Number(e.target.value))}
        disabled={!selectedDept}
      >
        <option value="">Select Operator</option>
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      {/* ✅ Case Number */}
      <input
        className="border p-2 mr-2 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        placeholder="Case Number"
        value={caseNumber}
        onChange={(e) => setCaseNumber(e.target.value)}
      />

      {/* Comments (optional)*/}
      <textarea
        className="border p-2 mr-2 bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        placeholder="Comments (optional)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />

      {/* ✅ Submit */}
      <button
        className="bg-blue-500 text-white px-4 py-2"
        onClick={createTicket}
      >
        Create Ticket
      </button>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">
        Open Tickets
      </h2>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {/* ✅ Filter Department */}
        <select
          className="border p-2 bg-white dark:bg-gray-800"
          value={filterDept}
          onChange={(e) => {
            setFilterDept(
              e.target.value === "" ? "" : Number(e.target.value)
            );
            setFilterOperator("");
          }}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* ✅ Filter Operator */}
        <select
          className="border p-2 bg-white dark:bg-gray-800"
          value={filterOperator}
          onChange={(e) =>
            setFilterOperator(
              e.target.value === "" ? "" : Number(e.target.value)
            )
          }
        >
          <option value="">All Operators</option>
          {allOperators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Ticket List */}
      <div>
        {tickets
        .filter((t) => {
          if (filterDept && t.department_id !== filterDept) return false;
          if (filterOperator && t.operator_id !== filterOperator) return false;
          return true;
        })
        .map((t) => {
          const now = Date.now();

          const start = t.start_time ? new Date(t.start_time).getTime() : null;
          const end = t.end_time ? new Date(t.end_time).getTime() : null;

          // ✅ ELAPSED TIME (since creation)
          const created = new Date(
            t.created_at || t.start_time || now
          ).getTime();

          let elapsed = t.elapsed_time || 0;

          if (t.is_elapsed_active && t.elapsed_start_time) {
            elapsed += now - new Date(t.elapsed_start_time).getTime();
          }

          // ✅ WORK TIME (saved + active session)
          let workTime = t.total_time || 0;

          if (t.is_active && start) {
            workTime += now - start;
          }

          return (
            <div 
            key={t.id}
            className="border p-4 mb-3 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">

              {/* Editing Ticket*/}
              {editingId === t.id ? (
                <>
                  {/* ✅ Row 1 — Main fields */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* ✅ Department */}
                    <select
                      className="border p-2 bg-white dark:bg-gray-800"
                      value={t.department_id}
                      onChange={async (e) => {
                        const newDept = Number(e.target.value);

                        const { tasks: newTasks, operators: newOperators } =
                          await getDeptData(newDept);

                        setEditTasks(newTasks);
                        setEditOperators(newOperators);

                        setTickets((prev) =>
                          prev.map((ticket) =>
                            ticket.id === t.id
                              ? {
                                  ...ticket,
                                  department_id: newDept,
                                  task_id: null,
                                  operator_id: null,
                                }
                              : ticket
                          )
                        );
                      }}
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    {/* ✅ Task */}
                    <select
                      className="border p-2 bg-white dark:bg-gray-800"
                      value={t.task_id || ""}
                      onChange={(e) =>
                        setTickets((prev) =>
                          prev.map((ticket) =>
                            ticket.id === t.id
                              ? {
                                  ...ticket,
                                  task_id:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : ticket
                          )
                        )
                      }
                    >
                      <option value="">Select Task</option>

                      {editTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>

                    {/* ✅ Operator */}
                    <select
                      className="border p-2 bg-white dark:bg-gray-800"
                      value={t.operator_id || ""}
                      onChange={(e) =>
                        setTickets((prev) =>
                          prev.map((ticket) =>
                            ticket.id === t.id
                              ? {
                                  ...ticket,
                                  operator_id:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : ticket
                          )
                        )
                      }
                    >
                      <option value="">Select Operator</option>

                      {editOperators.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>

                    {/* ✅ Case Number */}
                    <input
                      className="border p-2 bg-white dark:bg-gray-800"
                      value={t.case_number}
                      placeholder = "Case Number"
                      onChange={(e) =>
                        setTickets((prev) =>
                          prev.map((ticket) =>
                            ticket.id === t.id
                              ? { ...ticket, case_number: e.target.value }
                              : ticket
                          )
                        )
                      }
                    />
                  </div>

                  {/* ✅ Row 2 — Comments */}
                  <div className="mt-2 w-full">
                    <textarea
                      className="w-full border p-2 bg-white dark:bg-gray-800 resize-none h-20"
                      value={t.comments || ""}
                      placeholder="Comments (optional)"
                      onChange={(e) =>
                        setTickets((prev) =>
                          prev.map((ticket) =>
                            ticket.id === t.id
                              ? { ...ticket, comments: e.target.value }
                              : ticket
                          )
                        )
                      }
                    />
                  </div>

                  {/* ✅ Row 3 — Buttons */}
                  <div className="mt-2 flex gap-2">
                    <button
                      className="bg-green-500 text-white px-3 py-1"
                      onClick={() => updateTicket(t)}
                    >
                      Save
                    </button>

                    <button
                      className="text-red-500"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>Department: {t.departments?.name}</p>
                  <p>Task: {t.tasks?.name}</p>
                  <p>Operator: {t.operators?.name}</p>
                  <p>Case #: {t.case_number}</p>
                  <p>Comments: {t.comments || "—"}</p>
                </>
              )}

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

              {/* ✅ Edit Button */}
              {!end && (
                <button
                  className="mt-2 bg-blue-500 text-white px-3 py-1 mr-2"                 
                  onClick={async () => {
                    setEditingId(t.id);

                    const { tasks: newTasks, operators: newOperators } =
                      await getDeptData(t.department_id);

                    setEditTasks(newTasks);
                    setEditOperators(newOperators);
                  }}
                >
                  Edit
                </button>
              )}

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

              
                {/* ✅ NEW Pause/Resume Elapsed Button */}
                {!end && (
                  <button
                    className="mt-2 bg-yellow-500 text-white px-3 py-1 mr-2"
                    onClick={() => toggleElapsed(t)}
                  >
                    {t.is_elapsed_active ? "Pause Time" : "Resume Time"}
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
