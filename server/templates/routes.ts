import { Router } from "express";
import { db } from "../db";
import { jobTemplates, jobTemplateTasks, jobTemplateMaterials, jobTemplateSchema } from "../../shared/schema";
import { authenticate } from "../middleware/authenticate";
import { eq, and } from "drizzle-orm";

const templatesRouter = Router();

// Middleware to ensure routes are protected
templatesRouter.use(authenticate);

// Get all job templates for the logged-in contractor
templatesRouter.get("/", async (req, res) => {
  try {
    const { user } = req.session;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Get all templates created by this contractor
    const templates = await db.select().from(jobTemplates)
      .where(eq(jobTemplates.contractorId, user.id));
    
    return res.json({ success: true, data: templates });
  } catch (error) {
    console.error("Error fetching job templates:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get a single job template with tasks and materials
templatesRouter.get("/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Get the template if it belongs to this contractor
    const [template] = await db.select().from(jobTemplates)
      .where(and(
        eq(jobTemplates.id, parseInt(id)),
        eq(jobTemplates.contractorId, user.id)
      ));
    
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found or access denied" });
    }
    
    // Get the tasks for this template
    const tasks = await db.select().from(jobTemplateTasks)
      .where(eq(jobTemplateTasks.templateId, template.id))
      .orderBy(jobTemplateTasks.sortOrder);
    
    // Get the materials for this template
    const materials = await db.select().from(jobTemplateMaterials)
      .where(eq(jobTemplateMaterials.templateId, template.id))
      .orderBy(jobTemplateMaterials.sortOrder);
    
    return res.json({ 
      success: true, 
      data: {
        ...template,
        tasks,
        materials
      } 
    });
  } catch (error) {
    console.error("Error fetching job template:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Create a new job template
templatesRouter.post("/", async (req, res) => {
  try {
    const { user } = req.session;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Validate request body
    const validatedData = jobTemplateSchema.safeParse(req.body);
    
    if (!validatedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: validatedData.error.format() 
      });
    }
    
    const { title, description, categoryTags, estimatedDuration, estimatedBudget, tasks, materials } = validatedData.data;
    
    // Start a transaction to create the template and its associated items
    const result = await db.transaction(async (tx) => {
      // Insert the template
      const [template] = await tx.insert(jobTemplates).values({
        contractorId: user.id,
        title,
        description,
        categoryTags: categoryTags || [],
        estimatedDuration: estimatedDuration || 1,
        estimatedBudget: estimatedBudget || null,
      }).returning();
      
      // Insert tasks if provided
      let templateTasks: any[] = [];
      if (tasks && tasks.length > 0) {
        templateTasks = await Promise.all(tasks.map(async (task, index) => {
          const [newTask] = await tx.insert(jobTemplateTasks).values({
            templateId: template.id,
            description: task.description,
            estimatedHours: task.estimatedHours,
            sortOrder: task.sortOrder !== undefined ? task.sortOrder : index,
          }).returning();
          return newTask;
        }));
      }
      
      // Insert materials if provided
      let templateMaterials: any[] = [];
      if (materials && materials.length > 0) {
        templateMaterials = await Promise.all(materials.map(async (material, index) => {
          const [newMaterial] = await tx.insert(jobTemplateMaterials).values({
            templateId: template.id,
            description: material.description,
            quantity: material.quantity,
            unitPrice: material.unitPrice,
            sortOrder: material.sortOrder !== undefined ? material.sortOrder : index,
          }).returning();
          return newMaterial;
        }));
      }
      
      return {
        template,
        tasks: templateTasks,
        materials: templateMaterials
      };
    });
    
    return res.status(201).json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error("Error creating job template:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Update a job template
templatesRouter.patch("/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Check if template exists and belongs to the user
    const [existingTemplate] = await db.select().from(jobTemplates)
      .where(and(
        eq(jobTemplates.id, parseInt(id)),
        eq(jobTemplates.contractorId, user.id)
      ));
    
    if (!existingTemplate) {
      return res.status(404).json({ success: false, error: "Template not found or access denied" });
    }
    
    // Validate the request body
    const validatedData = jobTemplateSchema.partial().safeParse(req.body);
    
    if (!validatedData.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: validatedData.error.format() 
      });
    }
    
    const { title, description, categoryTags, estimatedDuration, estimatedBudget, tasks, materials } = validatedData.data;
    
    // Start a transaction to update the template and its associated items
    const result = await db.transaction(async (tx) => {
      // Update the template
      const [updatedTemplate] = await tx.update(jobTemplates)
        .set({
          title,
          description,
          categoryTags: categoryTags || undefined,
          estimatedDuration,
          estimatedBudget,
          updatedAt: new Date(),
        })
        .where(eq(jobTemplates.id, parseInt(id)))
        .returning();
      
      let templateTasks: any[] = [];
      let templateMaterials: any[] = [];
      
      // Update tasks if provided
      if (tasks) {
        // Delete existing tasks
        await tx.delete(jobTemplateTasks)
          .where(eq(jobTemplateTasks.templateId, parseInt(id)));
        
        // Insert new tasks
        if (tasks.length > 0) {
          templateTasks = await Promise.all(tasks.map(async (task, index) => {
            const [newTask] = await tx.insert(jobTemplateTasks).values({
              templateId: parseInt(id),
              description: task.description,
              estimatedHours: task.estimatedHours,
              sortOrder: task.sortOrder !== undefined ? task.sortOrder : index,
            }).returning();
            return newTask;
          }));
        }
      }
      
      // Update materials if provided
      if (materials) {
        // Delete existing materials
        await tx.delete(jobTemplateMaterials)
          .where(eq(jobTemplateMaterials.templateId, parseInt(id)));
        
        // Insert new materials
        if (materials.length > 0) {
          templateMaterials = await Promise.all(materials.map(async (material, index) => {
            const [newMaterial] = await tx.insert(jobTemplateMaterials).values({
              templateId: parseInt(id),
              description: material.description,
              quantity: material.quantity,
              unitPrice: material.unitPrice,
              sortOrder: material.sortOrder !== undefined ? material.sortOrder : index,
            }).returning();
            return newMaterial;
          }));
        }
      }
      
      return {
        template: updatedTemplate,
        tasks: tasks ? templateTasks : undefined,
        materials: materials ? templateMaterials : undefined
      };
    });
    
    return res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error("Error updating job template:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Delete a job template
templatesRouter.delete("/:id", async (req, res) => {
  try {
    const { user } = req.session;
    const { id } = req.params;
    
    if (!user) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    
    // Check if template exists and belongs to the user
    const [existingTemplate] = await db.select().from(jobTemplates)
      .where(and(
        eq(jobTemplates.id, parseInt(id)),
        eq(jobTemplates.contractorId, user.id)
      ));
    
    if (!existingTemplate) {
      return res.status(404).json({ success: false, error: "Template not found or access denied" });
    }
    
    // Start a transaction to delete the template and its associated items
    await db.transaction(async (tx) => {
      // Delete template tasks
      await tx.delete(jobTemplateTasks)
        .where(eq(jobTemplateTasks.templateId, parseInt(id)));
      
      // Delete template materials
      await tx.delete(jobTemplateMaterials)
        .where(eq(jobTemplateMaterials.templateId, parseInt(id)));
      
      // Delete the template itself
      await tx.delete(jobTemplates)
        .where(eq(jobTemplates.id, parseInt(id)));
    });
    
    return res.json({ 
      success: true, 
      message: "Template deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting job template:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default templatesRouter;