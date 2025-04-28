import { Router } from "express";
import { db } from "../db";
import { timeSlots, jobSchedules, jobDependencies, timeSlotSchema, jobScheduleSchema, users, jobs } from "../../shared/schema";
import { authenticate } from "../middleware/authenticate";
import { eq, and, gte, lte, desc, asc, or, inArray, SQL } from "drizzle-orm";

const calendarRouter = Router();

// Middleware to ensure routes are protected
calendarRouter.use(authenticate);

//
// TIME SLOTS API (contractor availability)
//

// Get time slots for the logged-in contractor
calendarRouter.get("/time-slots", async (req, res) => {
  try {
    const { user } = req.session;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Optional date range filtering
    const { startDate, endDate } = req.query;
    let query = db.select().from(timeSlots).where(eq(timeSlots.contractorId, user.id));
    
    if (startDate && endDate) {
      query = query.where(
        and(
          gte(timeSlots.date, new Date(startDate as string)),
          lte(timeSlots.date, new Date(endDate as string))
        )
      );
    }
    
    const slots = await query.orderBy(asc(timeSlots.date), asc(timeSlots.startTime));
    
    return res.json({ success: true, data: slots });
  } catch (error) {
    console.error("Error fetching time slots:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Create a new time slot
calendarRouter.post("/time-slots", async (req, res) => {
  try {
    const { user } = req.session;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Validate the request body
    const validatedData = timeSlotSchema.safeParse(req.body);
    
    if (!validatedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: validatedData.error.format() 
      });
    }
    
    const { date, startTime, endTime, status, note } = validatedData.data;
    
    // Insert the new time slot
    const [newTimeSlot] = await db.insert(timeSlots).values({
      contractorId: user.id,
      date: new Date(date),
      startTime,
      endTime,
      status,
      note: note || null,
    }).returning();
    
    return res.status(201).json({ success: true, data: newTimeSlot });
  } catch (error) {
    console.error("Error creating time slot:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get a specific time slot
calendarRouter.get("/time-slots/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Fetch the time slot
    const [timeSlot] = await db.select()
      .from(timeSlots)
      .where(and(
        eq(timeSlots.id, parseInt(id)),
        eq(timeSlots.contractorId, user.id)
      ));
    
    if (!timeSlot) {
      return res.status(404).json({ success: false, error: "Time slot not found" });
    }
    
    return res.json({ success: true, data: timeSlot });
  } catch (error) {
    console.error("Error fetching time slot:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Update a time slot
calendarRouter.patch("/time-slots/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Check if time slot exists and belongs to the user
    const [existingTimeSlot] = await db.select()
      .from(timeSlots)
      .where(and(
        eq(timeSlots.id, parseInt(id)),
        eq(timeSlots.contractorId, user.id)
      ));
    
    if (!existingTimeSlot) {
      return res.status(404).json({ success: false, error: "Time slot not found or access denied" });
    }
    
    // Validate the request body
    const validatedData = timeSlotSchema.partial().safeParse(req.body);
    
    if (!validatedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: validatedData.error.format() 
      });
    }
    
    const { date, startTime, endTime, status, note } = validatedData.data;
    
    // Update the time slot
    const [updatedTimeSlot] = await db.update(timeSlots)
      .set({
        date: date ? new Date(date) : undefined,
        startTime,
        endTime,
        status,
        note,
        updatedAt: new Date(),
      })
      .where(eq(timeSlots.id, parseInt(id)))
      .returning();
    
    return res.json({ success: true, data: updatedTimeSlot });
  } catch (error) {
    console.error("Error updating time slot:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Delete a time slot
calendarRouter.delete("/time-slots/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Check if time slot exists and belongs to the user
    const [existingTimeSlot] = await db.select()
      .from(timeSlots)
      .where(and(
        eq(timeSlots.id, parseInt(id)),
        eq(timeSlots.contractorId, user.id)
      ));
    
    if (!existingTimeSlot) {
      return res.status(404).json({ success: false, error: "Time slot not found or access denied" });
    }
    
    // Delete the time slot
    await db.delete(timeSlots)
      .where(eq(timeSlots.id, parseInt(id)));
    
    return res.json({ success: true, message: "Time slot deleted successfully" });
  } catch (error) {
    console.error("Error deleting time slot:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

//
// JOB SCHEDULES API (schedule for specific jobs)
//

// Get job schedules for the logged-in contractor
calendarRouter.get("/job-schedules", async (req, res) => {
  try {
    const { user } = req.session;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Optional date range filtering
    const { startDate, endDate } = req.query;
    
    // Get all jobs for this contractor
    const userJobs = await db.select()
      .from(jobs)
      .where(eq(jobs.contractorId, user.id));
    
    const jobIds = userJobs.map(job => job.id);
    
    if (jobIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // Build query to get schedules for these jobs
    let query = db.select().from(jobSchedules)
      .where(
        db.exists(
          db.select()
            .from(jobs)
            .where(
              and(
                eq(jobs.contractorId, user.id),
                eq(jobSchedules.jobId, jobs.id)
              )
            )
        )
      );
    
    if (startDate && endDate) {
      query = query.where(
        and(
          gte(jobSchedules.startDate, new Date(startDate as string)),
          lte(jobSchedules.endDate, new Date(endDate as string))
        )
      );
    }
    
    const schedules = await query.orderBy(asc(jobSchedules.startDate));
    
    return res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("Error fetching job schedules:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Create a new job schedule
calendarRouter.post("/job-schedules", async (req, res) => {
  try {
    const { user } = req.session;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Validate the request body
    const validatedData = jobScheduleSchema.safeParse(req.body);
    
    if (!validatedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: validatedData.error.format() 
      });
    }
    
    const { jobId, startDate, endDate, startTime, endTime, isAllDay, status, note } = validatedData.data;
    
    // Verify the job belongs to the user
    const [job] = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.id, jobId),
        eq(jobs.contractorId, user.id)
      ));
    
    if (!job) {
      return res.status(403).json({ success: false, error: "Job not found or access denied" });
    }
    
    // Insert the new job schedule
    const [newJobSchedule] = await db.insert(jobSchedules).values({
      jobId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      startTime: isAllDay ? null : startTime,
      endTime: isAllDay ? null : endTime,
      isAllDay,
      status,
      note: note || null,
    }).returning();
    
    return res.status(201).json({ success: true, data: newJobSchedule });
  } catch (error) {
    console.error("Error creating job schedule:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get a specific job schedule
calendarRouter.get("/job-schedules/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Fetch the job schedule
    const [schedule] = await db.select({
      jobSchedule: jobSchedules,
      job: jobs,
    })
    .from(jobSchedules)
    .leftJoin(jobs, eq(jobSchedules.jobId, jobs.id))
    .where(and(
      eq(jobSchedules.id, parseInt(id)),
      eq(jobs.contractorId, user.id)
    ));
    
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Job schedule not found or access denied" });
    }
    
    return res.json({ success: true, data: schedule.jobSchedule, job: schedule.job });
  } catch (error) {
    console.error("Error fetching job schedule:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Update a job schedule
calendarRouter.patch("/job-schedules/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Check if job schedule exists and belongs to a job owned by the user
    const [schedule] = await db.select({
      jobSchedule: jobSchedules,
      job: jobs,
    })
    .from(jobSchedules)
    .leftJoin(jobs, eq(jobSchedules.jobId, jobs.id))
    .where(and(
      eq(jobSchedules.id, parseInt(id)),
      eq(jobs.contractorId, user.id)
    ));
    
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Job schedule not found or access denied" });
    }
    
    // Validate the request body
    const validatedData = jobScheduleSchema.partial().safeParse(req.body);
    
    if (!validatedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: validatedData.error.format() 
      });
    }
    
    const { startDate, endDate, startTime, endTime, isAllDay, status, note } = validatedData.data;
    
    // Update the job schedule
    const [updatedSchedule] = await db.update(jobSchedules)
      .set({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        isAllDay,
        status,
        note,
        updatedAt: new Date(),
      })
      .where(eq(jobSchedules.id, parseInt(id)))
      .returning();
    
    return res.json({ success: true, data: updatedSchedule });
  } catch (error) {
    console.error("Error updating job schedule:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Delete a job schedule
calendarRouter.delete("/job-schedules/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Check if job schedule exists and belongs to a job owned by the user
    const [schedule] = await db.select({
      jobSchedule: jobSchedules,
      job: jobs,
    })
    .from(jobSchedules)
    .leftJoin(jobs, eq(jobSchedules.jobId, jobs.id))
    .where(and(
      eq(jobSchedules.id, parseInt(id)),
      eq(jobs.contractorId, user.id)
    ));
    
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Job schedule not found or access denied" });
    }
    
    // Delete the job schedule
    await db.delete(jobSchedules)
      .where(eq(jobSchedules.id, parseInt(id)));
    
    return res.json({ success: true, message: "Job schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting job schedule:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

//
// JOB DEPENDENCIES API (multi-trade job dependencies)
//

// Get job dependencies
calendarRouter.get("/job-dependencies", async (req, res) => {
  try {
    const { user } = req.session;
    const { jobId } = req.query;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Build query based on params
    let query = db.select({
      dependency: jobDependencies,
      job: jobs,
      dependsOnJob: db.select().from(jobs).as('depends_on_job'),
    })
    .from(jobDependencies)
    .leftJoin(jobs, eq(jobDependencies.jobId, jobs.id))
    .leftJoin(db.select().from(jobs).as('depends_on_job'), 
              eq(jobDependencies.dependsOnJobId, db.select().from(jobs).as('depends_on_job').id));
    
    // Filter to only jobs the contractor has access to
    query = query.where(
      or(
        eq(jobs.contractorId, user.id),
        eq(db.select().from(jobs).as('depends_on_job').contractorId, user.id)
      )
    );
    
    // Optional filtering by specific job
    if (jobId) {
      query = query.where(
        or(
          eq(jobDependencies.jobId, parseInt(jobId as string)),
          eq(jobDependencies.dependsOnJobId, parseInt(jobId as string))
        )
      );
    }
    
    const dependencies = await query;
    
    return res.json({ success: true, data: dependencies });
  } catch (error) {
    console.error("Error fetching job dependencies:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default calendarRouter;