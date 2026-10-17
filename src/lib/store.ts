async checkIn(appointmentId) {
  const supabase = createClient();
  const apt = get().appointments.find((a) => a.id === appointmentId);
  const clinic = get().clinic;
  if (!apt || apt.status !== "booked" || !clinic) return;

  const start = new Date(apt.scheduledAt);
  const shiftStart = timeInTimeZone(start, clinic.timezone);
  const day = dateInTimeZone(new Date(), clinic.timezone);

  // 1. Try generating the token
  const { data: token, error: tokenErr } = await supabase.rpc("next_token", {
    p_clinic_id: apt.clinicId,
    p_doctor_id: apt.doctorId,
    p_day: day,
  });

  if (tokenErr || token === null) {
    alert("CHECKIN FAILED (Token RPC): " + (tokenErr?.message ?? "Unknown error"));
    set({ error: tokenErr?.message ?? "Could not generate token." });
    return;
  }

  // 2. Try inserting into the queue
  const { data, error } = await supabase
    .from("queue_entries")
    .insert({
      clinic_id: apt.clinicId,
      doctor_id: apt.doctorId,
      day,
      token_number: token,
      arrival_type: "appointment",
      appointment_id: apt.id,
      patient_name: apt.patientName,
      patient_phone: apt.patientPhone,
      status: "waiting",
      shift_start: shiftStart,
      shift_end: apt.shiftEnd,
    })
    .select("*")
    .single();

  if (error || !data) {
    alert("CHECKIN FAILED (Queue Insert): " + (error?.message ?? "Unknown error"));
    set({ error: error?.message ?? "Could not add to queue." });
    return;
  }

  // 3. Try updating the appointment status
  const { error: updErr } = await supabase
    .from("appointments")
    .update({ status: "checked_in" })
    .eq("id", appointmentId);
    
  if (updErr) {
    alert("CHECKIN FAILED (Appointment Update): " + updErr.message);
    set({ error: updErr.message });
    return;
  }

  set((s) => ({
    appointments: s.appointments.map((a) =>
      a.id === appointmentId ? { ...a, status: "checked_in" } : a
    ),
    queueEntries: [...s.queueEntries, toQueueEntry(data as Row)],
  }));
},